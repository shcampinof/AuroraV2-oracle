const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomInt, randomBytes } = require('node:crypto');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '../../.env'), quiet: true });
const { signAppToken } = require('../services/authService');
const { getOracleDriver } = require('../db/oraclePool');
const { getOracleConfig, getOracleSchema } = require('../config/oracle');

// Usa la aplicación publicada, sin interceptar sus respuestas. Solo modifica
// fixtures con identidades aleatorias y los elimina y comprueba al finalizar.
// PLAYWRIGHT_MODULE_PATH permite usar Playwright instalado fuera del proyecto.
async function run() {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
  const baseUrl = process.env.VERSION_QA_BASE_URL || 'https://127.0.0.1';
  const output = process.env.VERSION_QA_OUTPUT || '/tmp/aurora-version-flows';
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const suffix = [...randomBytes(7)].map((b) => String.fromCharCode(65 + b % 26)).join('');
  const email = `qa.version.${suffix.toLowerCase()}@example.test`;
  const extraEmail = `qa.version.extra.${suffix.toLowerCase()}@example.test`;
  const invalidEmail = `qa.version.invalido.${suffix.toLowerCase()}`;
  const cedula = String(randomInt(9_800_000_000, 9_899_999_000));
  const admin = { id: `qa-admin-${suffix}`, name: 'QA VERSION', email: `qa.admin.${suffix.toLowerCase()}@example.test`, provider: 'ldap', roles: ['admin', 'pag', 'carguebd'] };
  const dndp = { id: `qa-dndp-${suffix}`, name: `QA DNDP ${suffix}`, email: `qa.dndp.${suffix.toLowerCase()}@example.test`, provider: 'ldap', roles: ['dndp'] };
  const normal = { id: `qa-user-${suffix}`, name: 'QA USUARIO', email: extraEmail, provider: 'ldap', roles: ['user'] };
  const adminToken = signAppToken(admin);
  const dndpToken = signAppToken(dndp);
  const normalToken = signAppToken(normal);
  const pagToken = signAppToken({ ...normal, id: email, email });
  const defenders = [
    { cedula: String(Number(cedula) + 1), nombre: `DEFENSOR QA ALFA ${suffix}` },
    { cedula: String(Number(cedula) + 2), nombre: `DEFENSOR QA BETA ${suffix}` },
  ];
  const fixtures = Array.from({ length: 7 }, (_, i) => ({
    idPersona: -randomInt(1, 2_000_000_000), idSituacion: -randomInt(1, 2_000_000_000),
    documento: String(Number(cedula) + 10 + i),
    nombre: `QA VERSION ${suffix} ${['ALFA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA', 'ETA'][i]}`,
    tipo: [2, 5].includes(i) ? 'Sindicado' : 'Condenado',
    place: [1, 5].includes(i) ? { departamento: 'META', municipio: 'GRANADA', centro: 'CPMS GRANADA', regional: 'META' }
      : i === 2 ? { departamento: null, municipio: null, centro: null, regional: null }
        : { departamento: 'CUNDINAMARCA', municipio: 'GIRARDOT', centro: 'CPMS GIRARDOT', regional: 'CUNDINAMARCA' },
  }));
  const driver = getOracleDriver();
  const config = getOracleConfig();
  const schema = getOracleSchema();
  const connection = await driver.getConnection({ user: config.user, password: config.password, connectString: config.connectString });
  const sql = (query, binds = {}) => connection.execute(query.replace(/\bDNDP\./g, `${schema}.`), binds, { outFormat: driver.OUT_FORMAT_OBJECT, autoCommit: false });
  const checks = [];
  const pageErrors = [];
  let browser;
  let apiContext;
  let baselineUsers;
  let fixtureCommitted = false;
  let cleanupVerified = false;
  let fatalError;

  async function api(route, { method = 'GET', body, token = adminToken, expected = 200 } = {}) {
    const response = await apiContext.request.fetch(`${baseUrl}/api${route}`, {
      method, headers: { Authorization: `Bearer ${token}` }, timeout: 120000,
      ...(body !== undefined ? { data: body } : {}),
    });
    const data = await response.json().catch(() => ({}));
    assert([expected].flat().includes(response.status()), `${method} ${route}: HTTP ${response.status()}, esperado ${expected}; ${data.message || data.error || ''}`);
    return data;
  }
  async function test(name, action) {
    const started = Date.now();
    try {
      const detail = await action();
      checks.push({ name, ok: true, ms: Date.now() - started, ...(detail ? { detail } : {}) });
      console.log(`PASS ${name}`);
      return true;
    } catch (error) {
      checks.push({ name, ok: false, ms: Date.now() - started, error: error.message });
      console.log(`FAIL ${name}: ${error.message}`);
      return false;
    }
  }
  async function session(user, token) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block', acceptDownloads: true, viewport: { width: 1440, height: 1080 } });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());
    await page.addInitScript(({ user: u, token: t }) => {
      localStorage.setItem('aurora.auth.token', t);
      localStorage.setItem('aurora.auth.user', JSON.stringify(u));
    }, { user, token });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await accept(page);
    return { context, page };
  }
  async function accept(page) {
    const button = page.getByRole('button', { name: 'Aceptar y continuar', exact: true });
    await button.waitFor({ state: 'visible' });
    await button.click();
    await page.locator('.data-notice-backdrop').waitFor({ state: 'hidden' });
  }
  async function form(page, fixture) {
    await page.getByRole('button', { name: 'Formulario de atención', exact: true }).click();
    await page.getByPlaceholder('Ingrese Documento', { exact: true }).fill(fixture.documento);
    await page.getByRole('button', { name: 'CONSULTAR PPL', exact: true }).click();
    await page.locator('.historial-action-button').first().click();
  }
  async function save(page, fixture) {
    const pending = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/ppl/${fixture.documento}` && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'GUARDAR ENTREVISTA', exact: true }).click();
    const response = await pending;
    assert.equal(response.status(), 200, `Guardar formulario: HTTP ${response.status()}`);
    // Guardar vacía primero el autoguardado y después envía la versión manual.
    // Esperar solo el primer PUT confunde ese envío con el guardado terminado.
    await page.waitForFunction(() => [...document.querySelectorAll('button')]
      .some((button) => button.textContent === 'GUARDAR ENTREVISTA' && !button.disabled));
    return response.json();
  }
  async function stored(fixture) {
    return (await sql('SELECT g.* FROM DNDP.GESTION_JURIDICA g WHERE ID_SITUACION = :id ORDER BY ID_GESTION DESC', { id: fixture.idSituacion })).rows[0];
  }
  async function detail(fixture) { return (await api(`/ppl/${fixture.documento}`)).registro; }
  async function assign(fixture, defender = defenders[0], token = dndpToken) {
    return api('/ppl/asignar-defensor', { method: 'POST', token, body: { documentos: [fixture.documento], defensorCedula: defender.cedula } });
  }
  const closureKey = 'Cierre del caso por imposibilidad de avanzar (si aplica)';
  const reasonKey = 'Razón o explicación del cierre del caso';
  const baseReport = { defensorId: defenders[0].cedula, regional: 'CUNDINAMARCA', fechaInicio: '2026-01-01', fechaFin: '2026-10-27', tipo: 'all' };
  async function report(overrides = {}, expected = 200) {
    return api(`/reportes/atenciones-defensores?${new URLSearchParams({ ...baseReport, ...overrides })}`, { expected });
  }

  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    apiContext = await browser.newContext({ ignoreHTTPSErrors: true });
    baselineUsers = (await api('/admin/users')).users;
    await test('Permisos: usuario común no administra usuarios ni asignaciones', async () => {
      await api('/admin/users', { token: normalToken, expected: 403 });
      await api('/admin/users/pag/regionales', { token: normalToken, expected: 403 });
      await api('/ppl/asignar-defensor', { token: normalToken, method: 'POST', body: { documentos: [fixtures[0].documento], defensorCedula: defenders[0].cedula }, expected: 403 });
    });

    const adminSession = await session(admin, adminToken);
    const page = adminSession.page;
    await page.getByRole('button', { name: 'Usuarios autorizados', exact: true }).click();
    await page.locator('.admin-users-form input[type="email"]').fill(email);
    await page.locator('.admin-users-form input[type="text"]').fill(`PAG QA VERSION ${suffix}`);
    await page.locator('.admin-users-form').getByRole('checkbox', { name: 'PAG', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await test('PAG: cancelar el modal no crea usuario ni registro Oracle', async () => {
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert(!(await api('/admin/users')).users.some((u) => u.email === email));
      assert.equal((await sql('SELECT COUNT(*) N FROM DNDP.PAG WHERE CEDULA_PAG=:c', { c: cedula })).rows[0].N, 0);
    });
    await page.locator('.admin-users-form').getByRole('checkbox', { name: 'PAG', exact: true }).click();
    await dialog.waitFor();
    await dialog.getByLabel('Cédula PAG', { exact: true }).fill(cedula);
    await test('PAG: regional inexistente bloqueada en modal', async () => {
      await dialog.getByRole('combobox').fill('REGIONAL QA INEXISTENTE');
      await dialog.getByRole('combobox').press('Escape');
      await dialog.getByRole('button', { name: 'Guardar PAG', exact: true }).click();
      await dialog.getByRole('alert').filter({ hasText: 'Seleccione una regional' }).waitFor();
      assert(!(await api('/admin/users')).users.some((u) => u.email === email));
    });
    await dialog.getByRole('combobox').fill('cundinamarca');
    await dialog.getByRole('combobox').press('ArrowDown');
    await dialog.getByRole('combobox').press('Enter');
    const creation = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/admin/users' && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Guardar PAG', exact: true }).click();
    assert.equal((await creation).status(), 201);
    await dialog.waitFor({ state: 'hidden' });
    await page.getByPlaceholder('Correo, nombre, cédula, regional, rol o estado').fill(email);
    await page.locator('.admin-users-table tbody tr').filter({ hasText: email }).waitFor();
    await test('PAG: alta real por navegador persiste nombre, cédula, correo y regional', async () => {
      const user = (await api('/admin/users')).users.find((u) => u.email === email);
      assert(user.roles.includes('pag'));
      assert.equal(user.pagCedula, cedula);
      assert.equal(user.pagRegional, 'CUNDINAMARCA');
      const pag = (await api(`/ppl/pag/${cedula}/validar`)).pag;
      assert.equal(pag.correo, email);
      assert.equal(pag.nombre, `PAG QA VERSION ${suffix}`);
      assert.equal(pag.regional, 'CUNDINAMARCA');
      await page.screenshot({ path: path.join(output, 'pag-creado.png'), fullPage: true });
    });
    await test('PAG: cédula duplicada para otro correo rechazada sin modificar original', async () => {
      await api('/admin/users', { method: 'POST', expected: 409, body: { email: extraEmail, name: `PAG OTRO ${suffix}`, roles: ['pag'], pagCedula: cedula, pagRegional: 'META' } });
      assert.equal((await api(`/ppl/pag/${cedula}/validar`)).pag.correo, email);
      assert(!(await api('/admin/users')).users.some((u) => u.email === extraEmail));
    });
    await test('PAG: cédula vacía, ceros iniciales y regional inventada rechazadas por API', async () => {
      for (const patch of [{ pagCedula: '' }, { pagCedula: '0123' }, { pagRegional: 'INEXISTENTE' }]) {
        await api(`/admin/users/${encodeURIComponent(email)}`, { method: 'PATCH', body: patch, expected: 400 });
      }
      assert.equal((await api(`/ppl/pag/${cedula}/validar`)).pag.regional, 'CUNDINAMARCA');
    });
    await test('PAG: cambiar regional y nombre actualiza Oracle y listado', async () => {
      await api(`/admin/users/${encodeURIComponent(email)}`, { method: 'PATCH', body: { pagRegional: 'meta', name: `PAG QA VERSION EDITADO ${suffix}` } });
      assert.equal((await api(`/ppl/pag/${cedula}/validar`)).pag.regional, 'META');
      await api(`/admin/users/${encodeURIComponent(email)}`, { method: 'PATCH', body: { pagRegional: 'CUNDINAMARCA' } });
    });
    await test('PAG: roles del usuario autorizado prevalecen sobre el token previo', async () => {
      assert((await api('/auth/me', { token: pagToken })).user.roles.includes('pag'));
      await api(`/admin/users/${encodeURIComponent(email)}`, { method: 'PATCH', body: { enabled: false } });
      await api('/auth/me', { token: pagToken, expected: 403 });
      await api(`/admin/users/${encodeURIComponent(email)}`, { method: 'PATCH', body: { enabled: true } });
      await api(`/ppl/pag/${cedula}/validar`, { token: pagToken });
      await api(`/admin/users/${encodeURIComponent(email)}`, { method: 'PATCH', body: { roles: ['user'] } });
      await api(`/ppl/pag/${cedula}/validar`, { token: pagToken, expected: 403 });
      await api(`/admin/users/${encodeURIComponent(email)}`, { method: 'PATCH', body: { roles: ['user', 'pag'] } });
    });
    await test('PAG: API rechaza un correo sin formato de correo', async () => {
      await api('/admin/users', { method: 'POST', expected: 400, body: { email: invalidEmail, name: `PAG QA INVALIDO ${suffix}`, roles: ['pag'], pagCedula: String(Number(cedula) + 3), pagRegional: 'CUNDINAMARCA' } });
    });
    await adminSession.context.close();

    // Preparación exclusiva de personas y situaciones sintéticas.
    for (const fixture of fixtures) {
      assert.equal((await sql('SELECT COUNT(*) N FROM DNDP.PERSONA WHERE ID_PERSONA=:id OR NUMERO=:doc', { id: fixture.idPersona, doc: fixture.documento })).rows[0].N, 0);
      await sql('INSERT INTO DNDP.PERSONA (ID_PERSONA, NUMERO, NOMBRE) VALUES (:id,:doc,:name)', { id: fixture.idPersona, doc: fixture.documento, name: fixture.nombre });
      await sql(`INSERT INTO DNDP.SITUACION_CARCELARIA (ID_SITUACION,ID_PERSONA,SITUACION,ACTIVO,DEPARTAMENTO,MUNICIPIO,ESTABLECIMIENTO,ENFOQUE,FUENTE,FECHA_REGISTRO)
        VALUES (:id,:persona,:tipo,1,:dep,:mun,:centro,:enfoque,'PRUEBA',SYSDATE)`,
      { id: fixture.idSituacion, persona: fixture.idPersona, tipo: fixture.tipo, dep: fixture.place.departamento, mun: fixture.place.municipio, centro: fixture.place.centro, enfoque: 'Indígena; Adulto mayor; Migrante' });
    }
    await connection.commit();
    fixtureCommitted = true;
    const dndpSession = await session(dndp, dndpToken);
    const assignmentPage = dndpSession.page;
    await assignmentPage.getByRole('button', { name: 'PAG - Asignación de casos de condenados', exact: true }).click();
    await test('DNDP: módulo accesible sin solicitar cédula ni regional PAG', async () => {
      await assignmentPage.getByText('Acceso DNDP:', { exact: false }).waitFor();
      assert.equal(await assignmentPage.getByPlaceholder('Ingrese cedula de PAG', { exact: true }).count(), 0);
    });
    await assignmentPage.getByRole('button', { name: 'Crear defensor', exact: true }).click();
    await assignmentPage.getByPlaceholder('Ingrese cedula del defensor', { exact: true }).fill(defenders[0].cedula);
    await assignmentPage.getByPlaceholder('Ingrese nombre completo en MAYÚSCULA', { exact: true }).fill(defenders[0].nombre);
    const defenderCreation = assignmentPage.waitForResponse((r) => new URL(r.url()).pathname === '/api/defensores' && r.request().method() === 'POST');
    await assignmentPage.getByRole('button', { name: 'Guardar defensor', exact: true }).click();
    assert.equal((await defenderCreation).status(), 201);
    await test('Defensor: creación real desde navegador y duplicado rechazado', async () => {
      await api('/defensores', { method: 'POST', expected: 409, body: defenders[0] });
      await api('/defensores', { method: 'POST', expected: 201, body: { ...defenders[1], regional: 'CUNDINAMARCA', cedulaPag: cedula } });
    });
    await assignmentPage.getByRole('button', { name: 'Asignación', exact: true }).click();
    await assignmentPage.getByPlaceholder('Filtrar por documento', { exact: true }).fill(fixtures[0].documento);
    await assignmentPage.getByRole('button', { name: 'Filtrar', exact: true }).click();
    await assignmentPage.getByRole('checkbox', { name: `Seleccionar ${fixtures[0].documento}`, exact: true }).check();
    await assignmentPage.getByPlaceholder('Escriba para buscar defensor', { exact: true }).fill(defenders[0].nombre);
    const assigned = assignmentPage.waitForResponse((r) => new URL(r.url()).pathname === '/api/ppl/asignar-defensor' && r.request().method() === 'POST');
    await assignmentPage.getByRole('button', { name: 'GUARDAR ASIGNACIÓN', exact: true }).click();
    assert.equal((await assigned).status(), 200);
    await test('DNDP: asignación desde navegador conserva identidad y una sola asignación activa', async () => {
      const rows = (await sql('SELECT NOMBRE_PAG,CEDULA_PAG,CEDULA_DEFENSOR FROM DNDP.ASIGNACION WHERE ID_PERSONA=:id AND FECHA_FIN IS NULL', { id: fixtures[0].idPersona })).rows;
      assert.equal(rows.length, 1);
      assert(rows[0].NOMBRE_PAG.includes(`DNDP: ${dndp.name}`));
      assert.equal(rows[0].CEDULA_PAG, null);
      assert.equal(String(rows[0].CEDULA_DEFENSOR), defenders[0].cedula);
    });
    await dndpSession.context.close();
    for (const fixture of fixtures.slice(1)) await assign(fixture, fixture === fixtures[6] ? defenders[1] : defenders[0]);
    await test('Asignación: documentos repetidos no crean vínculos ni gestiones adicionales', async () => {
      const before = await stored(fixtures[0]);
      const response = await api('/ppl/asignar-defensor', { token: dndpToken, method: 'POST', body: { documentos: [fixtures[0].documento, fixtures[0].documento], defensorCedula: defenders[0].cedula, pagCedula: '123456789' } });
      assert.equal(response.requested, 1);
      assert.equal(response.asignador.tipo, 'dndp');
      assert.equal((await stored(fixtures[0])).ID_GESTION, before.ID_GESTION);
    });
    await test('Asignación: PAG requiere cédula válida, DNDP requiere documentos y defensor válidos', async () => {
      await api('/ppl/asignar-defensor', { token: pagToken, method: 'POST', expected: 400, body: { documentos: [fixtures[0].documento], defensorCedula: defenders[0].cedula } });
      await api('/ppl/asignar-defensor', { token: dndpToken, method: 'POST', expected: 400, body: { documentos: [], defensorCedula: defenders[0].cedula } });
      await api('/ppl/asignar-defensor', { token: dndpToken, method: 'POST', expected: 404, body: { documentos: [fixtures[0].documento], defensorCedula: '999999999999999999999' } });
    });

    // Formulario real para condenado y sindicado, sin mocks de ficha o guardado.
    const formSession = await session(admin, adminToken);
    const fp = formSession.page;
    for (const fixture of [fixtures[0], fixtures[2]]) {
      const tipo = fixture.tipo;
      const summaryKey = tipo === 'Condenado' ? 'Resumen del análisis del caso' : 'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO';
      await form(fp, fixture);
      await test(`${tipo}: enfoque concatenado y autor de la gestión conservados`, async () => {
        assert.equal(await fp.locator('select[name="Enfoque Étnico/Racial/Cultural"]').inputValue(), 'Indígena; Adulto mayor; Migrante');
        const owner = fp.locator('input[name="Defensor(a) Público(a) Asignado para tramitar la solicitud"]');
        assert.equal(await owner.inputValue(), defenders[0].nombre);
        assert(await owner.isDisabled());
      });
      await test(`${tipo}: guardar análisis persiste en Oracle y al volver a consultar`, async () => {
        await fp.locator('input[name="Fecha de análisis jurídico del caso"]').fill('2026-10-01');
        await fp.locator(`textarea[name="${summaryKey}"]`).fill(`Análisis detallado ${tipo} ${suffix}`);
        await save(fp, fixture);
        assert.equal((await stored(fixture)).RESUMEN_ANALISIS_CASO, `Análisis detallado ${tipo} ${suffix}`);
        assert.equal((await detail(fixture))[summaryKey], `Análisis detallado ${tipo} ${suffix}`);
      });
      await test(`${tipo}: cierre Otro motivo sin explicación devuelve validación 400 y no escribe`, async () => {
        const before = await stored(fixture);
        await api(`/ppl/${fixture.documento}`, { method: 'PUT', body: { rowIndex: before.ID_GESTION, data: { [closureKey]: 'Otro motivo.', [reasonKey]: '   ' } }, expected: 400 });
        assert.equal((await stored(fixture)).CIERRE_CASO, before.CIERRE_CASO);
      });
      await test(`${tipo}: crear actuación con cierre sin explicación devuelve validación 400`, async () => {
        const before = (await sql('SELECT COUNT(*) N FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION=:id', { id: fixture.idSituacion })).rows[0].N;
        await api(`/ppl/${fixture.documento}/actuaciones`, { method: 'POST', body: { data: { [closureKey]: 'Otro motivo.' } }, expected: 400 });
        assert.equal((await sql('SELECT COUNT(*) N FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION=:id', { id: fixture.idSituacion })).rows[0].N, before);
      });
      await test(`${tipo}: cierre incompleto protege borrador y bloquea autoguardado durante 32 segundos`, async () => {
        const saves = [];
        const listener = (r) => { if (r.method() === 'PUT' && new URL(r.url()).pathname === `/api/ppl/${fixture.documento}`) saves.push(r); };
        fp.on('request', listener);
        try {
          await fp.locator(`textarea[name="${summaryKey}"]`).fill(`Borrador protegido ${tipo} ${suffix}`);
          await fp.locator(`select[name="${closureKey}"]`).selectOption('Otro motivo.');
          assert(await fp.locator(`textarea[name="${reasonKey}"]`).isVisible());
          await fp.waitForTimeout(32000);
          assert.equal(saves.length, 0);
          const drafts = await fp.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('aurora.form-draft.v1:')).map((k) => JSON.parse(localStorage.getItem(k))));
          assert(drafts.some((d) => d.documento === fixture.documento && d.data[closureKey] === 'Otro motivo.'));
          assert.notEqual((await stored(fixture)).RESUMEN_ANALISIS_CASO, `Borrador protegido ${tipo} ${suffix}`);
          await fp.screenshot({ path: path.join(output, `borrador-${tipo.toLowerCase()}.png`), fullPage: true });
        } finally { fp.off('request', listener); }
      });
      await test(`${tipo}: explicar el cierre permite guardarlo y la respuesta conserva CASO_CERRADO`, async () => {
        await fp.locator(`textarea[name="${reasonKey}"]`).fill(`Razón específica QA ${suffix}`);
        const saved = await save(fp, fixture);
        assert.equal(saved.registro.estadoCodigo, 'CASO_CERRADO');
        const row = await stored(fixture);
        assert.equal(row.CIERRE_CASO, 'Otro motivo.');
        assert.equal(row.RAZON_CIERRE_CASO, `Razón específica QA ${suffix}`);
        assert.equal(row.RESUMEN_ANALISIS_CASO, `Borrador protegido ${tipo} ${suffix}`);
      });
      await test(`${tipo}: quitar cierre limpia la razón y el autoguardado persiste el siguiente cambio`, async () => {
        await fp.locator(`select[name="${closureKey}"]`).selectOption('-');
        assert.equal(await fp.locator(`textarea[name="${reasonKey}"]`).count(), 0);
        await save(fp, fixture);
        assert.equal((await stored(fixture)).RAZON_CIERRE_CASO, null);
        const pending = fp.waitForResponse((r) => new URL(r.url()).pathname === `/api/ppl/${fixture.documento}` && r.request().method() === 'PUT', { timeout: 45000 });
        await fp.locator(`textarea[name="${summaryKey}"]`).fill(`Autoguardado real ${tipo} ${suffix}`);
        assert.equal((await pending).status(), 200);
        assert.equal((await stored(fixture)).RESUMEN_ANALISIS_CASO, `Autoguardado real ${tipo} ${suffix}`);
      });
    }
    await formSession.context.close();

    // Estado controlado del conjunto para comparar reportes completos y filtrados.
    for (const fixture of fixtures.slice(1, 6)) {
      const current = await stored(fixture);
      await api(`/ppl/${fixture.documento}`, { method: 'PUT', body: { rowIndex: current.ID_GESTION, data: {
        'Fecha de análisis jurídico del caso': '2026-10-01', 'Resumen del análisis del caso': `Reporte QA ${suffix}`,
        ...(fixture === fixtures[3] ? { [closureKey]: 'Otro motivo.', [reasonKey]: `Cierre QA ${suffix}` } : {}),
      } } });
    }
    await sql('UPDATE DNDP.SITUACION_CARCELARIA SET ACTIVO=0 WHERE ID_SITUACION=:id', { id: fixtures[4].idSituacion });
    await connection.commit();
    await test('Fuera de prisión: bloquear escritura sin bloque 5, incluso con permiso en payload', async () => {
      const row = await stored(fixtures[4]);
      await api(`/ppl/${fixtures[4].documento}`, { method: 'PUT', expected: 409, body: { rowIndex: row.ID_GESTION, data: { __bloque5Alcanzado: true, 'Resumen del análisis del caso': 'No debe persistir' } } });
      assert.notEqual((await stored(fixtures[4])).RESUMEN_ANALISIS_CASO, 'No debe persistir');
    });
    await test('Reportes: catálogo relaciona defensor y establecimiento con regional del caso', async () => {
      const options = await api('/reportes/atenciones-defensores/opciones');
      const defender = options.defensores.find((d) => d.id === defenders[0].cedula);
      assert(defender.regionalesCasos.includes('CUNDINAMARCA'));
      assert(defender.regionalesCasos.includes('META'));
      assert.equal(defender.tieneCasosSindicados, true);
      assert(options.establecimientosRegionales.some((e) => e.nombre === 'CPMS GIRARDOT' && e.regional === 'CUNDINAMARCA'));
    });
    await test('Reportes: regional seleccionada aísla casos, incluidos sindicados', async () => {
      const r = await report();
      const expected = [0, 3].map((i) => fixtures[i].idPersona).sort();
      assert.deepEqual(r.detalles.casosAsignados.map((x) => x.idPersona).sort(), expected);
      assert.equal(r.resumen.personasAsignadas, 2);
      assert.equal(r.resumen.personasActivas, 1);
      assert.equal(r.resumen.totalPersonasConCasosCerrados, 1);
      assert.equal(r.resumen.casosAnalizados, 3);
      fs.writeFileSync(path.join(output, 'reporte-global.json'), JSON.stringify(r, null, 2));
    });
    await test('Reportes: fechas cambian actuaciones y conservan los totales globales actuales', async () => {
      const r = await report({ fechaInicio: '2026-10-02' });
      assert.equal(r.resumen.casosAnalizados, 0);
      assert.equal(r.resumen.personasActivas, 1);
      assert.equal(r.resumen.totalPersonasConCasosCerrados, 1);
    });
    await test('Reportes: establecimiento limita también sindicados y excluye los de fuera o sin regional', async () => {
      const r = await report({ lugar: 'CPMS GIRARDOT' });
      assert.deepEqual(r.detalles.casosAsignados.map((x) => x.idPersona).sort(), [fixtures[0].idPersona, fixtures[3].idPersona].sort());
      assert.equal(r.resumen.casosAnalizados, 3);
    });
    await test('Reportes: incluir fuera de prisión agrega solo el fixture inactivo y conserva histórico', async () => {
      const r = await report({ incluirFueraPrision: 'true' });
      assert.equal(r.resumen.personasAsignadas, 3);
      assert.equal(r.resumen.personasFueraPrision, 1);
      assert(r.detalles.casosAsignados.some((x) => x.idPersona === fixtures[4].idPersona));
    });
    await test('Reportes: cambio de regional mantiene solo condenados y sindicados propios', async () => {
      const r = await report({ regional: 'META' });
      assert.deepEqual(r.detalles.casosAsignados.map((x) => x.idPersona).sort(), [1, 5].map((i) => fixtures[i].idPersona).sort());
    });
    await test('Reportes: filtros inválidos y establecimiento ajeno rechazados por API', async () => {
      for (const override of [{ lugar: 'CPMS GRANADA' }, { regional: 'QA INEXISTENTE' }, { fechaInicio: '2026-11-01' }, { fechaInicio: '2026-02-30' }, { tipo: 'inexistente' }, { defensorId: '' }]) await report(override, 400);
    });
    const reportSession = await session(admin, adminToken);
    const rp = reportSession.page;
    await rp.getByRole('button', { name: 'Descargar reporte de atención', exact: true }).click();
    await rp.locator('.report-attentions-form select').selectOption('CUNDINAMARCA');
    await rp.getByPlaceholder('Escriba parte del nombre').fill(defenders[0].nombre);
    await rp.getByLabel('Fecha inicio reporte (obligatoria)', { exact: true }).fill('2026-01-01');
    await rp.getByLabel('Fecha final reporte', { exact: true }).fill('2026-10-27');
    await test('Reportes navegador: cascada regional, ausencia del filtro de tipo y rechazo de establecimiento ajeno', async () => {
      assert.equal(await rp.getByText('Tipo de caso', { exact: true }).count(), 0);
      const centers = await rp.locator('#reporte-establecimientos-list option').evaluateAll((els) => els.map((e) => e.value));
      assert(centers.includes('CPMS GIRARDOT'));
      assert(!centers.includes('CPMS GRANADA'));
      await rp.getByPlaceholder('Todos los ERON de la regional').fill('CPMS GRANADA');
      await rp.getByRole('button', { name: 'Generar reporte', exact: true }).click();
      await rp.getByRole('alert').filter({ hasText: 'Seleccione un ERON' }).waitFor();
      await rp.getByPlaceholder('Todos los ERON de la regional').fill('');
    });
    await test('Reportes navegador: generación real, totales globales y PDF descargable', async () => {
      const pending = rp.waitForResponse((r) => new URL(r.url()).pathname === '/api/reportes/atenciones-defensores');
      await rp.getByRole('button', { name: 'Generar reporte', exact: true }).click();
      assert.equal((await pending).status(), 200);
      await rp.getByRole('button', { name: 'Descargar PDF', exact: true }).waitFor();
      assert((await rp.locator('[aria-label="Totales globales actuales"]').innerText()).includes('Total personas con caso activo'));
      assert((await rp.locator('.report-attentions-scope-note').innerText()).includes('asociados a la regional seleccionada'));
      const download = rp.waitForEvent('download');
      await rp.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
      const file = path.join(output, 'reporte-generado.pdf');
      await (await download).saveAs(file);
      assert(fs.readFileSync(file).subarray(0, 5).equals(Buffer.from('%PDF-')));
      await rp.screenshot({ path: path.join(output, 'reporte-generado.png'), fullPage: true });
      return { pdfBytes: fs.statSync(file).size };
    });
    await test('Reportes navegador: cambiar regional limpia defensor y establecimiento', async () => {
      await rp.getByPlaceholder('Todos los ERON de la regional').fill('CPMS GIRARDOT');
      await rp.locator('.report-attentions-form select').selectOption('META');
      assert.equal(await rp.getByPlaceholder('Todos los ERON de la regional').inputValue(), '');
      assert.equal(await rp.getByPlaceholder('Escriba parte del nombre').inputValue(), '');
    });
    await reportSession.context.close();

    const scenarios = require('../../shared/estado-caso-scenarios.v1.json').scenarios;
    for (const [fixture, stages] of [
      [fixtures[0], [
        'aurora-analisis-positivo-sin-entrevista',
        'aurora-entrevista-completa-sin-radicacion',
        'aurora-tramite-normal-radicado-sin-decision',
        'aurora-decision-negativa-sin-definir-recurso',
        'aurora-recurso-presentado-sin-resultado',
        'aurora-resultado-recurso-diligenciado',
      ]],
      [fixtures[6], [
        'aurora-cierre-automatico-residual-con-utilidad-positiva',
        'aurora-utilidad-avance-parcial-sin-radicacion',
        'aurora-utilidad-radicada-sin-decision',
        'aurora-utilidad-recurso-vacio',
        'aurora-utilidad-recurso-si',
        'aurora-utilidad-recurso-resuelto',
      ]],
      [fixtures[2], [
        'celeste-analisis-positivo-sin-entrevista',
        'celeste-entrevista-completa',
        'celeste-audiencia-solicitada',
        'celeste-audiencia-realizada-sin-decision',
        'celeste-decision-negativa-sin-recurso',
        'celeste-recurso-presentado-sin-resultado',
        'celeste-resultado-recurso-diligenciado',
      ]],
    ]) {
      const previous = await stored(fixture);
      const created = await api(`/ppl/${fixture.documento}/actuaciones`, { method: 'POST', expected: 201, body: { data: {} } });
      const rowIndex = created.actuacion.rowIndex;
      for (const id of stages) {
        const scenario = scenarios.find((item) => item.id === id);
        assert(scenario, `Falta el escenario ${id}`);
        await test(`Ciclo persistido ${id}: ${scenario.expectedCode}`, async () => {
          const data = { ...scenario.answers };
          const owner = 'Defensor(a) Público(a) Asignado para tramitar la solicitud';
          if (Object.hasOwn(data, owner)) data[owner] = fixture === fixtures[6] ? defenders[1].nombre : defenders[0].nombre;
          const updated = await api(`/ppl/${fixture.documento}`, { method: 'PUT', body: { rowIndex, data } });
          assert.equal(updated.registro.estadoCodigo, scenario.expectedCode);
          assert.equal((await detail(fixture)).estadoCodigo, scenario.expectedCode);
          const persisted = (await sql('SELECT * FROM DNDP.GESTION_JURIDICA WHERE ID_GESTION=:id', { id: rowIndex })).rows[0];
          assert.equal(persisted.ID_SITUACION, fixture.idSituacion);
          assert.equal(persisted.DEFENSOR_GESTION, fixture === fixtures[6] ? defenders[1].nombre : defenders[0].nombre);
        });
      }
      await test(`Histórico ${fixture.tipo}: el ciclo nuevo conserva la actuación previa`, async () => {
        const after = (await sql('SELECT * FROM DNDP.GESTION_JURIDICA WHERE ID_GESTION=:id', { id: previous.ID_GESTION })).rows[0];
        assert.deepEqual(after, previous);
      });
    }
    // Revisión de las tres correcciones: estado actual, permisos en caliente y
    // conservación del formulario abierto cuando se elimina su usuario.
    for (const [fixture, scenarioId, opposite] of [
      [fixtures[0], 'aurora-tramite-normal-radicado-sin-decision', 'PENDIENTE_DECISION_AUDIENCIA'],
      [fixtures[2], 'celeste-audiencia-realizada-sin-decision', 'PENDIENTE_DECISION'],
    ]) {
      await test(`Filtro estadoAccion ${fixture.tipo}: código, etiqueta, coincidencia exacta y paginación`, async () => {
        const scenario = scenarios.find((item) => item.id === scenarioId);
        const predecessors = fixture.tipo === 'Condenado'
          ? ['aurora-analisis-positivo-sin-entrevista', 'aurora-entrevista-completa-sin-radicacion', scenarioId]
          : ['celeste-analisis-positivo-sin-entrevista', 'celeste-entrevista-completa', 'celeste-audiencia-solicitada', scenarioId];
        const data = Object.assign({}, ...predecessors.map((id) => scenarios.find((item) => item.id === id).answers));
        data['Defensor(a) Público(a) Asignado para tramitar la solicitud'] = defenders[0].nombre;
        await api(`/ppl/${fixture.documento}/actuaciones`, { method: 'POST', expected: 201, body: { data } });
        const { getEstadoEtiqueta } = require('../domain/estadoCaso');
        for (const value of [scenario.expectedCode, getEstadoEtiqueta(scenario.expectedCode)]) {
          const query = new URLSearchParams({ tipo: 'all', documento: fixture.documento, estadoAccion: value, pageSize: '1' });
          const result = await api(`/ppl/condenados?${query}`);
          assert.equal(result.meta.totalMatched, 1);
          assert.equal(result.rows.length, 1);
          assert.equal(result.rows[0].estadoCodigo, scenario.expectedCode);
          const next = await api(`/ppl/condenados?${query}&page=2`);
          assert.equal(next.meta.totalMatched, 1);
          assert.equal(next.rows.length, 0);
        }
        const mismatch = await api(`/ppl/condenados?${new URLSearchParams({ tipo: 'all', documento: fixture.documento, estadoAccion: opposite })}`);
        assert.equal(mismatch.meta.totalMatched, 0, 'No debe coincidir el prefijo de otro estado');
        const conflict = await api(`/ppl/condenados?${new URLSearchParams({ tipo: 'all', documento: fixture.documento, estadoAccion: scenario.expectedCode, estadoCodigo: 'ANALIZAR_CASO' })}`);
        assert.equal(conflict.meta.totalMatched, 0, 'Los filtros deben intersectarse');
      });
    }
    await test('Filtro estadoAccion: sin asignación prevalece sobre el estado de la atención anterior', async () => {
      await api('/ppl/desasignar-defensor', { token: dndpToken, method: 'POST', body: { documentos: [fixtures[6].documento] } });
      const current = await api(`/ppl/condenados?${new URLSearchParams({ tipo: 'all', documento: fixtures[6].documento, estadoAccion: 'Sin asignación' })}`);
      assert.equal(current.meta.totalMatched, 1);
      assert.equal(current.rows[0].estadoCodigo, 'SIN_ASIGNACION');
      const historical = await api(`/ppl/condenados?${new URLSearchParams({ tipo: 'all', documento: fixtures[6].documento, estadoAccion: 'CASO_CERRADO' })}`);
      assert.equal(historical.meta.totalMatched, 0);
      await assign(fixtures[6], defenders[1]);
    });

    await api('/admin/users', { method: 'POST', expected: 201, body: { email: extraEmail, roles: ['admin', 'dndp', 'carguebd'] } });
    const actorSession = await session(normal, normalToken);
    const actorPage = actorSession.page;
    await form(actorPage, fixtures[1]);
    const summaryKey = 'Resumen del análisis del caso';
    const marker = `Guardado con sesión revocada ${suffix}`;
    const initialRecord = await stored(fixtures[1]);
    await test('Sesión eliminada con formulario abierto: rechaza guardado, conserva borrador y Oracle intacto', async () => {
      await api(`/admin/users/${encodeURIComponent(extraEmail)}`, { method: 'DELETE' });
      await actorPage.locator(`textarea[name="${summaryKey}"]`).fill(marker);
      const pending = actorPage.waitForResponse((response) => new URL(response.url()).pathname === `/api/ppl/${fixtures[1].documento}` && response.request().method() === 'PUT');
      await actorPage.getByRole('button', { name: 'GUARDAR ENTREVISTA', exact: true }).click();
      assert.equal((await pending).status(), 403);
      await actorPage.getByText('No fue posible guardar el registro:', { exact: false }).waitFor();
      const drafts = await actorPage.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('aurora.form-draft.v1:')).map((key) => JSON.parse(localStorage.getItem(key))));
      assert(drafts.some((draft) => draft.documento === fixtures[1].documento && draft.data[summaryKey] === marker));
      assert.equal(await actorPage.locator(`textarea[name="${summaryKey}"]`).inputValue(), marker);
      assert.deepEqual(await stored(fixtures[1]), initialRecord);
    });
    const beforeReport = await report({ regional: 'META' });
    const beforeAssignments = (await sql('SELECT * FROM DNDP.ASIGNACION WHERE ID_PERSONA=:id ORDER BY ID_ASIGNACION', { id: fixtures[1].idPersona })).rows;
    await test('Usuario eliminado: módulos de lectura y escritura rechazan el token sin afectar asignación, gestión o reporte', async () => {
      for (const [route, method, body] of [
        ['/auth/me'], ['/ppl/data-version'], [`/ppl/${fixtures[1].documento}`], [`/ppl/${fixtures[1].documento}/actuaciones`],
        ['/ppl/condenados?tipo=all&documento=' + fixtures[1].documento], ['/ppl/condenados/filter-options'],
        ['/ppl/asignar-defensor', 'POST', { documentos: [fixtures[1].documento], defensorCedula: defenders[1].cedula }],
        ['/ppl/desasignar-defensor', 'POST', { documentos: [fixtures[1].documento] }],
        [`/ppl/${fixtures[1].documento}/actuaciones`, 'POST', { data: {} }],
        ['/reportes/atenciones-defensores?' + new URLSearchParams({ ...baseReport, regional: 'META' })],
        ['/reportes/atenciones-defensores/opciones'], ['/defensores'], ['/defensores', 'POST', { cedula: '', nombre: '' }],
        ['/formatos'], ['/admin/users'], ['/admin/users', 'POST', {}], ['/admin/cargas'], ['/admin/cargas', 'POST', {}],
      ]) await api(route, { method: method || 'GET', body, token: normalToken, expected: 403 });
      assert.deepEqual(await stored(fixtures[1]), initialRecord);
      assert.deepEqual((await sql('SELECT * FROM DNDP.ASIGNACION WHERE ID_PERSONA=:id ORDER BY ID_ASIGNACION', { id: fixtures[1].idPersona })).rows, beforeAssignments);
      const afterReport = await report({ regional: 'META' });
      assert.deepEqual(afterReport.resumen, beforeReport.resumen);
      assert.deepEqual(afterReport.detalles, beforeReport.detalles);
    });
    await test('Reautorizar el mismo correo: permite recuperar el guardado con los roles actuales', async () => {
      await api('/admin/users', { method: 'POST', expected: 201, body: { email: extraEmail, roles: ['user'] } });
      assert.deepEqual((await api('/auth/me', { token: normalToken })).user.roles, ['user']);
      await save(actorPage, fixtures[1]);
      assert.equal((await stored(fixtures[1])).RESUMEN_ANALISIS_CASO, marker);
      assert.equal((await api(`/ppl/${fixtures[1].documento}`, { token: normalToken })).registro[summaryKey], marker);
      await api('/admin/users', { token: normalToken, expected: 403 });
      await api('/ppl/asignar-defensor', { token: normalToken, method: 'POST', body: { documentos: [fixtures[1].documento], defensorCedula: defenders[1].cedula }, expected: 403 });
    });
    await actorSession.context.close();

    const navigation = await session(admin, adminToken);
    await test('Caja de herramientas: catálogo y todos los enlaces de descarga conservan su destino', async () => {
      await navigation.page.getByRole('button', { name: 'Caja de Herramientas', exact: true }).click();
      const formats = await api('/formatos');
      assert(formats.length > 0);
      await navigation.page.locator('.tool-card').first().waitFor();
      assert.equal(await navigation.page.locator('.tool-card').count(), formats.length);
      for (const item of formats) {
        const target = await api(`/formatos/${encodeURIComponent(item.id)}/download-url`);
        assert.equal(new URL(target.downloadUrl).protocol, 'https:');
        const redirect = await apiContext.request.get(`${baseUrl}/api/formatos/${encodeURIComponent(item.id)}/download`, { maxRedirects: 0, headers: { Authorization: `Bearer ${adminToken}` } });
        assert.equal(redirect.status(), 302);
        assert.equal(redirect.headers().location, target.downloadUrl);
      }
      await api('/formatos/qa-inexistente/download-url', { expected: 404 });
      return { formats: formats.length, externalSharepointLoginTested: false };
    });
    await test('Manual: selección de los tres tutoriales y entrega parcial de video', async () => {
      await navigation.page.getByRole('button', { name: 'Manual Interactivo', exact: true }).click();
      const videos = [
        ['Defensor(a) público(a) para condenados', '/tutorial-videos/defensor-publico-condenados-eron.mp4'],
        ['Defensor(a) público(a) en Ley 906', '/tutorial-videos/defensor-publico-ley-906-cdt.mp4'],
        ['PAG de programa condenados', '/tutorial-videos/pag-programa-condenados.mp4'],
      ];
      for (const [title, src] of videos) {
        await navigation.page.getByRole('button', { name: title, exact: false }).click();
        assert.equal(await navigation.page.locator('video').getAttribute('src'), src);
        const response = await apiContext.request.get(`${baseUrl}${src}`, { headers: { Range: 'bytes=0-1023' } });
        assert.equal(response.status(), 206);
        assert.equal((await response.body()).length, 1024);
        assert(response.headers()['content-type'].includes('video/mp4'));
      }
    });
    await test('Cargas: consulta de fuentes, listado y formulario sin ejecutar cargas mensuales', async () => {
      await navigation.page.getByRole('button', { name: 'Cargas mensuales', exact: true }).click();
      await api('/admin/cargas/fuentes');
      await api('/admin/cargas');
      await navigation.page.locator('input[type="file"]').first().waitFor({ state: 'attached' });
      await api('/admin/cargas/qa-inexistente', { expected: 404 });
    });
    await navigation.context.close();
    await test('Navegador: ausencia de errores JavaScript durante todos los flujos', async () => { assert.deepEqual(pageErrors, []); });
  } catch (error) {
    fatalError = error.stack;
    console.log(`FATAL ${error.message}`);
  } finally {
    // Cerrar páginas primero impide que un autoguardado tardío recree datos.
    await browser?.close().catch(() => {});
    try {
      // La limpieza del directorio usa únicamente las identidades de esta ejecución.
      const context = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
      let usersAfter;
      try {
        apiContext = await context.newContext({ ignoreHTTPSErrors: true });
        const users = (await api('/admin/users')).users;
        for (const u of users.filter((u) => [email, extraEmail, invalidEmail].includes(u.email))) await api(`/admin/users/${encodeURIComponent(u.id)}`, { method: 'DELETE' });
        usersAfter = (await api('/admin/users')).users;
        if (fixtureCommitted) {
          for (const fixture of fixtures) {
            await api('/ppl/desasignar-defensor', { token: dndpToken, method: 'POST', body: { documentos: [fixture.documento] }, expected: [200, 409] }).catch(() => {});
          }
        }
      } finally { await context.close(); }
      for (const fixture of fixtures) {
        await sql('DELETE FROM DNDP.CALIFICACION_CONDUCTA WHERE ID_SITUACION=:id', { id: fixture.idSituacion });
        await sql('DELETE FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION=:id', { id: fixture.idSituacion });
        await sql('DELETE FROM DNDP.ASIGNACION WHERE ID_PERSONA=:id', { id: fixture.idPersona });
        await sql('DELETE FROM DNDP.SITUACION_CARCELARIA WHERE ID_SITUACION=:id AND ID_PERSONA=:persona', { id: fixture.idSituacion, persona: fixture.idPersona });
        await sql('DELETE FROM DNDP.PERSONA WHERE ID_PERSONA=:id AND NUMERO=:doc', { id: fixture.idPersona, doc: fixture.documento });
      }
      for (const d of defenders) await sql('DELETE FROM DNDP.DEFENSORES WHERE CEDULA=:c AND NOMBRE=:n', { c: d.cedula, n: d.nombre });
      for (const c of [cedula, String(Number(cedula) + 3)]) await sql('DELETE FROM DNDP.PAG WHERE CEDULA_PAG=:c AND NOMBRE_PAG LIKE :marker', { c, marker: `%${suffix}` });
      await connection.commit();
      for (const fixture of fixtures) {
        const residue = (await sql(`SELECT
          (SELECT COUNT(*) FROM DNDP.PERSONA WHERE ID_PERSONA=:p) P,
          (SELECT COUNT(*) FROM DNDP.SITUACION_CARCELARIA WHERE ID_PERSONA=:p) S,
          (SELECT COUNT(*) FROM DNDP.ASIGNACION WHERE ID_PERSONA=:p) A,
          (SELECT COUNT(*) FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION=:s) G,
          (SELECT COUNT(*) FROM DNDP.CALIFICACION_CONDUCTA WHERE ID_SITUACION=:s) C FROM dual`, { p: fixture.idPersona, s: fixture.idSituacion })).rows[0];
        assert(Object.values(residue).every((n) => n === 0), 'Residuo de datos sintéticos');
      }
      const residue = (await sql(`SELECT (SELECT COUNT(*) FROM DNDP.PAG WHERE CEDULA_PAG IN (:p,:q)) P,
        (SELECT COUNT(*) FROM DNDP.DEFENSORES WHERE CEDULA IN (:a,:b)) D FROM dual`, { p: cedula, q: String(Number(cedula) + 3), a: defenders[0].cedula, b: defenders[1].cedula })).rows[0];
      assert(Object.values(residue).every((n) => n === 0));
      // Una discrepancia del directorio no debe impedir retirar los fixtures
      // Oracle que ya se confirmaron durante la prueba.
      if (baselineUsers) assert.deepEqual(usersAfter, baselineUsers, 'El directorio de usuarios ajenos a la prueba cambió');
      cleanupVerified = true;
      console.log('PASS Limpieza verificada: sin residuos y usuarios anteriores intactos');
    } catch (error) {
      checks.push({ name: 'Limpieza', ok: false, error: error.stack });
      fs.writeFileSync(path.join(output, 'cleanup-fixture.json'), JSON.stringify({ email, extraEmail, invalidEmail, cedula, defenders, fixtures }, null, 2), { mode: 0o600 });
      await connection.rollback().catch(() => {});
    } finally { await connection.close(); }
  }
  const result = { ok: !fatalError && cleanupVerified && checks.every((c) => c.ok), baseUrl, service: config.serviceName, schema,
    passed: checks.filter((c) => c.ok).length, failed: checks.filter((c) => !c.ok).length, cleanupVerified, checks,
    ...(fatalError ? { fatalError } : {}) };
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
  return result;
}

if (require.main === module) {
  if (process.env.RUN_VERSION_BROWSER_INTEGRATION === 'true') run().catch((error) => { console.error(error.stack); process.exitCode = 1; });
  else console.log('SKIP: configure RUN_VERSION_BROWSER_INTEGRATION=true.');
}
module.exports = { run };
