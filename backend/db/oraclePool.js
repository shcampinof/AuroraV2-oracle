const { getOracleConfig } = require('../config/oracle');

let oracleDriver = null;
let poolPromise = null;

function getOracleDriver() {
  if (oracleDriver) return oracleDriver;
  try {
    // Carga diferida para permitir levantar el servidor aunque falten variables Oracle.
    // Los errores aparecen al primer uso de DB o en /api/health/db.
    oracleDriver = require('oracledb');
  } catch (err) {
    const wrapped = new Error(
      `No fue posible cargar el driver oracledb. Instale la dependencia en backend: ${err?.message || err}`
    );
    wrapped.code = 'ORACLE_DRIVER_LOAD_ERROR';
    wrapped.status = 500;
    throw wrapped;
  }

  oracleDriver.fetchAsString = [oracleDriver.CLOB];
  return oracleDriver;
}

async function getPool() {
  if (poolPromise) return poolPromise;

  poolPromise = (async () => {
    const oracledb = getOracleDriver();
    const cfg = getOracleConfig();
    return oracledb.createPool({
      user: cfg.user,
      password: cfg.password,
      connectString: cfg.connectString,
      poolMin: cfg.poolMin,
      poolMax: cfg.poolMax,
      poolIncrement: cfg.poolIncrement,
      poolTimeout: cfg.poolTimeout,
    });
  })();

  try {
    return await poolPromise;
  } catch (err) {
    poolPromise = null;
    throw err;
  }
}

function toDbError(err, context = {}) {
  const wrapped = new Error(`Error Oracle en ${context?.operation || 'operacion'}: ${err?.message || err}`);
  wrapped.code = err?.code || 'ORACLE_EXEC_ERROR';
  wrapped.status = Number(err?.status) || 500;
  wrapped.cause = err;
  wrapped.context = context;
  return wrapped;
}

async function execute(sql, binds = {}, options = {}) {
  let conn;
  try {
    const pool = await getPool();
    conn = await pool.getConnection();
    const oracledb = getOracleDriver();
    const execOptions = {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: false,
      ...options,
    };
    return await conn.execute(sql, binds, execOptions);
  } catch (err) {
    throw toDbError(err, { operation: options?.operation || 'execute' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (_e) {
        // no-op
      }
    }
  }
}

async function healthCheck() {
  const res = await execute('SELECT 1 AS DB_OK FROM dual', {}, { operation: 'healthcheck' });
  const row = Array.isArray(res?.rows) ? res.rows[0] : null;
  return {
    ok: true,
    row,
  };
}

async function closePool() {
  if (!poolPromise) return;
  try {
    const pool = await poolPromise;
    await pool.close(5);
  } finally {
    poolPromise = null;
  }
}

module.exports = {
  execute,
  healthCheck,
  closePool,
  getOracleDriver,
};