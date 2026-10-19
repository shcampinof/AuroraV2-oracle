const assert = require('assert/strict');
const { randomInt, randomBytes } = require('crypto');
const path = require('path');
require('dotenv').config({
  path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env'),
  quiet: true,
});

const { getOracleDriver } = require('../db/oraclePool');
const { getOracleConfig, getOracleSchema } = require('../config/oracle');
const { signAppToken } = require('../services/authService');

// Prueba el frontend publicado y sus endpoints reales. Crea exclusivamente
// registros sintéticos, confirma las reasignaciones y elimina el fixture al salir.
// Requiere Playwright instalado aparte y autorización explícita mediante la variable.
async function run() {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
  const baseUrl = String(process.env.PAG_BROWSER_BASE_URL || 'https://127.0.0.1').replace(/\/+$/, '');
  const driver = getOracleDriver();
  const config = getOracleConfig();
  const schema = getOracleSchema();
  const connection = await driver.getConnection({
    user: config.user, password: config.password, connectString: config.connectString,
  });
  const execute = (sql, binds = {}) => connection.execute(
    sql.replace(/\bDNDP\./g, `${schema}.`), binds,
    { outFormat: driver.OUT_FORMAT_OBJECT, autoCommit: false }
  );
  const idPersona = -randomInt(1, 2_000_000_000);
  const idSituacion = -randomInt(1, 2_000_000_000);
  const documento = String(randomInt(9_900_000_000, 9_999_999_990));
  const pagCedula = String(Number(documento) + 1);
  const suffix = [...randomBytes(8)].map((value) => String.fromCharCode(65 + value % 26)).join('');
  const defensores = [
    { cedula: String(Number(documento) + 2), nombre: `PRUEBA REASIGNACION ALFA ${suffix}` },
    { cedula: String(Number(documento) + 3), nombre: `PRUEBA REASIGNACION BETA ${suffix}` },
  ];
  const user = {
    id: `qa-pag-reasignacion-${suffix}`, name: 'QA REASIGNACION PAG',
    email: `qa.reasignacion.${suffix.toLowerCase()}@example.test`,
    provider: 'ldap', roles: ['pag'],
  };
  const token = signAppToken(user);
  const checks = [];
  if (process.env.PAG_BROWSER_VERBOSE === 'true') {
    checks.push = (...items) => { items.forEach(item => console.log(item)); return Array.prototype.push.apply(checks, items); };
  }
  let browser;
  let context;
  let fixtureCommitted = false;
  let primaryError;
  let cleanupError;
  let cacheInvalidationError;
  let assignments = 0;

  async function api(route, body, statuses = [200], method = 'POST') {
    const response = await context.request.fetch(`${baseUrl}/api${route}`, {
      method: body ? method : 'GET',
      headers: { Authorization: `Bearer ${token}` },
      ...(body ? { data: body } : {}),
    });
    assert(statuses.includes(response.status()), `${route}: HTTP ${response.status()}`);
    return response.json();
  }

  try {
    // Lanzar el navegador y validar la sesión antes de confirmar datos de prueba.
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1080 } });
    const me = await api('/auth/me');
    assert.deepEqual(me.user.roles, ['pag']);
    checks.push('sesión con rol PAG sin rol administrador');

    const regional = (await execute(`
      SELECT REGIONAL FROM DNDP.REGIONALES
       WHERE TRIM(REGIONAL) IS NOT NULL ORDER BY REGIONAL FETCH FIRST 1 ROWS ONLY`
    )).rows[0]?.REGIONAL;
    assert(regional, 'Se requiere una regional para el fixture');
    await execute(`INSERT INTO DNDP.PERSONA (ID_PERSONA, NUMERO, NOMBRE)
      VALUES (:idPersona, :documento, :nombre)`,
    { idPersona, documento, nombre: `PRUEBA REASIGNACION ${suffix}` });
    await execute(`INSERT INTO DNDP.SITUACION_CARCELARIA
      (ID_SITUACION, ID_PERSONA, SITUACION, ACTIVO, DEPARTAMENTO, MUNICIPIO, ESTABLECIMIENTO)
      VALUES (:idSituacion, :idPersona, 'Condenado', 1, 'BOGOTA', 'BOGOTA', :centro)`,
    { idSituacion, idPersona, centro: `PRUEBA REASIGNACION ${suffix}` });
    await execute(`INSERT INTO DNDP.PAG (CEDULA_PAG, NOMBRE_PAG, REGIONAL, ENCARGADO)
      VALUES (:cedula, :nombre, :regional, 0)`,
    { cedula: pagCedula, nombre: `PAG PRUEBA ${suffix}`, regional });
    for (const defensor of defensores) {
      await execute(`INSERT INTO DNDP.DEFENSORES (CEDULA, NOMBRE, REGIONAL, CEDULA_PAG)
        VALUES (:cedula, :nombre, :regional, :pagCedula)`, { ...defensor, regional, pagCedula });
    }
    await connection.commit();
    fixtureCommitted = true;

    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    await page.addInitScript(({ token: sessionToken, user: sessionUser }) => {
      localStorage.setItem('aurora.auth.token', sessionToken);
      localStorage.setItem('aurora.auth.user', JSON.stringify(sessionUser));
    }, { token, user });
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Aceptar y continuar', exact: true }).click();
    await page.getByRole('button', { name: 'PAG - Asignación de casos de condenados', exact: true }).click();
    await page.getByPlaceholder('Ingrese cedula de PAG', { exact: true }).fill(pagCedula);
    await page.getByRole('button', { name: 'Validar PAG', exact: true }).click();
    await page.getByText(`PAG validado: PAG PRUEBA ${suffix} (${pagCedula})`, { exact: true }).waitFor();
    checks.push('ingreso al módulo de condenados y validación de PAG');

    async function buscar() {
      await page.getByPlaceholder('Filtrar por documento', { exact: true }).fill(documento);
      const responsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === '/api/ppl/condenados' && url.searchParams.get('documento') === documento;
      });
      await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
      const response = await responsePromise;
      assert.equal(response.status(), 200);
      return response.json();
    }

    async function guardar(defensor, label) {
      await page.getByRole('checkbox', { name: `Seleccionar ${documento}`, exact: true }).check();
      await page.getByPlaceholder('Escriba para buscar defensor', { exact: true }).fill(defensor.nombre);
      const responsePromise = page.waitForResponse((response) =>
        new URL(response.url()).pathname === '/api/ppl/asignar-defensor' && response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: label, exact: true }).click();
      const response = await responsePromise;
      assert.equal(response.status(), 200, `Guardado: HTTP ${response.status()}`);
      const result = await response.json();
      assert.equal(result.updated, 1);
      assert.equal(result.requested, 1);
      assert.equal(result.defensorCedula, defensor.cedula);
      assert.equal(result.defensor, defensor.nombre);
      assignments += 1;
      await page.getByText('Se actualizaron 1 asignación(es) correctamente.', { exact: true }).waitFor();
      await page.locator('.loading-overlay').waitFor({ state: 'hidden' });

      const rows = (await execute(`SELECT ID_ASIGNACION, CEDULA_DEFENSOR, NOMBRE_DEFENSOR,
          CEDULA_PAG, FECHA_FIN, TRUNC(FECHA_ASIGNACION) AS DIA
        FROM DNDP.ASIGNACION WHERE ID_PERSONA = :idPersona ORDER BY ID_ASIGNACION`, { idPersona })).rows;
      assert.equal(rows.length, assignments, 'Debe conservarse el historial completo');
      const active = rows.filter((row) => row.FECHA_FIN === null);
      assert.equal(active.length, 1);
      assert.equal(String(active[0].CEDULA_DEFENSOR), defensor.cedula);
      assert.equal(String(active[0].CEDULA_PAG), pagCedula);
      assert(rows.every((row) => row.DIA.getTime() === rows[0].DIA.getTime()));
      const detail = await api(`/ppl/${documento}`);
      assert.equal(detail.registro.defensorAsignado, defensor.nombre);
      const history = (await api(`/ppl/${documento}/actuaciones`)).actuaciones;
      const expected = [defensores[0], defensores[1], defensores[0], defensores[1]].slice(0, assignments);
      assert.deepEqual(history.map(item => item.registro.defensorGestion), expected.map(item => item.nombre));
      assert(history.every(item => item.registro.__oracleIdAsignacionGestion > 0));
      if (assignments <= 2) {
        const data = {
          'Fecha de análisis jurídico del caso': '2026-10-01',
          'Resumen del análisis del caso': `Análisis del defensor ${assignments}`,
          ...(assignments === 1 ? {
            'Procedencia de libertad condicional': 'Sí cumple requisitos objetivos',
            'Procedencia de prisión domiciliaria de mitad de pena': 'No',
            'Procedencia de pena cumplida': 'No', 'Procedencia de acumulación de penas': 'No',
            'Otras solicitudes a tramitar': 'Ninguna', 'Fecha de entrevista': '2026-10-02',
            'Decisión del usuario': 'Sí desea avanzar', 'Actuación a adelantar': 'Libertad condicional',
            'Requiere pruebas': 'No', 'Poder en caso de avanzar con la solicitud': 'No requiere poder',
          } : {}),
        };
        await api(`/ppl/${documento}`, { rowIndex: history.at(-1).rowIndex, data }, [200], 'PUT');
      }
      checks.push(`${assignments === 1 ? 'asignación inicial' : `reasignación ${assignments - 1}`}: HTTP 200, updated=1, detalle e historial Oracle correctos`);
    }

    assert.equal((await buscar()).rows.length, 1);
    await guardar(defensores[0], 'GUARDAR ASIGNACIÓN');
    await page.getByRole('button', { name: 'Reasignación', exact: true }).click();
    assert.equal((await buscar()).rows.length, 1);
    for (const defensor of [defensores[1], defensores[0], defensores[1]]) {
      await guardar(defensor, 'GUARDAR REASIGNACIÓN');
      await page.locator('tbody').getByText(defensor.nombre, { exact: true }).waitFor();
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Aceptar y continuar', exact: true }).click();
    await page.getByRole('button', { name: 'Reasignación', exact: true }).click();
    await page.getByPlaceholder('Ingrese cedula de PAG', { exact: true }).fill(pagCedula);
    await page.getByRole('button', { name: 'Validar PAG', exact: true }).click();
    await page.getByPlaceholder('Filtrar por documento', { exact: true }).waitFor();
    assert.equal((await buscar()).rows[0].defensorAsignado, defensores[1].nombre);
    await page.locator('tbody').getByText(defensores[1].nombre, { exact: true }).waitFor();
    checks.push('último defensor persistido después de recargar el navegador');
    if (process.env.PAG_BROWSER_SCREENSHOT_PATH) {
      await page.screenshot({ path: process.env.PAG_BROWSER_SCREENSHOT_PATH, fullPage: true });
    }

    await page.getByPlaceholder('Filtrar defensor actual', { exact: true }).fill(defensores[0].nombre);
    assert.equal((await buscar()).rows.length, 0);
    await page.getByPlaceholder('Filtrar defensor actual', { exact: true }).fill(defensores[1].nombre);
    assert.equal((await buscar()).rows.length, 1);
    checks.push('el filtro por defensor anterior excluye el caso; el nuevo defensor lo encuentra');

    const history = (await api(`/ppl/${documento}/actuaciones`)).actuaciones;
    const original = history[0];
    await page.getByRole('button', { name: 'Formulario de atención', exact: true }).click();
    await page.getByPlaceholder('Ingrese Documento', { exact: true }).fill(documento);
    await page.getByRole('button', { name: 'CONSULTAR PPL', exact: true }).click();
    const firstHistoryRow = page.locator('.historial-actuaciones tbody tr').filter({ hasText: 'Análisis del defensor 1' });
    await firstHistoryRow.getByRole('button').click();
    const ownerInput = page.locator('input[name="Defensor(a) Público(a) Asignado para tramitar la solicitud"]');
    assert.equal(await ownerInput.inputValue(), defensores[0].nombre);
    assert.equal(await ownerInput.isDisabled(), true);
    await page.locator('textarea[name="Resumen del análisis del caso"]').fill('Histórico completado desde el navegador');
    const savedResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/ppl/${documento}` && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'GUARDAR ENTREVISTA', exact: true }).click();
    assert.equal((await savedResponse).status(), 200);
    const savedHistory = (await api(`/ppl/${documento}/actuaciones`)).actuaciones;
    assert.equal(savedHistory[0].registro['Resumen del análisis del caso'], 'Histórico completado desde el navegador');
    checks.push('formulario real: muestra el defensor histórico, protege su identidad y guarda sin reasignar');
    // Enviar todo el formulario de una gestión anterior nunca cambia al actual.
    await api(`/ppl/${documento}`, { rowIndex: original.rowIndex, data: {
      ...original.registro,
      'Resumen del análisis del caso': 'Histórico completado después de reasignar',
      'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO': 'Histórico completado después de reasignar',
    } }, [200], 'PUT');
    assert.equal((await api(`/ppl/${documento}`)).registro.defensorActivo, defensores[1].nombre);
    await api(`/ppl/${documento}`, { rowIndex: original.rowIndex, data: { Defensor: defensores[1].nombre } }, [409], 'PUT');
    checks.push('guardar la gestión histórica conserva al autor y la asignación actual; cambiar el autor devuelve 409');

    for (const defensor of defensores) {
      const params = new URLSearchParams({ defensorId: defensor.cedula, regional, fechaInicio: '2025-01-01', fechaFin: '2026-10-19', tipo: 'condenado' });
      const report = await api(`/reportes/atenciones-defensores?${params}`);
      assert.equal(report.detalles.casosAnalizados.filter(item => item.idPersona === idPersona).length, 1);
      assert.equal(report.resumen.personasAsignadas, defensor === defensores[1] ? 1 : 0);
    }
    checks.push('reporte HTTP atribuye un análisis a cada autor y la carga actual solo al último defensor');

    // La libertad se simula únicamente sobre la situación sintética.
    await execute('UPDATE DNDP.SITUACION_CARCELARIA SET ACTIVO = 0 WHERE ID_SITUACION = :idSituacion AND ID_PERSONA = :idPersona', { idSituacion, idPersona });
    await connection.commit();
    const releasedHistory = (await api(`/ppl/${documento}/actuaciones`)).actuaciones;
    assert.equal(releasedHistory[0].registro.__bloque5Alcanzado, true);
    assert.equal(releasedHistory[1].registro.__bloque5Alcanzado, false);
    const closed = await api(`/ppl/${documento}`, { rowIndex: original.rowIndex, data: {
      'Fecha de presentación de la solicitud a la autoridad': '2026-10-03',
      'Defensor(a) Público(a) Asignado para tramitar la solicitud': defensores[0].nombre,
    } }, [200], 'PUT');
    assert.equal(closed.registro.estadoCodigo, 'CASO_CERRADO');
    await api(`/ppl/${documento}`, { rowIndex: history[1].rowIndex, data: {
      'Fecha de presentación de la solicitud a la autoridad': '2026-10-03', __bloque5Alcanzado: true,
    } }, [409], 'PUT');
    await page.getByRole('button', { name: 'CONSULTAR PPL', exact: true }).click();
    await page.getByRole('button', { name: 'Completar gestión', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'GUARDAR ENTREVISTA', exact: true }).isEnabled(), true);
    await page.locator('.historial-actuaciones tbody tr').filter({ hasText: 'Análisis del defensor 2' }).getByRole('button', { name: 'Ver detalle', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'SOLO LECTURA', exact: true }).isDisabled(), true);
    checks.push('libertad: permite completar la gestión que llegó al bloque 5 y rechaza las otras incluso con permiso falsificado');

  } catch (error) {
    primaryError = error;
  } finally {
    try {
      // La desasignación incrementa la versión y evita reutilizar cachés de las
      // reasignaciones probadas. Las eliminaciones posteriores solo afectan al fixture.
      if (fixtureCommitted) {
        await context?.close();
        context = await browser.newContext({ ignoreHTTPSErrors: true });
        try {
          const result = await api('/ppl/desasignar-defensor', { documentos: [documento], pagCedula }, [200, 409]);
          assert([0, 1].includes(result.updated));
        } catch (error) {
          // Un fallo HTTP nunca debe impedir retirar los registros sintéticos.
          cacheInvalidationError = error;
        }
        await execute('DELETE FROM DNDP.CALIFICACION_CONDUCTA WHERE ID_SITUACION = :idSituacion', { idSituacion });
        await execute('DELETE FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION = :idSituacion', { idSituacion });
        await execute('DELETE FROM DNDP.ASIGNACION WHERE ID_PERSONA = :idPersona', { idPersona });
        await execute('DELETE FROM DNDP.SITUACION_CARCELARIA WHERE ID_SITUACION = :idSituacion AND ID_PERSONA = :idPersona', { idSituacion, idPersona });
        await execute('DELETE FROM DNDP.PERSONA WHERE ID_PERSONA = :idPersona', { idPersona });
        for (const defensor of defensores) {
          await execute('DELETE FROM DNDP.DEFENSORES WHERE CEDULA = :cedula AND NOMBRE = :nombre', defensor);
        }
        await execute('DELETE FROM DNDP.PAG WHERE CEDULA_PAG = :cedula AND NOMBRE_PAG = :nombre',
          { cedula: pagCedula, nombre: `PAG PRUEBA ${suffix}` });
        await connection.commit();
        const residue = (await execute(`SELECT
          (SELECT COUNT(*) FROM DNDP.PERSONA WHERE ID_PERSONA=:idPersona) AS PERSONAS,
          (SELECT COUNT(*) FROM DNDP.SITUACION_CARCELARIA WHERE ID_PERSONA=:idPersona) AS SITUACIONES,
          (SELECT COUNT(*) FROM DNDP.ASIGNACION WHERE ID_PERSONA=:idPersona) AS ASIGNACIONES,
          (SELECT COUNT(*) FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION=:idSituacion) AS GESTIONES,
          (SELECT COUNT(*) FROM DNDP.CALIFICACION_CONDUCTA WHERE ID_SITUACION=:idSituacion) AS CALIFICACIONES,
          (SELECT COUNT(*) FROM DNDP.PAG WHERE CEDULA_PAG=:pagCedula) AS PAGS,
          (SELECT COUNT(*) FROM DNDP.DEFENSORES WHERE CEDULA IN (:defensorA,:defensorB)) AS DEFENSORES
          FROM dual`, { idPersona, idSituacion, pagCedula, defensorA: defensores[0].cedula, defensorB: defensores[1].cedula })).rows[0];
        assert(Object.values(residue).every((count) => count === 0), 'Quedaron datos sintéticos sin eliminar');
        checks.push('limpieza verificada: cero personas, situaciones, asignaciones, PAG o defensores de prueba');
      } else {
        await connection.rollback();
      }
    } catch (error) {
      cleanupError = error;
      await connection.rollback().catch(() => {});
    } finally {
      await browser?.close().catch(() => {});
      await connection.close();
    }
  }

  const result = {
    ok: !primaryError && !cleanupError, baseUrl, service: config.serviceName, schema,
    assignments, cleanupVerified: !cleanupError, checks,
    ...(primaryError ? { error: primaryError.message } : {}),
    ...(cacheInvalidationError ? { cacheInvalidationError: cacheInvalidationError.message } : {}),
    ...(cleanupError ? { cleanupError: cleanupError.message, fixture: { idPersona, idSituacion, documento, pagCedula, defensores } } : {}),
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
  return result;
}

if (require.main === module) {
  if (process.env.RUN_PAG_BROWSER_INTEGRATION === 'true') {
    run().catch((error) => { console.error(error.message); process.exitCode = 1; });
  } else {
    console.log('SKIP pag-reasignacion.browser.integration (configure RUN_PAG_BROWSER_INTEGRATION=true)');
  }
}

module.exports = { run };
