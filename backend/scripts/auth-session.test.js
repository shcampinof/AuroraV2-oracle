const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const previous = { ...process.env };
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-auth-session-'));
process.env.NODE_ENV = 'test';
process.env.AUTH_USER_STORE_PATH = path.join(temp, 'users.json');
process.env.AUTH_USER_ACCESS_MODE = 'open';
delete process.env.AUTH_USER_ALLOWLIST_ENABLED;

const { requireAuth } = require('../middleware/auth');
const { signAppToken } = require('../services/authService');
const { upsertManagedUser, deleteManagedUser, listUsers, importManagedUsers } = require('../services/userDirectoryService');

function authenticate(token) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  let status;
  let body;
  let allowed = false;
  requireAuth(req, {
    status(value) { status = value; return this; },
    json(value) { body = value; return this; },
  }, () => { allowed = true; });
  return { allowed, status, body, user: req.user };
}

try {
  for (const provider of ['ldap', 'azure-ad']) {
    const email = `session.${provider}@example.test`;
    const user = upsertManagedUser({ email, roles: ['admin', 'pag'], enabled: true });
    const token = signAppToken({ ...user, provider });
    assert.equal(authenticate(token).allowed, true);
    assert.equal(deleteManagedUser(user.id), true);
    assert.equal(listUsers().some((item) => item.email === email), false);
    const deleted = authenticate(token);
    assert.equal(deleted.allowed, false, 'Eliminar un usuario debe revocar también su sesión abierta.');
    assert.equal(deleted.status, 403);

    // Volver a autorizar el correo toma los permisos actuales, no los del token.
    upsertManagedUser({ email, roles: ['user'], enabled: true });
    assert.deepEqual(authenticate(token).user.roles, ['user']);
    deleteManagedUser(user.id);
    assert.equal(importManagedUsers([email]).imported.length, 1);
    assert.deepEqual(authenticate(token).user.roles, ['user']);
  }
  process.env.AUTH_USER_ACCESS_MODE = 'managed';
  for (const provider of ['ldap', 'azure-ad']) {
    const token = signAppToken({ id: 'unknown', email: 'unknown@example.test', provider, roles: ['admin'] });
    const result = authenticate(token);
    assert.equal(result.allowed, false, 'El modo administrado debe comprobar el directorio en cada petición.');
    assert.equal(result.status, 403);
    assert.equal(result.body.code, 'AUTH_USER_NOT_ALLOWED');
  }
  console.log('auth-session: OK (LDAP, Azure, eliminación, reautorización y acceso administrado)');
} finally {
  for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
  Object.assign(process.env, previous);
  fs.rmSync(temp, { recursive: true, force: true });
}
