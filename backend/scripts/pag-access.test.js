const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';

const { hasRole, requireAdmin, requirePag, requireAssignmentAccess } = require('../middleware/roles');
const { requireAuth } = require('../middleware/auth');
const { signAppToken } = require('../services/authService');
const { updateManagedUser, upsertManagedUser } = require('../services/userDirectoryService');

assert.equal(hasRole({ roles: ['pag'] }, 'pag'), true);
assert.equal(hasRole({ roles: ['Aurora.PAG'] }, 'pag'), true);
assert.equal(hasRole({ roles: ['admin', 'user'] }, 'pag'), false);

let nextCalled = false;
requirePag({ user: { roles: ['pag'] } }, {}, () => {
  nextCalled = true;
});
assert.equal(nextCalled, true, 'PAG users must be authorized');
for (const role of ['dndp', 'Aurora.DNDP']) {
  let allowed = false;
  requireAssignmentAccess({ user: { roles: [role] } }, {}, () => { allowed = true; });
  assert.equal(allowed, true, 'DNDP accede al módulo sin ser PAG.');
}

let responseStatus = null;
let responseBody = null;
requirePag(
  { user: { roles: ['user'] } },
  {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  },
  () => {
    throw new Error('A regular user must not pass PAG authorization');
  }
);
assert.equal(responseStatus, 403);
assert.equal(responseBody?.code, 'PAG_FORBIDDEN');

nextCalled = false;
requireAdmin({ user: { roles: ['Aurora.Admin'] } }, {}, () => {
  nextCalled = true;
});
assert.equal(nextCalled, true, 'Admin users must be authorized');

responseStatus = null;
responseBody = null;
requireAdmin(
  { user: { roles: ['user'] } },
  {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  },
  () => {
    throw new Error('A regular user must not pass admin authorization');
  }
);
assert.equal(responseStatus, 403);
assert.equal(responseBody?.code, 'ADMIN_REQUIRED');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-pag-access-test-'));
const previousStorePath = process.env.AUTH_USER_STORE_PATH;
process.env.AUTH_USER_STORE_PATH = path.join(tempDir, 'users.json');

try {
  const managedUser = upsertManagedUser({
    id: 'pag-user-id',
    email: 'pag.user@defensoria.gov.co',
    roles: ['user', 'pag'],
    enabled: true,
  });
  const token = signAppToken({
    ...managedUser,
    provider: 'azure-ad',
  });

  function authenticateRequest() {
    const req = { headers: { authorization: `Bearer ${token}` } };
    let status = null;
    let body = null;
    let authenticated = false;
    requireAuth(
      req,
      {
        status(value) {
          status = value;
          return this;
        },
        json(value) {
          body = value;
          return this;
        },
      },
      () => {
        authenticated = true;
      }
    );
    return { req, status, body, authenticated };
  }

  updateManagedUser(managedUser.id, { roles: ['user'] });
  const refreshedRoles = authenticateRequest();
  assert.equal(refreshedRoles.authenticated, true);
  assert.deepEqual(refreshedRoles.req.user.roles, ['user'], 'API authorization must use current managed roles');
  updateManagedUser(managedUser.id, { roles: ['dndp'] });
  const dndpSession = authenticateRequest();
  assert.deepEqual(dndpSession.req.user.roles, ['dndp'], 'El permiso DNDP se obtiene del directorio vigente.');

  updateManagedUser(managedUser.id, { enabled: false });
  const disabled = authenticateRequest();
  assert.equal(disabled.authenticated, false);
  assert.equal(disabled.status, 403);
  assert.equal(disabled.body?.code, 'AUTH_USER_DISABLED');

  updateManagedUser(managedUser.id, { enabled: true, roles: ['user'] });
  const ldapToken = signAppToken({
    ...managedUser,
    provider: 'ldap',
  });
  const ldapRequest = { headers: { authorization: `Bearer ${ldapToken}` } };
  let ldapAuthenticated = false;
  requireAuth(
    ldapRequest,
    {
      status() {
        return this;
      },
      json() {
        return this;
      },
    },
    () => {
      ldapAuthenticated = true;
    }
  );
  assert.equal(ldapAuthenticated, true, 'LDAP sessions must remain valid after successful login');
} finally {
  if (previousStorePath == null) delete process.env.AUTH_USER_STORE_PATH;
  else process.env.AUTH_USER_STORE_PATH = previousStorePath;
  if (previousNodeEnv == null) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  fs.rmSync(tempDir, { recursive: true, force: true });
}

async function testDndpAssignmentRoutes() {
  const express = require('express');
  const consolidado = require('../db/oracleConsolidado.repo');
  const pagRepo = require('../repositories/oracle/pagRepository');
  const defensoresRepo = require('../repositories/oracle/defensoresRepository');
  const originals = { assign: consolidado.assignDefensor, unassign: consolidado.unassignDefensor,
    pag: pagRepo.findByCedula, defensor: defensoresRepo.findByCedula };
  let assignedOptions;
  let pagLookups = 0;
  let assignments = 0;
  let removals = 0;
  consolidado.assignDefensor = async (_docs, _defensor, options) => { assignments += 1; assignedOptions = options; return 1; };
  consolidado.unassignDefensor = async () => { removals += 1; return 1; };
  pagRepo.findByCedula = async (cedula) => { pagLookups += 1; return cedula === '99' ? { cedula: '99', nombre: 'PAG PRUEBA' } : null; };
  defensoresRepo.findByCedula = async () => ({ cedula: '22', nombre: 'DEFENSOR PRUEBA' });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'central', name: 'Usuario central', email: 'central@defensoria.gov.co', roles: [req.headers['x-test-role']] };
    next();
  });
  app.use('/ppl', require('../routes/ppl'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  async function post(route, role, extra = {}) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/ppl/${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-role': role },
      body: JSON.stringify({ documentos: ['123'], defensorCedula: '22', ...extra }),
    });
    return { status: response.status, ...await response.json() };
  }
  try {
    for (const role of ['user', 'admin']) {
      assert.equal((await post('asignar-defensor', role, { roles: ['dndp'] })).status, 403);
      assert.equal((await post('desasignar-defensor', role)).status, 403);
    }
    assert.equal((await post('asignar-defensor', 'pag')).status, 400);
    assert.equal((await post('desasignar-defensor', 'pag')).status, 400);
    assert.equal(assignments, 0);
    const assigned = await post('asignar-defensor', 'dndp', { pagCedula: 'CEDULA AJENA', pagNombre: 'FALSO' });
    assert.equal(assigned.status, 200);
    assert.equal(pagLookups, 0, 'DNDP no consulta ni requiere el catálogo de cédulas PAG.');
    assert.equal(assignedOptions.pagCedula, '');
    assert.match(assignedOptions.pagNombre, /^DNDP: Usuario central \(central@defensoria.gov.co\)$/);
    assert.equal(assigned.pag, null);
    assert.equal(assigned.asignador.tipo, 'dndp');
    assert.equal((await post('desasignar-defensor', 'Aurora.DNDP')).status, 200);
    assert.equal(removals, 1);
    assert.equal(pagLookups, 0);
    assert.equal((await post('asignar-defensor', 'pag', { pagCedula: 'NO EXISTE' })).status, 400);
    assert.equal((await post('asignar-defensor', 'pag', { pagCedula: '99' })).status, 200);
    assert.equal(assignedOptions.pagCedula, '99', 'PAG conserva la validación y el registro de su cédula.');
    assert.equal((await post('desasignar-defensor', 'pag', { pagCedula: '99' })).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    consolidado.assignDefensor = originals.assign;
    consolidado.unassignDefensor = originals.unassign;
    pagRepo.findByCedula = originals.pag;
    defensoresRepo.findByCedula = originals.defensor;
  }
}

testDndpAssignmentRoutes().then(() => console.log('pag-access checks passed')).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
