const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  authenticateAzureAdToken,
  authenticateLocal,
  getAzureAdConfig,
  isLocalAdminEnabled,
  isAzureAdConfigured,
  signAppToken,
} = require('../services/authService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Demasiados intentos de autenticación. Intente nuevamente más tarde.',
    code: 'AUTH_RATE_LIMITED',
  },
});

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    provider: user.provider,
    roles: user.roles || [],
  };
}

router.get('/config', (_req, res) => {
  const azureAd = getAzureAdConfig();
  res.json({
    localAdminEnabled: isLocalAdminEnabled(),
    azureAd: {
      enabled: isAzureAdConfigured(),
      tenantId: azureAd.tenantId || null,
      clientId: azureAd.clientId || null,
    },
  });
});

router.post('/login', loginLimiter, (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();
    const remember = Boolean(req.body?.remember);
    const user = authenticateLocal(username, password);

    if (!user) {
      return res.status(401).json({
        message: 'Usuario o contraseña inválidos.',
        code: 'AUTH_BAD_CREDENTIALS',
      });
    }

    return res.json({
      token: signAppToken(user, { remember }),
      user: publicUser(user),
    });
  } catch (err) {
    const status = Number(err?.status) || 500;
    return res.status(status).json({
      message: status >= 500 ? 'El servicio de autenticación no está configurado de forma segura.' : String(err?.message || 'Acceso no autorizado.'),
      code: err?.code || 'AUTH_LOCAL_FAILED',
    });
  }
});

router.post('/azure-ad', loginLimiter, async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || '');
    if (!idToken) {
      return res.status(400).json({
        message: 'Token de autenticación institucional requerido.',
        code: 'AUTH_AZURE_AD_TOKEN_REQUIRED',
      });
    }

    const user = await authenticateAzureAdToken(idToken);
    return res.json({
      token: signAppToken(user, { remember: true }),
      user: publicUser(user),
    });
  } catch (err) {
    const status = Number(err?.status) || 401;
    return res.status(status).json({
      message: status >= 500 ? 'No fue posible validar el ingreso institucional.' : String(err?.message || 'Acceso no autorizado.'),
      code: 'AUTH_AZURE_AD_FAILED',
    });
  }
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

module.exports = router;
