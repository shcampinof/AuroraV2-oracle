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

function normalizeRoles(roles, fallback = ['user']) {
  const input = Array.isArray(roles)
    ? roles
    : String(roles || '')
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean);
  const normalized = Array.from(
    input.reduce((set, role) => {
      const raw = String(role || '').trim().toLowerCase();
      if (!raw) return set;
      set.add(raw);
      if (raw === 'aurora.admin' || raw === 'administrator' || raw === 'administrador') set.add('admin');
      if (raw === 'aurora.user' || raw === 'usuario') set.add('user');
      const dotIndex = raw.lastIndexOf('.');
      if (dotIndex >= 0 && dotIndex < raw.length - 1) set.add(raw.slice(dotIndex + 1));
      return set;
    }, new Set())
  );
  return normalized.length ? normalized : fallback;
}

function userMatches(user, profile) {
  const objectId = normalizeKey(profile.azureObjectId || profile.id);
  const email = normalizeKey(profile.email || profile.username);
  return (
    (objectId && normalizeKey(user.azureObjectId || user.id) === objectId) ||
    (email && normalizeKey(user.email || user.username) === email)
  );
}

function publicUser(user) {
  return {
    id: String(user.id || user.azureObjectId || user.email || ''),
    azureObjectId: String(user.azureObjectId || ''),
    tenantId: String(user.tenantId || ''),
    name: String(user.name || user.email || ''),
    email: String(user.email || ''),
    username: String(user.username || user.email || ''),
    provider: String(user.provider || 'azure-ad'),
    roles: normalizeRoles(user.roles),
    enabled: user.enabled !== false,
    firstLoginAt: user.firstLoginAt || null,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || user.firstLoginAt || null,
    updatedAt: user.updatedAt || null,
  };
}

function listUsers() {
  const filePath = storePath();
  const data = readStore(filePath);
  return data.users.map(publicUser).sort((a, b) => a.email.localeCompare(b.email));
}

function findUser(profile) {
  const filePath = storePath();
  const data = readStore(filePath);
  const found = data.users.find((user) => userMatches(user, profile));
  return found ? publicUser(found) : null;
}

function upsertManagedUser(profile) {
  const now = new Date().toISOString();
  const email = normalizeKey(profile.email || profile.username);
  if (!email) {
    const err = new Error('El correo institucional es obligatorio.');
    err.status = 400;
    throw err;
  }

  const filePath = storePath();
  const data = readStore(filePath);
  const index = data.users.findIndex((user) => userMatches(user, { ...profile, email }));
  const existing = index >= 0 ? data.users[index] : null;
  const record = {
    ...(existing || {}),
    id: String(existing?.id || profile.id || profile.azureObjectId || email),
    azureObjectId: String(profile.azureObjectId || existing?.azureObjectId || ''),
    tenantId: String(profile.tenantId || existing?.tenantId || ''),
    name: String(profile.name || existing?.name || email),
    email,
    username: String(profile.username || existing?.username || email),
    provider: 'azure-ad',
    roles: normalizeRoles(profile.roles || existing?.roles),
    enabled: profile.enabled == null ? existing?.enabled !== false : Boolean(profile.enabled),
    firstLoginAt: existing?.firstLoginAt || null,
    lastLoginAt: existing?.lastLoginAt || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (existing) data.users[index] = record;
  else data.users.push(record);
  writeStore(filePath, data);
  return publicUser(record);
}

function updateManagedUser(id, patch) {
  const key = normalizeKey(id);
  const filePath = storePath();
  const data = readStore(filePath);
  const index = data.users.findIndex((user) => {
    return [user.id, user.azureObjectId, user.email, user.username].some((value) => normalizeKey(value) === key);
  });
  if (index < 0) return null;

  const existing = data.users[index];
  const next = {
    ...existing,
    updatedAt: new Date().toISOString(),
  };
  if (patch.name != null) next.name = String(patch.name || existing.email || '').trim();
  if (patch.email != null) {
    const email = normalizeKey(patch.email);
    if (!email) {
      const err = new Error('El correo institucional es obligatorio.');
      err.status = 400;
      throw err;
    }
    next.email = email;
    next.username = email;
  }
  if (patch.roles != null) next.roles = normalizeRoles(patch.roles);
  if (patch.enabled != null) next.enabled = Boolean(patch.enabled);

  data.users[index] = next;
  writeStore(filePath, data);
  return publicUser(next);
}

function deleteManagedUser(id) {
  const key = normalizeKey(id);
  const filePath = storePath();
  const data = readStore(filePath);
  const nextUsers = data.users.filter((user) => {
    return ![user.id, user.azureObjectId, user.email, user.username].some((value) => normalizeKey(value) === key);
  });
  if (nextUsers.length === data.users.length) return false;
  writeStore(filePath, { ...data, users: nextUsers });
  return true;
}

function syncAzureUser(profile) {
  const now = new Date().toISOString();
  const filePath = storePath();
  const data = readStore(filePath);
  const index = data.users.findIndex((user) => userMatches(user, profile));
  const existing = index >= 0 ? data.users[index] : null;
  const roles = Array.isArray(existing?.roles) && existing.roles.length ? existing.roles : normalizeRoles(profile.roles);

  const record = {
    id: String(profile.id || profile.azureObjectId || profile.email || ''),
    azureObjectId: String(profile.azureObjectId || profile.id || ''),
    tenantId: String(profile.tenantId || ''),
    name: String(profile.name || profile.email || 'Usuario institucional'),
    email: String(profile.email || ''),
    username: String(profile.username || profile.email || ''),
    provider: String(profile.provider || 'azure-ad'),
    roles,
    enabled: existing?.enabled !== false,
    firstLoginAt: existing?.firstLoginAt || now,
    lastLoginAt: now,
    createdAt: existing?.createdAt || existing?.firstLoginAt || now,
    updatedAt: now,
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
  deleteManagedUser,
  findUser,
  listUsers,
  syncAzureUser,
  updateManagedUser,
  upsertManagedUser,
};
