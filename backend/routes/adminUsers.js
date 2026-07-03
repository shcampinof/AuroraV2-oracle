const express = require('express');
const { normalizeRoles } = require('../services/authService');
const {
  deleteManagedUser,
  listUsers,
  updateManagedUser,
  upsertManagedUser,
} = require('../services/userDirectoryService');

const router = express.Router();

function hasAdminAccess(user) {
  const roles = normalizeRoles(user?.roles, []);
  return roles.includes('admin');
}

function requireAdmin(req, res, next) {
  if (hasAdminAccess(req.user)) return next();
  return res.status(403).json({
    message: 'No tiene permisos para administrar usuarios.',
    code: 'ADMIN_USERS_FORBIDDEN',
  });
}

function cleanUserPayload(body) {
  return {
    email: String(body?.email || '').trim().toLowerCase(),
    name: String(body?.name || '').trim(),
    roles: Array.isArray(body?.roles) ? body.roles : String(body?.roles || '').split(','),
    enabled: body?.enabled == null ? true : Boolean(body.enabled),
  };
}

function cleanPatchPayload(body) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body || {}, 'email')) {
    patch.email = String(body.email || '').trim().toLowerCase();
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'name')) {
    patch.name = String(body.name || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'roles')) {
    patch.roles = Array.isArray(body.roles) ? body.roles : String(body.roles || '').split(',');
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'enabled')) {
    patch.enabled = Boolean(body.enabled);
  }
  return patch;
}

router.use(requireAdmin);

router.get('/', (_req, res) => {
  res.json({ users: listUsers() });
});

router.post('/', (req, res) => {
  try {
    const user = upsertManagedUser(cleanUserPayload(req.body));
    return res.status(201).json({ user });
  } catch (err) {
    return res.status(Number(err?.status) || 500).json({
      message: String(err?.message || 'No fue posible guardar el usuario.'),
      code: err?.code || 'ADMIN_USER_SAVE_FAILED',
    });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const user = updateManagedUser(req.params.id, cleanPatchPayload(req.body));
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    return res.json({ user });
  } catch (err) {
    return res.status(Number(err?.status) || 500).json({
      message: String(err?.message || 'No fue posible actualizar el usuario.'),
      code: err?.code || 'ADMIN_USER_UPDATE_FAILED',
    });
  }
});

router.delete('/:id', (req, res) => {
  const deleted = deleteManagedUser(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Usuario no encontrado.' });
  return res.json({ ok: true });
});

module.exports = router;
