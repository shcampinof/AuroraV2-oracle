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

function requireAssignmentAccess(req, res, next) {
  if (hasRole(req.user, 'consulta') && ['GET', 'HEAD'].includes(req.method)) return next();
  if (hasRole(req.user, 'pag') || hasRole(req.user, 'dndp')) return next();
  return res.status(403).json({
    message: 'No tiene permisos para acceder a la asignación de casos.',
    code: 'PAG_FORBIDDEN',
  });
}

function enforceReadOnlyAccess(req, res, next) {
  if (hasRole(req.user, 'consulta') && req.method && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    // Estas dos rutas validan el permiso vigente por caso antes de escribir.
    const caseWrite = req.baseUrl === '/api/ppl' && (
      (req.method === 'PUT' && /^\/\d+\/?$/.test(req.path)) ||
      (req.method === 'POST' && /^\/\d+\/actuaciones\/?$/.test(req.path))
    );
    if (caseWrite) return next();
    return res.status(403).json({
      message: 'El rol Consulta solo permite modificar casos autorizados desde el formulario. Esta operación no está permitida.',
      code: 'CONSULTA_READ_ONLY',
    });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (hasRole(req.user, 'admin')) return next();
  return res.status(403).json({
    message: 'No tiene permisos para acceder a este recurso.',
    code: 'ADMIN_REQUIRED',
  });
}

module.exports = {
  hasRole,
  requireAdmin,
  requirePag,
  requireAssignmentAccess,
  enforceReadOnlyAccess,
};
