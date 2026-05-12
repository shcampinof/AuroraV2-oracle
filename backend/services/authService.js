const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

const APP_TOKEN_ISSUER = process.env.AUTH_TOKEN_ISSUER || 'aurora';
const APP_TOKEN_AUDIENCE = process.env.AUTH_TOKEN_AUDIENCE || 'aurora-api';
const APP_TOKEN_TTL = process.env.AUTH_TOKEN_TTL || '8h';
const REMEMBER_APP_TOKEN_TTL = process.env.AUTH_REMEMBER_TOKEN_TTL || '7d';
const EPHEMERAL_JWT_SECRET = crypto.randomBytes(48).toString('hex');
const DEFAULT_LOCAL_ADMIN_USERNAME = 'admin';
const DEFAULT_LOCAL_ADMIN_PASSWORD = 'admin';
const PLACEHOLDER_JWT_SECRET = 'replace-with-a-long-random-secret';
const EXAMPLE_LOCAL_ADMIN_PASSWORD = 'change-this-temporary-password';

const jwksClients = new Map();

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isProduction() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function isLocalAdminEnabled() {
  const raw = process.env.AUTH_LOCAL_ADMIN_ENABLED;
  if (raw == null || String(raw).trim() === '') return !isProduction();
  return String(raw).trim().toLowerCase() !== 'false';
}

function getJwtSecret() {
  const configured = String(process.env.AUTH_JWT_SECRET || '').trim();
  if (isProduction() && (!configured || configured.startsWith(PLACEHOLDER_JWT_SECRET))) {
    const err = new Error('AUTH_JWT_SECRET debe configurarse con un valor fuerte en producción.');
    err.status = 503;
    err.code = 'AUTH_JWT_SECRET_REQUIRED';
    throw err;
  }
  return configured || EPHEMERAL_JWT_SECRET;
}

function getLocalAdminConfig() {
  return {
    enabled: isLocalAdminEnabled(),
    username: process.env.AUTH_LOCAL_ADMIN_USERNAME || DEFAULT_LOCAL_ADMIN_USERNAME,
    password: process.env.AUTH_LOCAL_ADMIN_PASSWORD || DEFAULT_LOCAL_ADMIN_PASSWORD,
  };
}

function assertLocalAdminConfig(config) {
  if (!config.enabled || !isProduction()) return;
  if (
    config.username === DEFAULT_LOCAL_ADMIN_USERNAME ||
    config.password === DEFAULT_LOCAL_ADMIN_PASSWORD ||
    config.password === EXAMPLE_LOCAL_ADMIN_PASSWORD
  ) {
    const err = new Error('El usuario local de administración no puede usar credenciales por defecto en producción.');
    err.status = 503;
    err.code = 'AUTH_LOCAL_ADMIN_UNSAFE_DEFAULTS';
    throw err;
  }
}

function safeEqual(left, right) {
  const leftHash = crypto.createHash('sha256').update(String(left || '')).digest();
  const rightHash = crypto.createHash('sha256').update(String(right || '')).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function signAppToken(user, options = {}) {
  const safeUser = {
    id: String(user?.id || user?.username || user?.email || ''),
    name: String(user?.name || user?.username || user?.email || ''),
    email: String(user?.email || ''),
    username: String(user?.username || ''),
    provider: String(user?.provider || 'local'),
    roles: Array.isArray(user?.roles) ? user.roles : [],
  };

  return jwt.sign(
    {
      sub: safeUser.id,
      name: safeUser.name,
      email: safeUser.email,
      username: safeUser.username,
      provider: safeUser.provider,
      roles: safeUser.roles,
    },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn: options.remember ? REMEMBER_APP_TOKEN_TTL : APP_TOKEN_TTL,
      issuer: APP_TOKEN_ISSUER,
      audience: APP_TOKEN_AUDIENCE,
    }
  );
}

function verifyAppToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    issuer: APP_TOKEN_ISSUER,
    audience: APP_TOKEN_AUDIENCE,
  });
}

function authenticateLocal(username, password) {
  const config = getLocalAdminConfig();
  assertLocalAdminConfig(config);
  if (!config.enabled) return null;
  if (!safeEqual(username, config.username) || !safeEqual(password, config.password)) return null;

  return {
    id: config.username,
    username: config.username,
    name: 'Administrador AURORA',
    email: 'admin@defensoria.gov.co',
    provider: 'local',
    roles: ['admin'],
  };
}

function getAzureAdConfig() {
  const tenantId = process.env.AZURE_AD_TENANT_ID || process.env.AZURE_TENANT_ID || '';
  const clientId = process.env.AZURE_AD_CLIENT_ID || process.env.AZURE_CLIENT_ID || '';
  return {
    tenantId: tenantId.trim(),
    clientId: clientId.trim(),
    allowedDomains: csv(process.env.AZURE_AD_ALLOWED_EMAIL_DOMAINS || process.env.AZURE_ALLOWED_EMAIL_DOMAINS),
    requiredGroups: csv(process.env.AZURE_AD_REQUIRED_GROUP_IDS || process.env.AZURE_REQUIRED_GROUP_IDS),
    requiredRoles: csv(process.env.AZURE_AD_REQUIRED_APP_ROLES || process.env.AZURE_REQUIRED_APP_ROLES),
  };
}

function isAzureAdConfigured() {
  const config = getAzureAdConfig();
  return Boolean(config.tenantId && config.clientId);
}

function getJwksClient(tenantId) {
  const safeTenant = encodeURIComponent(tenantId);
  if (!jwksClients.has(safeTenant)) {
    jwksClients.set(
      safeTenant,
      jwksRsa({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `https://login.microsoftonline.com/${safeTenant}/discovery/v2.0/keys`,
      })
    );
  }
  return jwksClients.get(safeTenant);
}

function getSigningKey(tenantId) {
  const client = getJwksClient(tenantId);
  return (header, callback) => {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return callback(err);
      return callback(null, key.getPublicKey());
    });
  };
}

function verifyJwtAsync(token, keyProvider, options) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, keyProvider, options, (err, decoded) => {
      if (err) return reject(err);
      return resolve(decoded);
    });
  });
}

function assertAzureAdClaims(claims, config) {
  const tenantAliases = new Set(['common', 'organizations', 'consumers']);
  if (!tenantAliases.has(config.tenantId.toLowerCase()) && claims.tid !== config.tenantId) {
    const err = new Error('El token pertenece a un directorio no autorizado.');
    err.status = 403;
    throw err;
  }

  const email = String(claims.preferred_username || claims.email || claims.upn || '').toLowerCase();
  if (config.allowedDomains.length) {
    const hasAllowedDomain = config.allowedDomains.some((domain) => email.endsWith(`@${domain.toLowerCase()}`));
    if (!hasAllowedDomain) {
      const err = new Error('La cuenta no pertenece a un dominio institucional autorizado.');
      err.status = 403;
      throw err;
    }
  }

  if (config.requiredGroups.length) {
    const tokenGroups = Array.isArray(claims.groups) ? claims.groups : [];
    const belongsToGroup = config.requiredGroups.some((groupId) => tokenGroups.includes(groupId));
    if (!belongsToGroup) {
      const err = new Error('La cuenta no pertenece al grupo autorizado para AURORA.');
      err.status = 403;
      throw err;
    }
  }

  if (config.requiredRoles.length) {
    const tokenRoles = Array.isArray(claims.roles) ? claims.roles : [];
    const hasRole = config.requiredRoles.some((role) => tokenRoles.includes(role));
    if (!hasRole) {
      const err = new Error('La cuenta no tiene el rol de aplicación requerido.');
      err.status = 403;
      throw err;
    }
  }
}

async function authenticateAzureAdToken(idToken) {
  const config = getAzureAdConfig();
  if (!isAzureAdConfigured()) {
    const err = new Error('El servicio de autenticación institucional no está configurado en el backend.');
    err.status = 503;
    throw err;
  }

  const issuer = `https://login.microsoftonline.com/${config.tenantId}/v2.0`;
  const claims = await verifyJwtAsync(idToken, getSigningKey(config.tenantId), {
    algorithms: ['RS256'],
    audience: config.clientId,
    issuer,
  });

  assertAzureAdClaims(claims, config);

  const email = String(claims.preferred_username || claims.email || claims.upn || '').trim();
  return {
    id: String(claims.oid || claims.sub || email),
    username: email,
    email,
    name: String(claims.name || email || 'Usuario institucional'),
    provider: 'azure-ad',
    roles: Array.isArray(claims.roles) ? claims.roles : ['user'],
    tenantId: claims.tid,
  };
}

module.exports = {
  authenticateAzureAdToken,
  authenticateLocal,
  getAzureAdConfig,
  isAzureAdConfigured,
  isLocalAdminEnabled,
  signAppToken,
  verifyAppToken,
};
