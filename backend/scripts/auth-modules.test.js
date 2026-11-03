const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// HTTP real y routers de la aplicación; las identidades y el almacenamiento
// son exclusivos de la prueba. Ninguna petición denegada debe tocar Oracle.
const previous = { ...process.env };
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-auth-modules-'));
Object.assign(process.env, {
  NODE_ENV: 'test', AUTH_USER_STORE_PATH: path.join(temp, 'users.json'),
  AURORA_CARGAS_DIR: path.join(temp, 'cargas'), AURORA_CARGAS_TMP_DIR: path.join(temp, 'uploads'),
  AUTH_LOCAL_ADMIN_ENABLED: 'false', CARGUEBD_ADMIN_ROLES: 'admin,carguebd,cargas_bd',
});
delete process.env.AUTH_USER_ALLOWLIST_ENABLED;
const express = require('express');
const db = require('../db/oraclePool');
const originalExecute = db.execute;
let oracleCalls = 0;
db.execute = async () => { oracleCalls += 1; throw new Error('Esta prueba no debe consultar Oracle'); };
const { requireAuth } = require('../middleware/auth');
const { signAppToken } = require('../services/authService');
const { upsertManagedUser, updateManagedUser, deleteManagedUser, importManagedUsers } = require('../services/userDirectoryService');
const app = express();
app.use(express.json());
app.use('/api/auth', require('../routes/auth'));
for (const [prefix, file] of [
  ['ppl', 'ppl'], ['defensores', 'defensores'], ['formatos', 'formatos'],
  ['reportes', 'reportes'], ['admin/users', 'adminUsers'], ['admin/cargas', 'adminCargas'],
]) app.use(`/api/${prefix}`, requireAuth, require(`../routes/${file}`));

const routes = [
  ['GET', '/auth/me'], ['GET', '/ppl/data-version'], ['GET', '/ppl'],
  ['GET', '/ppl/condenados'], ['GET', '/ppl/condenados/filter-options'],
  ['GET', '/ppl/condenados/homologation-audit'], ['GET', '/ppl/pag/0/validar'],
  ['GET', '/ppl/0'], ['GET', '/ppl/0/actuaciones'], ['PUT', '/ppl/0'],
  ['POST', '/ppl/0/actuaciones'], ['POST', '/ppl/asignar-defensor'], ['POST', '/ppl/desasignar-defensor'],
  ['GET', '/defensores'], ['POST', '/defensores'],
  ['GET', '/formatos'], ['GET', '/formatos/qa/download-url'], ['GET', '/formatos/qa/download'],
  ['GET', '/reportes/atenciones-defensores/opciones'], ['GET', '/reportes/atenciones-defensores'], ['GET', '/reportes/general'],
  ['GET', '/admin/users'], ['GET', '/admin/users/pag/regionales'],
  ['POST', '/admin/users'], ['PATCH', '/admin/users/qa'], ['DELETE', '/admin/users/qa'],
  ['POST', '/admin/users/import/preview'], ['POST', '/admin/users/import'],
  ['GET', '/admin/cargas/fuentes'], ['GET', '/admin/cargas'], ['GET', '/admin/cargas/qa'],
  ['GET', '/admin/cargas/qa/log'], ['POST', '/admin/cargas'], ['POST', '/admin/cargas/qa/retry'],
  ['GET', '/admin/cargas/actuaciones/preview'], ['DELETE', '/admin/cargas/actuaciones'],
];
const restricted = [
  ['/ppl/asignar-defensor', 'POST', 'PAG_FORBIDDEN'], ['/ppl/desasignar-defensor', 'POST', 'PAG_FORBIDDEN'],
  ['/ppl/pag/0/validar', 'GET', 'PAG_FORBIDDEN'], ['/ppl/condenados/homologation-audit', 'GET', 'PAG_FORBIDDEN'],
  ['/admin/users', 'GET', 'ADMIN_USERS_FORBIDDEN'], ['/admin/users/qa', 'DELETE', 'ADMIN_USERS_FORBIDDEN'],
  ['/admin/cargas', 'POST', 'CARGUEBD_FORBIDDEN'], ['/admin/cargas/actuaciones', 'DELETE', 'CARGUEBD_FORBIDDEN'],
  ['/reportes/general', 'GET', 'ADMIN_REQUIRED'],
];

async function run() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let checks = 0;
  async function request(method, route, token, status, code) {
    const response = await fetch(`${base}${route}`, {
      method, redirect: 'manual', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? { body: '{}' } : {}),
    });
    const data = await response.json();
    assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(data)}`);
    if (code) assert.equal(data.code, code, `${method} ${route}`);
    checks += 1;
    return data;
  }
  async function deniedEverywhere(token, status, code) {
    for (const [method, route] of routes) await request(method, route, token, status, code);
    assert.equal(oracleCalls, 0);
  }
  try {
    await deniedEverywhere('', 401, 'AUTH_REQUIRED');
    await deniedEverywhere('invalid', 401, 'AUTH_INVALID');
    for (const mode of ['open', 'managed']) {
      process.env.AUTH_USER_ACCESS_MODE = mode;
      for (const provider of ['ldap', 'azure-ad']) {
        const email = `matrix.${mode}.${provider}@example.test`;
        const user = upsertManagedUser({ email, enabled: true, roles: ['admin', 'pag', 'dndp', 'carguebd'] });
        const token = signAppToken({ ...user, provider });
        assert((await request('GET', '/auth/me', token, 200)).user.roles.includes('admin'));
        await request('GET', '/formatos', token, 200);
        await request('GET', '/admin/users', token, 200);
        await request('GET', '/admin/cargas/fuentes', token, 200);

        updateManagedUser(user.id, { roles: ['user'] });
        assert.deepEqual((await request('GET', '/auth/me', token, 200)).user.roles, ['user']);
        for (const [route, method, code] of restricted) await request(method, route, token, 403, code);
        await request('GET', '/formatos', token, 200);
        updateManagedUser(user.id, { enabled: false });
        await deniedEverywhere(token, 403, 'AUTH_USER_DISABLED');
        updateManagedUser(user.id, { enabled: true });
        await request('GET', '/auth/me', token, 200);
        deleteManagedUser(user.id);
        // La revocación sobrevive a recargar el módulo y el archivo en disco.
        const directoryPath = require.resolve('../services/userDirectoryService');
        delete require.cache[directoryPath];
        assert.equal(require(directoryPath).findUser({ email }).enabled, false);
        await deniedEverywhere(token, 403, 'AUTH_USER_DISABLED');
        upsertManagedUser({ email, roles: ['user'], enabled: true });
        assert.deepEqual((await request('GET', '/auth/me', token, 200)).user.roles, ['user']);
        await request('GET', '/admin/users', token, 403, 'ADMIN_USERS_FORBIDDEN');
        deleteManagedUser(user.id);
        importManagedUsers([email]);
        assert.deepEqual((await request('GET', '/auth/me', token, 200)).user.roles, ['user']);

        const unknown = signAppToken({ id: `${mode}-${provider}`, email: `unknown.${mode}.${provider}@example.test`, provider, roles: ['user'] });
        if (mode === 'managed') await deniedEverywhere(unknown, 403, 'AUTH_USER_NOT_ALLOWED');
        else await request('GET', '/auth/me', unknown, 200);
      }
    }
    delete process.env.AUTH_USER_ACCESS_MODE;
    process.env.AUTH_USER_ALLOWLIST_ENABLED = 'true';
    await deniedEverywhere(signAppToken({ id: 'legacy', email: 'legacy@example.test', provider: 'ldap', roles: ['admin'] }), 403, 'AUTH_USER_NOT_ALLOWED');
    assert.equal(oracleCalls, 0, 'Los rechazos no deben ejecutar ni lecturas ni escrituras Oracle');
    console.log(JSON.stringify({ suite: 'auth-modules', ok: true, checks, protectedEndpoints: routes.length, providers: ['ldap', 'azure-ad'], modes: ['open', 'managed'], oracleCalls }));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.execute = originalExecute;
    fs.rmSync(temp, { recursive: true, force: true });
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
