const { isLocalAdminEnabled, verifyAppToken } = require('../services/authService');

function requireAuth(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({
      message: 'Autenticación requerida.',
      code: 'AUTH_REQUIRED',
    });
  }

  try {
    const claims = verifyAppToken(match[1]);
    const isAllowedProvider = claims.provider === 'azure-ad' || (isLocalAdminEnabled() && claims.provider === 'local');

    if (!isAllowedProvider) {
      return res.status(401).json({
        message: 'Sesión no autorizada.',
        code: 'AUTH_PROVIDER_REQUIRED',
      });
    }

    req.user = {
      id: claims.sub,
      name: claims.name,
      email: claims.email,
      username: claims.username,
      provider: claims.provider,
      roles: Array.isArray(claims.roles) ? claims.roles : [],
    };
    return next();
  } catch (err) {
    return res.status(401).json({
      message: 'Sesión vencida o inválida.',
      code: 'AUTH_INVALID',
    });
  }
}

module.exports = {
  requireAuth,
};
