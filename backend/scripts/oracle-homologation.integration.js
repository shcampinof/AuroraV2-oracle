const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env') });

const personaRepository = require('../repositories/oracle/personaRepository');
const { closePool, healthCheck } = require('../db/oraclePool');
const { buildHomologationAudit } = require('../services/homologationAuditService');

if (String(process.env.RUN_ORACLE_INTEGRATION || '').trim().toLowerCase() !== 'true') {
  console.log('SKIP oracle-homologation.integration (configure RUN_ORACLE_INTEGRATION=true)');
  process.exit(0);
}

(async () => {
  try {
    const health = await healthCheck();
    assert.strictEqual(health?.ok, true);
    const values = await personaRepository.listCondenadosHomologationValues({ tipo: 'all', maxPerField: 5000 });
    const report = buildHomologationAudit({ centerRows: values.centros, actionRows: values.acciones, pendingLimit: 10 });
    assert.strictEqual(report.readOnly, true);
    assert(report.centers.summary.identities >= 0);
    assert(report.actions.summary.pendingOccurrences >= 0);
    console.log(
      JSON.stringify(
        {
          ok: true,
          centers: report.centers.summary,
          actions: report.actions.summary,
          catalogs: report.catalogs,
        },
        null,
        2
      )
    );
  } finally {
    await closePool().catch(() => {});
  }
})().catch((error) => {
  console.error(JSON.stringify({ ok: false, code: error?.code || '', message: error?.message || String(error) }, null, 2));
  process.exitCode = 1;
});
