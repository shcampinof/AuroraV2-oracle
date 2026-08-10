const { normalizeRoles } = require('../services/authService');

function hasRole(user, role) {
  const expected = String(role || '').trim().toLowerCase();
  if (!expected) return false;
  return normalizeRoles(user?.roles, []).includes(expected);
}

function requirePag(req, res, next) {
  if (hasRole(req.user, 'pag')) return next();
  return res.status(403).json({
    message: 'No tiene permisos para acceder al módulo PAG.',
    code: 'PAG_FORBIDDEN',
  });
}

module.exports = {
  hasRole,
  requirePag,
};
