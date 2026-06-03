const fs = require('fs');
const path = require('path');

const DEFAULT_STORE_PATH = path.join(__dirname, '..', 'storage', 'auth-users.json');

function storePath() {
  return path.resolve(process.env.AUTH_USER_STORE_PATH || DEFAULT_STORE_PATH);
}

function readStore(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.users) ? parsed : { users: [] };
  } catch (err) {
    if (err?.code === 'ENOENT') return { users: [] };
    throw err;
  }
}

function writeStore(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function userMatches(user, profile) {
  const objectId = normalizeKey(profile.azureObjectId || profile.id);
  const email = normalizeKey(profile.email || profile.username);
  return (
    (objectId && normalizeKey(user.azureObjectId || user.id) === objectId) ||
    (email && normalizeKey(user.email || user.username) === email)
  );
}

function syncAzureUser(profile) {
  const now = new Date().toISOString();
  const filePath = storePath();
  const data = readStore(filePath);
  const index = data.users.findIndex((user) => userMatches(user, profile));
  const existing = index >= 0 ? data.users[index] : null;
  const roles = Array.isArray(profile.roles) && profile.roles.length ? profile.roles : existing?.roles || ['user'];

  const record = {
    id: String(profile.id || profile.azureObjectId || profile.email || ''),
    azureObjectId: String(profile.azureObjectId || profile.id || ''),
    tenantId: String(profile.tenantId || ''),
    name: String(profile.name || profile.email || 'Usuario institucional'),
    email: String(profile.email || ''),
    username: String(profile.username || profile.email || ''),
    provider: 'azure-ad',
    roles,
    firstLoginAt: existing?.firstLoginAt || now,
    lastLoginAt: now,
  };

  if (existing) {
    data.users[index] = { ...existing, ...record };
  } else {
    data.users.push(record);
  }

  writeStore(filePath, data);
  return record;
}

module.exports = {
  syncAzureUser,
};
