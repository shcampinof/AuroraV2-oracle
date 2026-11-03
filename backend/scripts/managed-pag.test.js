const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-managed-pag-'));
  const previousStore = process.env.AUTH_USER_STORE_PATH;
  process.env.AUTH_USER_STORE_PATH = path.join(tempDir, 'users.json');
  const pool = require('../db/oraclePool');
  const originalExecute = pool.execute;
  const catalog = new Map();
  const operations = [];
  let databaseUnavailable = false;
  pool.execute = async (_sql, binds, options) => {
    operations.push(options.operation);
    if (databaseUnavailable) throw new Error('Oracle no disponible');
    if (options.operation === 'pag.listRegionales') return { rows: ['BOYACA', 'CUNDINAMARCA', 'META'].map((REGIONAL) => ({ REGIONAL })) };
    if (options.operation === 'pag.findByCedula') return { rows: [catalog.get(binds.cedula)].filter(Boolean) };
    assert.equal(options.operation, 'pag.saveManagedPag');
    catalog.set(binds.cedula, { CEDULA: binds.cedula, NOMBRE_PAG: binds.nombre, CORREO: binds.correo, REGIONAL: binds.regional });
    return { rowsAffected: 1 };
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { roles: [req.headers['x-test-role'] || 'admin'] }; next(); });
  app.use('/users', require('../routes/adminUsers'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  async function request(method, endpoint, body, role = 'admin') {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/users${endpoint}`, {
      method, headers: { 'Content-Type': 'application/json', 'x-test-role': role },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, ...await response.json() };
  }
  try {
    const payload = { email: 'nuevo@defensoria.gov.co', name: 'Nuevo PAG', roles: ['pag'], pagCedula: '123456', pagRegional: 'BOYACA' };
    assert.equal((await request('POST', '', payload, 'user')).status, 403);
    assert.equal((await request('GET', '/pag/regionales', null, 'user')).status, 403);
    assert.deepEqual((await request('GET', '/pag/regionales')).regionales, ['BOYACA', 'CUNDINAMARCA', 'META']);
    assert.equal(catalog.size, 0);
    assert.equal((await request('POST', '', { ...payload, pagCedula: '' })).status, 400);
    for (const email of ['', 'sin-correo', 'usuario@', '@defensoria.gov.co', 'usuario@@dominio.co',
      'usuario@dominio', 'usuario con espacio@dominio.co', 'usuario@dominio.co\notro']) {
      const previousOperations = operations.length;
      const invalid = await request('POST', '', { ...payload, email });
      assert.equal(invalid.status, 400, email);
      assert.equal(invalid.code, 'ADMIN_USER_PAG_INVALID');
      assert.match(invalid.message, /correo.*formato válido/);
      assert.equal(operations.length, previousOperations, 'Un correo inválido se rechaza antes de consultar o escribir Oracle.');
      assert.equal(catalog.size, 0);
      assert.equal((await request('GET', '')).users.length, 0, 'No se crea el usuario rechazado.');
    }
    const created = await request('POST', '', { ...payload, email: ' NUEVO@DEFENSORIA.GOV.CO ' });
    assert.equal(created.status, 201);
    assert.equal(created.user.pagCedula, '123456');
    const pag = await require('../repositories/oracle/pagRepository').findByCedula('123456');
    assert.equal(pag.correo, payload.email, 'La misma consulta usada al validar PAG debe encontrar la nueva cédula.');
    assert.equal(pag.regional, 'BOYACA');
    const duplicate = await request('POST', '', { ...payload, email: 'otro@defensoria.gov.co' });
    assert.equal(duplicate.status, 409);
    assert.equal((await request('GET', '')).users.length, 1);
    const endpoint = `/${encodeURIComponent(created.user.id)}`;
    for (const email of ['', 'correo-invalido', 'usuario@dominio']) {
      const before = catalog.get('123456');
      const previousOperations = operations.length;
      const invalid = await request('PATCH', endpoint, { email });
      assert.equal(invalid.status, 400);
      assert.equal(invalid.code, 'ADMIN_USER_PAG_INVALID');
      assert.equal(operations.length, previousOperations);
      assert.deepEqual(catalog.get('123456'), before);
      assert.equal((await request('GET', '')).users.find((user) => user.id === created.user.id).email, payload.email);
    }
    const directory = require('../services/userDirectoryService');
    const legacy = directory.upsertManagedUser({ email: 'usuario-legado-sin-correo', roles: ['user'] });
    assert.equal((await request('PATCH', `/${encodeURIComponent(legacy.id)}`, {
      roles: ['pag'], pagCedula: '987654', pagRegional: 'META', name: 'PAG legado',
    })).status, 400, 'Habilitar PAG también valida el correo guardado del usuario.');
    assert(!catalog.has('987654'));
    directory.deleteManagedUser(legacy.id);
    assert.equal((await request('PATCH', endpoint, { pagRegional: 'META' })).status, 200);
    assert.equal(catalog.get('123456').REGIONAL, 'META');
    assert.equal((await request('PATCH', endpoint, { pagRegional: 'REGIONAL INVENTADA' })).status, 400);
    assert.equal(catalog.get('123456').REGIONAL, 'META');
    assert.equal((await request('PATCH', endpoint, { pagRegional: 'cundinamarca' })).user.pagRegional, 'CUNDINAMARCA');
    databaseUnavailable = true;
    const central = await request('POST', '', { email: 'central@defensoria.gov.co', roles: ['dndp'] });
    assert.equal(central.status, 201, 'El rol DNDP se guarda sin cédula, regional ni acceso a Oracle.');
    assert.deepEqual(central.user.roles, ['dndp']);
    assert.equal(central.user.pagCedula, '');
    assert.equal((await request('PATCH', endpoint, { pagCedula: '654321' })).status, 500);
    assert.equal((await request('GET', '')).users.find((user) => user.email === payload.email).pagCedula, '123456', 'Un error Oracle no debe guardar una asociación incompleta.');
    assert.equal((await request('PATCH', endpoint, { enabled: false })).status, 200, 'Deshabilitar no depende de Oracle.');
    directory.syncAzureUser({ id: 'azure-id', email: payload.email, name: payload.name, roles: ['user'] });
    assert.equal(directory.listUsers().find((user) => user.email === payload.email).pagCedula, '123456', 'La asociación sobrevive al siguiente ingreso institucional.');
    console.log('managed-pag.test.js OK');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    pool.execute = originalExecute;
    if (previousStore == null) delete process.env.AUTH_USER_STORE_PATH;
    else process.env.AUTH_USER_STORE_PATH = previousStore;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

run().catch((err) => { console.error(err); process.exitCode = 1; });
