const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-consulta-'));
Object.assign(process.env, {
  NODE_ENV: 'test', AUTH_USER_STORE_PATH: path.join(temp, 'users.json'),
  AUTH_USER_ACCESS_MODE: 'managed', AUTH_LOCAL_ADMIN_ENABLED: 'false',
  AURORA_CARGAS_DIR: path.join(temp, 'cargas'), AURORA_CARGAS_TMP_DIR: path.join(temp, 'uploads'),
});
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireAssignmentAccess } = require('../middleware/roles');
const { signAppToken } = require('../services/authService');
const { upsertManagedUser, updateManagedUser } = require('../services/userDirectoryService');
const db = require('../db/oraclePool');
db.execute = async () => { throw new Error('La prueba no debe acceder a Oracle'); };
const consolidado = require('../db/oracleConsolidado.repo');
const personaRepo = require('../repositories/oracle/personaRepository');
const reports = require('../services/reporteAtencionesService');
const pagRepo = require('../repositories/oracle/pagRepository');
let pagLookups = 0;
pagRepo.findByCedula = async () => { pagLookups += 1; throw new Error('Consulta no necesita cédula PAG'); };
const record = { numeroIdentificacion: '123', Nombre: 'USUARIO PRUEBA', __oracleIdSituacion: 41,
  __oracleIdGestion: 17, defensorAsignado: 'DEFENSOR PRUEBA', defensorActivo: 'DEFENSOR PRUEBA',
  defensorGestion: 'DEFENSOR PRUEBA', Defensor: 'DEFENSOR PRUEBA' };
consolidado.getByDocumento = async () => record;
consolidado.getActuacionesByDocumento = async () => [{ id: '123-17', rowIndex: 17, registro: record }];
consolidado.getCierresAutomaticosByDocumento = async () => [];
const summaryRequests = [];
personaRepo.listCondenadosSummary = async (options) => { summaryRequests.push(options); return { rows: [] }; };
personaRepo.countCondenadosSummary = async () => 0;
reports.getReportOptions = async () => ({ regionales: ['META'] });
reports.generateReport = async () => ({ total: 1 });
const app = express();
app.use(express.json());
for (const [prefix, file] of [
  ['ppl', 'ppl'], ['defensores', 'defensores'], ['reportes', 'reportes'],
  ['admin/users', 'adminUsers'], ['admin/cargas', 'adminCargas'],
]) app.use(`/api/${prefix}`, requireAuth, require(`../routes/${file}`));
app.get('/assignment-access', requireAuth, requireAssignmentAccess, (_req, res) => res.json({ ok: true }));
app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message, code: error.code }));
let updates = [];
consolidado.updateByDocumento = async (_doc, payload) => { updates.push(payload); return record; };
consolidado.createActuacionByDocumento = async () => ({ id: '123-18', rowIndex: 18, registro: record });

async function run() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const writes = [
    ['PUT', '/api/ppl/123'], ['POST', '/api/ppl/123/actuaciones'],
    ['POST', '/api/ppl/asignar-defensor'], ['POST', '/api/ppl/desasignar-defensor'],
    ['POST', '/api/defensores'], ['POST', '/api/admin/users'],
    ['PATCH', '/api/admin/users/123'], ['DELETE', '/api/admin/users/123'],
    ['POST', '/api/admin/users/import/preview'], ['POST', '/api/admin/users/import'],
    ['POST', '/api/admin/cargas'], ['POST', '/api/admin/cargas/123/retry'],
    ['DELETE', '/api/admin/cargas/actuaciones'],
  ];
  async function request(token, method, route, payload = {}) {
    const response = await fetch(`${base}${route}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? { body: JSON.stringify(payload) } : {}),
    });
    return { status: response.status, data: await response.json() };
  }
  try {
    for (const provider of ['ldap', 'azure-ad']) {
      const user = upsertManagedUser({ email: `consulta.${provider}@example.test`, roles: ['user'], enabled: true });
      const token = signAppToken({ ...user, provider });
      for (const roles of [['consulta'], ['user', 'consulta'], ['Aurora.Consulta', 'pag', 'dndp', 'admin', 'carguebd']]) {
        // Los permisos vigentes se aplican aun con un token expedido antes de marcar Consulta.
        updateManagedUser(user.id, { roles });
        for (const [method, route] of writes) {
          const result = await request(token, method, route);
          assert.equal(result.status, 403, `${provider} ${roles} ${method} ${route}`);
          assert.equal(result.data.code, route === '/api/ppl/123' || route === '/api/ppl/123/actuaciones'
            ? 'CONSULTA_CASE_FORBIDDEN' : 'CONSULTA_READ_ONLY');
        }
        for (const route of [
          '/api/ppl/condenados?tipo=all&documento=123', '/api/ppl/condenados?tipo=condenado',
          '/api/ppl/123', '/api/ppl/123/actuaciones',
          '/api/reportes/atenciones-defensores/opciones', '/api/reportes/atenciones-defensores',
          '/assignment-access',
        ]) {
          const result = await request(token, 'GET', route);
          assert.equal(result.status, 200, `${route}: ${JSON.stringify(result.data)}`);
        }
      }
      updateManagedUser(user.id, { roles: ['user'] });
      // Al desmarcar el rol se recupera la autorización usual de escritura.
      assert.equal((await request(token, 'PUT', '/api/ppl/123')).status, 200);
      assert.equal((await request(token, 'GET', '/assignment-access')).status, 403);
    }
    const admin = upsertManagedUser({ email: 'admin@example.test', roles: ['admin'] });
    const adminToken = signAppToken({ ...admin, provider: 'azure-ad' });
    const student = upsertManagedUser({ email: 'student@example.test', roles: ['consulta', 'admin', 'dndp'] });
    const studentToken = signAppToken({ ...student, provider: 'azure-ad' });
    const permissionsUrl = `/api/admin/users/${encodeURIComponent(student.id)}/consulta-cases`;
    const grant = { action: 'grant', cases: [{ situacionId: '41', documento: '123' }] };
    assert.equal((await request(studentToken, 'PATCH', permissionsUrl, grant)).status, 403);
    assert.equal((await request(adminToken, 'PATCH', permissionsUrl, {
      ...grant, cases: [{ situacionId: '42', documento: '123' }],
    })).status, 409, 'No se autoriza una situación distinta por compartir documento');
    assert.equal((await request(adminToken, 'PATCH', permissionsUrl, grant)).status, 200);
    assert.equal((await request(studentToken, 'GET', '/api/ppl/condenados?tipo=all&misCasosAutorizados=1')).status, 200);
    assert.deepEqual(summaryRequests.at(-1).filters.consultaSituacionIds, ['41']);
    assert.equal((await request(adminToken, 'GET', permissionsUrl)).data.cases[0].disponible, true);
    assert.equal((await request(studentToken, 'GET', '/api/ppl/123')).data.registro.__consultaPuedeEditar, true);
    assert.equal((await request(studentToken, 'GET', '/api/ppl/123/actuaciones')).data.actuaciones[0].registro.__consultaPuedeEditar, true);
    updates = [];
    assert.equal((await request(studentToken, 'PUT', '/api/ppl/123', {
      rowIndex: 17, data: { Defensor: 'DEFENSOR PRUEBA', 'Resumen del análisis del caso': 'Gestión del colaborador' },
    })).status, 200);
    assert.equal(updates.length, 1);
    assert.equal(Object.hasOwn(updates[0].data, 'Defensor'), false, 'El colaborador no escribe identidades del defensor');
    assert.equal((await request(studentToken, 'POST', '/api/ppl/123/actuaciones', {
      data: { ...record, defensorGestion: '' },
    })).status, 201);
    record.Defensor = '';
    record.defensorGestion = '';
    assert.equal((await request(studentToken, 'PUT', '/api/ppl/123', {
      rowIndex: 17, data: { Defensor: 'DEFENSOR PRUEBA', defensorGestion: '' },
    })).status, 200, 'Un histórico sin autor guardado conserva la lectura del defensor vigente');
    record.Defensor = 'DEFENSOR PRUEBA';
    record.defensorGestion = 'DEFENSOR PRUEBA';
    for (const data of [{ Defensor: 'OTRO' }, { defensorAsignado: 'OTRO' }, { __desasignarDefensor: true }, { PAG: 'OTRO' }]) {
      assert.equal((await request(studentToken, 'PUT', '/api/ppl/123', { data })).status, 403);
    }
    assert.equal((await request(studentToken, 'PUT', '/api/ppl/123', { rowIndex: 99, data: {} })).status, 403);
    record.__oracleIdSituacion = 42;
    assert.equal((await request(studentToken, 'PUT', '/api/ppl/123')).status, 403, 'Una nueva situación no hereda permisos');
    record.__oracleIdSituacion = 41;
    record.defensorActivo = '';
    assert.equal((await request(studentToken, 'PUT', '/api/ppl/123')).status, 403, 'Sin defensor activo no hay edición');
    record.defensorActivo = 'DEFENSOR PRUEBA';
    assert.equal((await request(adminToken, 'PATCH', permissionsUrl, { action: 'revoke', cases: grant.cases })).status, 200);
    assert.equal((await request(studentToken, 'PUT', '/api/ppl/123')).status, 403, 'La revocación se aplica con el mismo token');
    assert.equal((await request(studentToken, 'GET', '/api/ppl/123')).data.registro.__consultaPuedeEditar, false);
    assert.equal((await request(studentToken, 'GET', '/api/ppl/condenados?tipo=all&misCasosAutorizados=1')).status, 200);
    assert.deepEqual(summaryRequests.at(-1).filters.consultaSituacionIds, []);
    await request(adminToken, 'PATCH', permissionsUrl, grant);
    updateManagedUser(student.id, { roles: ['user'] });
    updateManagedUser(student.id, { roles: ['consulta'] });
    assert.equal((await request(studentToken, 'PUT', '/api/ppl/123')).status, 403, 'Quitar Consulta retira sus permisos');
    assert.equal(pagLookups, 0);
    console.log('OK: Consulta mantiene lectura general, edita solo casos autorizados con defensor y respeta revocaciones.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
