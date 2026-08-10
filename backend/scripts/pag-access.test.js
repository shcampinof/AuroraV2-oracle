const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';

const { hasRole, requirePag } = require('../middleware/roles');
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

  updateManagedUser(managedUser.id, { enabled: false });
  const disabled = authenticateRequest();
  assert.equal(disabled.authenticated, false);
  assert.equal(disabled.status, 403);
  assert.equal(disabled.body?.code, 'AUTH_USER_DISABLED');
} finally {
  if (previousStorePath == null) delete process.env.AUTH_USER_STORE_PATH;
  else process.env.AUTH_USER_STORE_PATH = previousStorePath;
  if (previousNodeEnv == null) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('pag-access checks passed');
