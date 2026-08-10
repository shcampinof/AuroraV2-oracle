const DEFAULT_PORT = 1521;

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    const err = new Error(`Falta variable de entorno requerida: ${name}`);
    err.code = 'ORACLE_CONFIG_MISSING';
    err.status = 500;
    throw err;
  }
  return value;
}

function optionalInt(name, fallback) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildConnectString(host, port, serviceName) {
  return `${host}:${port}/${serviceName}`;
}

function safeOracleIdentifier(value, fallback = 'DNDP') {
  const raw = String(value || fallback || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_$#]*$/.test(raw)) {
    const err = new Error(`Identificador Oracle no valido: ${raw}`);
    err.code = 'ORACLE_CONFIG_INVALID_IDENTIFIER';
    err.status = 500;
    throw err;
  }
  return raw;
}

function getOracleSchema() {
  return safeOracleIdentifier(process.env.ORACLE_SCHEMA || process.env.ORACLE_USER || 'DNDP');
}

function getOracleConfig() {
  const user = requiredEnv('ORACLE_USER');
  const password = requiredEnv('ORACLE_PASSWORD');
  const host = requiredEnv('ORACLE_HOST');
  const serviceName = requiredEnv('ORACLE_SERVICE_NAME');
  const port = optionalInt('ORACLE_PORT', DEFAULT_PORT);

  return {
    user,
    password,
    host,
    port,
    serviceName,
    schema: getOracleSchema(),
    connectString: buildConnectString(host, port, serviceName),
    poolMin: optionalInt('ORACLE_POOL_MIN', 1),
    poolMax: optionalInt('ORACLE_POOL_MAX', 8),
    poolIncrement: optionalInt('ORACLE_POOL_INCREMENT', 1),
    poolTimeout: optionalInt('ORACLE_POOL_TIMEOUT', 60),
  };
}

function getOptionalGestionSequence() {
  return String(process.env.ORACLE_GESTION_ID_SEQUENCE || '').trim();
}

module.exports = {
  getOracleConfig,
  getOracleSchema,
  getOptionalGestionSequence,
  safeOracleIdentifier,
};
