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
  getOptionalGestionSequence,
};