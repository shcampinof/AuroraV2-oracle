const assert = require('assert/strict');
const { randomInt, randomBytes } = require('crypto');
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '..', '.env'), quiet: true });
const { getOracleDriver } = require('../db/oraclePool');
const { getOracleConfig, getOracleSchema } = require('../config/oracle');
const { signAppToken } = require('../services/authService');

// Comprueba API y pantalla con un traslado sintético; elimina todos sus datos al salir.
async function run() {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
  const baseUrl = String(process.env.CIERRE_BROWSER_BASE_URL || 'https://127.0.0.1').replace(/\/+$/, '');
  const driver = getOracleDriver();
  const config = getOracleConfig();
  const schema = getOracleSchema();
  const connection = await driver.getConnection({ user: config.user, password: config.password, connectString: config.connectString });
  const execute = (sql, binds = {}) => connection.execute(sql.replace(/\bDNDP\./g, `${schema}.`), binds,
    { outFormat: driver.OUT_FORMAT_OBJECT, autoCommit: false });
  const idPersona = -randomInt(1, 2_000_000_000);
  const oldSituation = -randomInt(1, 1_000_000_000);
  const newSituation = oldSituation - 1_000_000_000;
  const idGestion = -randomInt(1, 2_000_000_000);
  const idAsignacion = -randomInt(1, 2_000_000_000);
  const documento = String(randomInt(9_900_000_000, 9_999_999_990));
  const suffix = randomBytes(6).toString('hex').toUpperCase();
  const defensor = `DEFENSORA ANTERIOR QA ${suffix}`;
  const oldEron = `ERON ANTERIOR QA ${suffix}`;
  const motivo = 'Cierre automático por cambio de regional.';
  const user = { id: `qa-cierre-${suffix}`, name: 'QA CIERRE ERON', email: `qa.cierre.${suffix.toLowerCase()}@example.test`, provider: 'ldap', roles: ['pag'] };
  const token = signAppToken(user);
  let browser;
  let committed = false;
  let primaryError;
  let cleanupError;
  const checks = [];
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1080 } });
    async function api(route) {
      const response = await context.request.get(`${baseUrl}/api${route}`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status(), 200, `${route}: HTTP ${response.status()}`);
      return response.json();
    }
    assert.deepEqual((await api('/auth/me')).user.roles, ['pag']);
    await execute('INSERT INTO DNDP.PERSONA (ID_PERSONA, NUMERO, NOMBRE) VALUES (:idPersona, :documento, :nombre)',
      { idPersona, documento, nombre: `PRUEBA CIERRE ERON ${suffix}` });
    for (const situation of [
      { idSituacion: oldSituation, activo: 0, eron: oldEron, departamento: 'CUNDINAMARCA', fecha: '2026-10-10' },
      { idSituacion: newSituation, activo: 1, eron: `ERON ACTUAL QA ${suffix}`, departamento: 'BOGOTA', fecha: '2026-10-19' },
    ]) {
      await execute(`INSERT INTO DNDP.SITUACION_CARCELARIA
        (ID_SITUACION, ID_PERSONA, SITUACION, ACTIVO, DEPARTAMENTO, MUNICIPIO, ESTABLECIMIENTO, FECHA_REGISTRO, FECHA_CORTE)
        VALUES (:idSituacion, :idPersona, 'Condenado', :activo, :departamento, 'BOGOTA', :eron,
          TO_DATE(:fecha, 'YYYY-MM-DD'), TO_DATE(:fecha, 'YYYY-MM-DD'))`, { ...situation, idPersona });
    }
    await execute(`INSERT INTO DNDP.ASIGNACION (ID_ASIGNACION, ID_PERSONA, NOMBRE_DEFENSOR, FECHA_ASIGNACION, FECHA_FIN)
      VALUES (:idAsignacion, :idPersona, :defensor, DATE '2026-10-01', DATE '2026-10-19')`, { idAsignacion, idPersona, defensor });
    await execute(`INSERT INTO DNDP.GESTION_JURIDICA
      (ID_GESTION, ID_SITUACION, ID_ASIGNACION_GESTION, DEFENSOR_GESTION, CIERRE_CASO, FECHA_REGISTRO)
      VALUES (:idGestion, :oldSituation, :idAsignacion, :defensor, :motivo, DATE '2026-10-01')`,
    { idGestion, oldSituation, idAsignacion, defensor, motivo });
    await connection.commit();
    committed = true;

    const history = await api(`/ppl/${documento}/actuaciones`);
    assert.equal(history.actuaciones.length, 0, 'La situación activa no tiene actuaciones anteriores');
    assert.deepEqual(history.cierresAutomaticos, [{ idGestion, idSituacion: oldSituation, motivo, defensor,
      establecimiento: oldEron, departamento: 'CUNDINAMARCA', fechaCierre: '2026-10-19' }]);
    checks.push('API: recupera el cierre de la situación anterior, con su defensor y fecha originales');

    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.addInitScript(({ token: authToken, user: authUser }) => {
      localStorage.setItem('aurora.auth.token', authToken);
      localStorage.setItem('aurora.auth.user', JSON.stringify(authUser));
    }, { token, user });
    page.on('dialog', dialog => dialog.accept());
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Aceptar y continuar', exact: true }).click();
    await page.getByRole('button', { name: 'Formulario de atención', exact: true }).click();
    await page.getByPlaceholder('Ingrese Documento', { exact: true }).fill(documento);
    await page.getByRole('button', { name: 'CONSULTAR PPL', exact: true }).click();
    const card = page.locator('.historial-cierre-automatico');
    await card.waitFor({ state: 'visible' });
    const text = await card.innerText();
    for (const expected of [motivo, defensor, oldEron, '19/10/2026']) assert(text.includes(expected), expected);
    assert.equal(await card.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(242, 247, 252)');
    checks.push('Navegador: historial muestra motivo, defensor anterior, ERON y fecha en azul');
    if (process.env.CIERRE_BROWSER_SCREENSHOT) await page.screenshot({ path: process.env.CIERRE_BROWSER_SCREENSHOT, fullPage: true });
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      if (!committed) await connection.rollback();
      else {
        await execute('DELETE FROM DNDP.CALIFICACION_CONDUCTA WHERE ID_SITUACION IN (:oldSituation, :newSituation)', { oldSituation, newSituation });
        await execute('DELETE FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION IN (:oldSituation, :newSituation)', { oldSituation, newSituation });
        await execute('DELETE FROM DNDP.ASIGNACION WHERE ID_PERSONA = :idPersona', { idPersona });
        await execute('DELETE FROM DNDP.SITUACION_CARCELARIA WHERE ID_PERSONA = :idPersona', { idPersona });
        await execute('DELETE FROM DNDP.PERSONA WHERE ID_PERSONA = :idPersona', { idPersona });
        await connection.commit();
        assert.equal((await execute('SELECT COUNT(*) TOTAL FROM DNDP.PERSONA WHERE ID_PERSONA = :idPersona', { idPersona })).rows[0].TOTAL, 0);
      }
    } catch (error) { cleanupError = error; }
    await browser?.close();
    await connection.close();
  }
  console.log(JSON.stringify({ ok: !primaryError && !cleanupError, baseUrl, cleanupVerified: !cleanupError, checks,
    ...(primaryError ? { error: primaryError.message } : {}),
    ...(cleanupError ? { cleanupError: cleanupError.message, fixture: { idPersona, documento, oldSituation, newSituation, idGestion, idAsignacion } } : {}),
  }, null, 2));
  if (primaryError || cleanupError) process.exitCode = 1;
}

if (require.main === module) {
  if (process.env.RUN_CIERRE_BROWSER_INTEGRATION === 'true') run().catch(error => { console.error(error.message); process.exitCode = 1; });
  else console.log('SKIP: configure RUN_CIERRE_BROWSER_INTEGRATION=true.');
}
module.exports = { run };
