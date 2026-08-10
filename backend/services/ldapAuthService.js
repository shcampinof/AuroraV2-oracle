const { Client, InvalidCredentialsError } = require('ldapts');

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLdapEnabled() {
  return String(process.env.LDAP_ENABLED || '').trim().toLowerCase() === 'true';
}

function getLdapConfig() {
  return {
    enabled: isLdapEnabled(),
    url: String(process.env.LDAP_URL || '').trim(),
    domain: String(process.env.LDAP_DOMAIN || '').trim(),
    allowedDomains: parseList(process.env.LDAP_ALLOWED_EMAIL_DOMAINS || process.env.AZURE_AD_ALLOWED_EMAIL_DOMAINS),
    timeoutMs: Number(process.env.LDAP_TIMEOUT_MS || 8000),
  };
}

function normalizeUsername(username, domain) {
  const raw = String(username || '').trim();
  if (!raw) return '';
  if (raw.includes('@') || raw.includes('\\')) return raw;
  return domain ? `${raw}@${domain}` : raw;
}

function emailFromUsername(username, domain) {
  const raw = String(username || '').trim();
  if (!raw) return '';
  if (raw.includes('@')) return raw.toLowerCase();
  if (raw.includes('\\')) {
    const account = raw.split('\\').pop();
    return domain ? `${account}@${domain}`.toLowerCase() : account.toLowerCase();
  }
  return domain ? `${raw}@${domain}`.toLowerCase() : raw.toLowerCase();
}

function assertAllowedDomain(email, allowedDomains) {
  if (!allowedDomains.length) return;
  const normalized = String(email || '').trim().toLowerCase();
  const allowed = allowedDomains.some((domain) => normalized.endsWith(`@${domain.toLowerCase()}`));
  if (!allowed) {
    const err = new Error('La cuenta no pertenece a un dominio institucional autorizado.');
    err.status = 403;
    err.code = 'LDAP_DOMAIN_FORBIDDEN';
    throw err;
  }
}

async function authenticateLdapUser(username, password) {
  const config = getLdapConfig();
  if (!config.enabled) return null;
  if (!config.url || !config.domain) {
    const err = new Error('LDAP no está configurado completamente.');
    err.status = 503;
    err.code = 'LDAP_CONFIG_REQUIRED';
    throw err;
  }

  const safePassword = String(password || '');
  if (!String(username || '').trim() || !safePassword) return null;

  const bindUser = normalizeUsername(username, config.domain);
  const email = emailFromUsername(bindUser, config.domain);
  assertAllowedDomain(email, config.allowedDomains);

  const client = new Client({
    url: config.url,
    timeout: config.timeoutMs,
    connectTimeout: config.timeoutMs,
  });

  try {
    await client.bind(bindUser, safePassword);
    return {
      id: email,
      username: email,
      email,
      name: email,
      provider: 'ldap',
      roles: ['user'],
    };
  } catch (err) {
    if (err instanceof InvalidCredentialsError || String(err?.message || '').toLowerCase().includes('invalid credentials')) {
      return null;
    }
    err.status = Number(err?.status) || 503;
    err.code = err?.code || 'LDAP_AUTH_FAILED';
    throw err;
  } finally {
    await client.unbind().catch(() => {});
  }
}

module.exports = {
  authenticateLdapUser,
  getLdapConfig,
  isLdapEnabled,
};
