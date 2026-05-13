const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env') });

const { healthCheck, closePool } = require('../db/oraclePool');

(async () => {
  const startedAt = Date.now();
  try {
    const result = await healthCheck();
    const elapsed = Date.now() - startedAt;
    console.log(JSON.stringify({ ok: true, elapsedMs: elapsed, db: result?.row || null }, null, 2));
    process.exitCode = 0;
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err?.message || String(err), code: err?.code || 'ORACLE_SMOKE_ERROR' }, null, 2));
    process.exitCode = 1;
  } finally {
    try {
      await closePool();
    } catch (_e) {
      // no-op
    }
  }
})();
