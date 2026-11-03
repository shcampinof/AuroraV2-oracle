const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomInt } = require('node:crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '../../.env'), quiet: true });
const { signAppToken } = require('../services/authService');
const { getOracleDriver } = require('../db/oraclePool');
const { getOracleConfig, getOracleSchema } = require('../config/oracle');

// Solo una candidata con directorio aislado y un expediente sintético propio.
async function run() {
  const baseUrl = process.env.VERSION_QA_BASE_URL;
  assert(baseUrl, 'Se requiere VERSION_QA_BASE_URL de una candidata aislada');
  assert(process.env.AUTH_JWT_SECRET, 'Se requiere el secreto de la candidata para la sesión vencida de prueba');
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
  const suffix = randomBytes(8).toString('hex');
  const actor = { id: `qa-offline-${suffix}@example.test`, email: `qa-offline-${suffix}@example.test`, provider: 'ldap', roles: ['user'] };
  const token = signAppToken(actor);
  const otherToken = signAppToken({ id: `qa-other-${suffix}`, email: `qa-other-${suffix}@example.test`, provider: 'azure-ad', roles: ['user'] });
  const adminToken = signAppToken({ id: `qa-offline-admin-${suffix}`, email: `qa.offline.admin.${suffix}@example.test`, provider: 'ldap', roles: ['admin', 'dndp'] });
  const driver = getOracleDriver();
  const config = getOracleConfig();
  const schema = getOracleSchema();
  const connection = await driver.getConnection({ user: config.user, password: config.password, connectString: config.connectString });
  const person = -randomInt(1, 2_000_000_000);
  const situation = -randomInt(1, 2_000_000_000);
  const document = String(randomInt(9_700_000_000, 9_799_999_000));
  const defender = String(Number(document) + 1);
  const sql = (query, binds = {}) => connection.execute(query.replaceAll('DNDP.', `${schema}.`), binds, { outFormat: driver.OUT_FORMAT_OBJECT, autoCommit: false });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const apiContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const checks = [];
  let cleanupVerified = false;
  let fixtureCommitted = false;
  let error;
  async function api(method, route, body, expected = 200) {
    const response = await apiContext.request.fetch(`${baseUrl}/api${route}`, { method, headers: { Authorization: `Bearer ${adminToken}` }, ...(body ? { data: body } : {}) });
    const data = await response.json();
    assert.equal(response.status(), expected, `${route}: ${data.message || response.status()}`);
    return data;
  }
  async function stored() {
    return (await sql('SELECT RESUMEN_ANALISIS_CASO FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION=:id ORDER BY ID_GESTION DESC', { id: situation })).rows[0].RESUMEN_ANALISIS_CASO;
  }
  async function until(check) {
    const deadline = Date.now() + 30000;
    while (!(await check())) {
      assert(Date.now() < deadline, 'Tiempo agotado esperando sincronización');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  async function session(controlledOnline = true) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'allow' });
    const page = await context.newPage();
    await page.addInitScript(({ actor: user, token: value, controlledOnline: controlled }) => {
      localStorage.setItem('aurora.auth.token', value);
      localStorage.setItem('aurora.auth.user', JSON.stringify(user));
      if (controlled) window.addEventListener('online', (event) => event.stopImmediatePropagation(), { capture: true });
    }, { actor, token, controlledOnline });
    await page.goto(baseUrl);
    await page.getByRole('button', { name: 'Aceptar y continuar', exact: true }).click();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    return { context, page, worker: context.serviceWorkers()[0] };
  }
  async function credential(page, worker, value) {
    await page.evaluate((value) => {
      if (value) localStorage.setItem('aurora.auth.token', value);
      else localStorage.removeItem('aurora.auth.token');
      navigator.serviceWorker.controller.postMessage({ type: 'AURORA_AUTH_TOKEN', token: value });
    }, value);
    await until(() => worker.evaluate((value) => authHeader === (value ? `Bearer ${value}` : '') && !replayInProgress, value));
  }
  try {
    assert.equal((await sql('SELECT COUNT(*) N FROM DNDP.PERSONA WHERE ID_PERSONA=:id OR NUMERO=:doc', { id: person, doc: document })).rows[0].N, 0);
    await sql('INSERT INTO DNDP.PERSONA (ID_PERSONA,NUMERO,NOMBRE) VALUES (:id,:doc,:name)', { id: person, doc: document, name: `QA OFFLINE ${suffix}` });
    await sql("INSERT INTO DNDP.SITUACION_CARCELARIA (ID_SITUACION,ID_PERSONA,SITUACION,ACTIVO,DEPARTAMENTO,MUNICIPIO,ESTABLECIMIENTO) VALUES (:id,:p,'Condenado',1,'CUNDINAMARCA','GIRARDOT','CPMS GIRARDOT')", { id: situation, p: person });
    await sql("INSERT INTO DNDP.DEFENSORES (CEDULA,NOMBRE,REGIONAL) VALUES (:id,:name,'CUNDINAMARCA')", { id: defender, name: `DEFENSOR QA OFFLINE ${suffix}` });
    await connection.commit();
    fixtureCommitted = true;
    await api('POST', '/ppl/asignar-defensor', { documentos: [document], defensorCedula: defender });
    await api('POST', '/admin/users', { email: actor.email, roles: ['user'] }, 201);
    const rowIndex = (await api('GET', `/ppl/${document}`)).registro.__oracleIdGestion;
    for (const scenario of ['revoked-403', 'expired-session-401']) {
      const { context, page, worker } = await session();
      try {
        const marker = `QA OFFLINE ${scenario} ${suffix}`;
        const before = await stored();
        await context.setOffline(true);
        const queued = await page.evaluate(async ({ token: value, document: doc, rowIndex: row, marker: text }) => {
          const response = await fetch(`/api/ppl/${doc}`, { method: 'PUT', headers: { Authorization: `Bearer ${value}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ rowIndex: row, data: { 'Resumen del análisis del caso': text } }) });
          return { status: response.status, data: await response.json() };
        }, { token, document, rowIndex, marker });
        assert.equal(queued.status, 202);
        assert.equal(await worker.evaluate(async () => (await getQueuedRequests()).length), 1);
        if (scenario === 'revoked-403') await api('DELETE', `/admin/users/${encodeURIComponent(actor.id)}`);
        const replayToken = scenario === 'revoked-403' ? token : jwt.sign({ ...jwt.decode(token), exp: Math.floor(Date.now() / 1000) - 30 }, process.env.AUTH_JWT_SECRET, { algorithm: 'HS256' });
        await credential(page, worker, replayToken);
        await context.setOffline(false);
        await worker.evaluate(async () => { await replayQueuedRequests(); });
        const expectedStatus = scenario === 'revoked-403' ? 403 : 401;
        await until(() => worker.evaluate(() => !replayInProgress));
        const pending = await worker.evaluate(() => getQueuedRequests());
        assert.equal(pending.length, 1);
        assert.equal(pending[0].lastErrorStatus, expectedStatus);
        assert.equal(await stored(), before);
        await page.getByRole('alert').filter({ hasText: 'no se han enviado' }).waitFor();
        checks.push({ name: `${scenario}: retención y aviso`, ok: true, pending: 1, status: expectedStatus, oracleUnchanged: true });
        await credential(page, worker, '');
        assert.equal(await worker.evaluate(async () => (await getQueuedRequests()).length), 1, 'Cerrar sesión conserva el pendiente');
        await credential(page, worker, otherToken);
        assert.equal(await worker.evaluate(async () => (await getQueuedRequests()).length), 1, 'Otra cuenta no elimina el pendiente');
        assert.equal(await stored(), before, 'Otra cuenta no debe reenviar datos ajenos');
        await page.getByRole('alert').filter({ hasText: 'no se han enviado' }).waitFor({ state: 'hidden' });
        checks.push({ name: `${scenario}: cierre de sesión y aislamiento entre cuentas`, ok: true });
        if (scenario === 'revoked-403') await api('POST', '/admin/users', { email: actor.email, roles: ['user'] }, 201);
        await context.setOffline(true);
        await credential(page, worker, signAppToken(actor));
        await context.setOffline(false);
        await page.getByRole('button', { name: 'Reintentar sincronización', exact: true }).click();
        await until(async () => await worker.evaluate(async () => (await getQueuedRequests()).length) === 0 && await stored() === marker);
        checks.push({ name: `${scenario}: recuperación y persistencia real en Oracle`, ok: true, pending: 0, persisted: true });
      } finally { await context.close(); }
    }
    // Camino normal de la aplicación, sin suprimir el evento online: pausa
    // por permisos, salida mediante la UI y recuperación después de recargar.
    const automatic = await session(false);
    try {
      const marker = `QA OFFLINE AUTOMATICO ${suffix}`;
      await automatic.context.setOffline(true);
      const status = await automatic.page.evaluate(async ({ token: value, document: doc, rowIndex: row, marker: text }) => (await fetch(`/api/ppl/${doc}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${value}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: row, data: { 'Resumen del análisis del caso': text } }),
      })).status, { token, document, rowIndex, marker });
      assert.equal(status, 202);
      await api('PATCH', `/admin/users/${encodeURIComponent(actor.id)}`, { enabled: false });
      await automatic.context.setOffline(false);
      await until(() => automatic.worker.evaluate(async () => (await getQueuedRequests())[0]?.lastErrorStatus === 403));
      await automatic.page.getByRole('alert').filter({ hasText: 'no se han enviado' }).waitFor();
      await automatic.page.getByRole('button', { name: 'Salir', exact: true }).click();
      await until(() => automatic.worker.evaluate(() => authHeader === ''));
      assert.equal(await automatic.worker.evaluate(async () => (await getQueuedRequests()).length), 1);
      await api('PATCH', `/admin/users/${encodeURIComponent(actor.id)}`, { enabled: true });
      await automatic.page.reload();
      await until(async () => await automatic.worker.evaluate(async () => (await getQueuedRequests()).length) === 0 && await stored() === marker);
      checks.push({ name: 'Reconexión automática, botón Salir y recarga: retiene y recupera el cambio del mismo usuario en Oracle', ok: true });
    } finally { await automatic.context.close(); }

    await api('PATCH', `/admin/users/${encodeURIComponent(actor.id)}`, { roles: ['user', 'dndp'] });
    const assignment = await session();
    try {
      const before = await stored();
      const active = async () => (await sql('SELECT COUNT(*) N FROM DNDP.ASIGNACION WHERE ID_PERSONA=:id AND FECHA_FIN IS NULL', { id: person })).rows[0].N;
      assert.equal(await active(), 1);
      await assignment.context.setOffline(true);
      const status = await assignment.page.evaluate(async ({ token: value, document: doc }) => (await fetch('/api/ppl/desasignar-defensor', {
        method: 'POST', headers: { Authorization: `Bearer ${value}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentos: [doc] }),
      })).status, { token, document });
      assert.equal(status, 202);
      await api('PATCH', `/admin/users/${encodeURIComponent(actor.id)}`, { roles: ['user'] });
      await assignment.context.setOffline(false);
      await assignment.worker.evaluate(async () => { await replayQueuedRequests(); });
      await until(() => assignment.worker.evaluate(async () => (await getQueuedRequests())[0]?.lastErrorStatus === 403));
      assert.equal(await active(), 1, 'Perder el rol no puede modificar la asignación');
      assert.equal(await stored(), before);
      await assignment.page.getByRole('alert').filter({ hasText: 'no se han enviado' }).waitFor();
      // Retener la primera respuesta real 403 permite restaurar el permiso y
      // solicitar otro intento mientras el envío anterior sigue en curso.
      await assignment.worker.evaluate(() => {
        const originalFetch = globalThis.fetch;
        let hold = true;
        globalThis.qaFetched = false;
        const gate = new Promise((resolve) => { globalThis.qaRelease = resolve; });
        globalThis.fetch = async (...args) => {
          const response = await originalFetch(...args);
          if (hold) { hold = false; globalThis.qaFetched = true; await gate; }
          return response;
        };
      });
      await assignment.page.getByRole('button', { name: 'Reintentar sincronización', exact: true }).click();
      await until(() => assignment.worker.evaluate(() => globalThis.qaFetched && replayInProgress));
      await api('PATCH', `/admin/users/${encodeURIComponent(actor.id)}`, { roles: ['user', 'dndp'] });
      await assignment.page.getByRole('button', { name: 'Reintentar sincronización', exact: true }).click();
      await until(() => assignment.worker.evaluate(() => replayRequested));
      await assignment.worker.evaluate(() => globalThis.qaRelease());
      await until(async () => await assignment.worker.evaluate(async () => (await getQueuedRequests()).length) === 0 && await active() === 0);
      const original = (await sql('SELECT RESUMEN_ANALISIS_CASO FROM DNDP.GESTION_JURIDICA WHERE ID_GESTION=:id', { id: rowIndex })).rows[0];
      assert.equal(original.RESUMEN_ANALISIS_CASO, before, 'La desasignación conserva la gestión histórica; la nueva gestión sin asignación queda vacía');
      checks.push({ name: 'POST de asignaciones: retirar y restaurar rol conserva el pendiente y solo ejecuta la desasignación con permiso vigente', ok: true });
    } finally { await assignment.context.close(); }

    const { context, worker } = await session();
    try {
      await context.setOffline(true);
      const limits = await worker.evaluate(async ({ token: value, baseUrl: base }) => {
        const request = (index, data) => new Request(`${base}/api/ppl/0`, { method: 'PUT', headers: { Authorization: `Bearer ${value}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ rowIndex: index, data }) });
        for (let index = 1; index <= 75; index += 1) await queueRequest(request(index, { original: index }));
        const before = await getQueuedRequests();
        let rejected = false;
        try { await queueRequest(request(76, { overflow: true })); } catch { rejected = true; }
        const after = await getQueuedRequests();
        await queueRequest(request(1, { newer: true }));
        const coalesced = await getQueuedRequests();
        const merged = JSON.parse(coalesced.find((row) => JSON.parse(row.body).rowIndex === 1).body).data;
        await runQueueStore('readwrite', (store) => store.delete(coalesced.at(-1).id));
        const retainedIds = (await getQueuedRequests()).map((row) => row.id);
        const concurrent = await Promise.allSettled([queueRequest(request(80, { concurrent: 80 })), queueRequest(request(81, { concurrent: 81 }))]);
        const final = await getQueuedRequests();
        return { rejected, beforeIds: before.map((row) => row.id), afterIds: after.map((row) => row.id), size: coalesced.length, merged,
          concurrentStatuses: concurrent.map((result) => result.status).sort(), concurrentSize: final.length,
          retainedAll: retainedIds.every((id) => final.some((row) => row.id === id)) };
      }, { token, baseUrl });
      assert(limits.rejected);
      assert.deepEqual(limits.afterIds, limits.beforeIds);
      assert.equal(limits.size, 75);
      assert.deepEqual(limits.merged, { original: 1, newer: true });
      assert.deepEqual(limits.concurrentStatuses, ['fulfilled', 'rejected']);
      assert.equal(limits.concurrentSize, 75);
      assert.equal(limits.retainedAll, true);
      checks.push({ name: 'Límite de cola y compactación: conserva 75 anteriores, rechaza exceso y combina cambios de la misma actuación', ok: true });
    } finally { await context.close(); }
  } catch (failure) { error = failure.stack; }
  finally {
    try {
      await api('DELETE', `/admin/users/${encodeURIComponent(actor.id)}`).catch(() => {});
      if (fixtureCommitted) {
        await api('POST', '/ppl/desasignar-defensor', { documentos: [document] }).catch(() => {});
        await sql('DELETE FROM DNDP.CALIFICACION_CONDUCTA WHERE ID_SITUACION=:id', { id: situation });
        await sql('DELETE FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION=:id', { id: situation });
        await sql('DELETE FROM DNDP.ASIGNACION WHERE ID_PERSONA=:id', { id: person });
        await sql('DELETE FROM DNDP.SITUACION_CARCELARIA WHERE ID_PERSONA=:id', { id: person });
        await sql('DELETE FROM DNDP.PERSONA WHERE ID_PERSONA=:id AND NUMERO=:doc', { id: person, doc: document });
        await sql('DELETE FROM DNDP.DEFENSORES WHERE CEDULA=:id AND NOMBRE=:name', { id: defender, name: `DEFENSOR QA OFFLINE ${suffix}` });
        await connection.commit();
      } else await connection.rollback();
      const residue = (await sql(`SELECT (SELECT COUNT(*) FROM DNDP.PERSONA WHERE ID_PERSONA=:p) P,
        (SELECT COUNT(*) FROM DNDP.SITUACION_CARCELARIA WHERE ID_PERSONA=:p) S,
        (SELECT COUNT(*) FROM DNDP.ASIGNACION WHERE ID_PERSONA=:p) A,
        (SELECT COUNT(*) FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION=:s) G,
        (SELECT COUNT(*) FROM DNDP.DEFENSORES WHERE CEDULA=:d) D FROM dual`, { p: person, s: situation, d: defender })).rows[0];
      assert(Object.values(residue).every((count) => count === 0));
      cleanupVerified = true;
    } catch (failure) { error = `${error || ''}\nLimpieza: ${failure.stack}`; }
    await browser.close();
    await connection.close();
  }
  const result = { suite: 'offline-auth', ok: !error && cleanupVerified && checks.length === 9, checks, cleanupVerified, ...(error ? { error } : {}) };
  const output = process.env.VERSION_QA_OUTPUT || '/tmp/aurora-regresion-20261030-offline-final';
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
if (require.main === module) {
  if (process.env.RUN_VERSION_BROWSER_INTEGRATION === 'true') run().catch((error) => { console.error(error); process.exitCode = 1; });
  else console.log('SKIP: configure RUN_VERSION_BROWSER_INTEGRATION=true y VERSION_QA_BASE_URL.');
}
module.exports = { run };
