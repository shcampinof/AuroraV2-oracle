const { isLocalAdminEnabled, verifyAppToken } = require('../services/authService');
const { findUser } = require('../services/userDirectoryService');

function requireAuth(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({
      message: 'Autenticación requerida.',
      code: 'AUTH_REQUIRED',
    });
  }

  let claims;
  try {
    claims = verifyAppToken(match[1]);
  } catch (err) {
    return res.status(401).json({
      message: 'Sesión vencida o inválida.',
      code: 'AUTH_INVALID',
    });
  }

  const isInstitutionalProvider = claims.provider === 'azure-ad';
  const isAllowedProvider = isInstitutionalProvider || (isLocalAdminEnabled() && claims.provider === 'local');

  if (!isAllowedProvider) {
    return res.status(401).json({
      message: 'Sesión no autorizada.',
      code: 'AUTH_PROVIDER_REQUIRED',
    });
  }

  const tokenUser = {
    id: claims.sub,
    name: claims.name,
    email: claims.email,
    username: claims.username,
    provider: claims.provider,
    roles: Array.isArray(claims.roles) ? claims.roles : [],
  };
  const managedUser = isInstitutionalProvider ? findUser(tokenUser) : null;

  if (managedUser?.enabled === false) {
    return res.status(403).json({
      message: 'Su usuario no se encuentra habilitado para ingresar a AURORA.',
      code: 'AUTH_USER_DISABLED',
    });
  }

  req.user = managedUser
    ? {
        ...tokenUser,
        id: managedUser.id || tokenUser.id,
        name: managedUser.name || tokenUser.name,
        email: managedUser.email || tokenUser.email,
        username: managedUser.username || tokenUser.username,
        roles: managedUser.roles,
      }
    : tokenUser;
  return next();
}

module.exports = {
  requireAuth,
};
