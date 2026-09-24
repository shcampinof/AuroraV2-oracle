const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env') });

const personaRepository = require('../repositories/oracle/personaRepository');
const { closePool, healthCheck } = require('../db/oraclePool');
const { getOracleConfig } = require('../config/oracle');

const applyChanges = process.argv.slice(2).includes('--apply');

(async () => {
  try {
    const config = getOracleConfig();
    await healthCheck();
    const [closuresBefore, actionsBefore] = await Promise.all([
      personaRepository.previewLegacyAutomaticClosureCleanup({ summaryLimit: 100 }),
      personaRepository.previewCurrentGestionActionReconciliation({ summaryLimit: 100 }),
    ]);
    const before = { closures: closuresBefore, actions: actionsBefore };
    const target = { serviceName: config.serviceName, schema: config.schema };

    if (!applyChanges) {
      console.log(JSON.stringify({ ok: true, readOnly: true, target, before }, null, 2));
      return;
    }

    const cleanup = await personaRepository.clearLegacyAutomaticClosures();
    const reconciliation = await personaRepository.reconcileCurrentGestionActions();
    const [closuresAfter, actionsAfter] = await Promise.all([
      personaRepository.previewLegacyAutomaticClosureCleanup({ summaryLimit: 100 }),
      personaRepository.previewCurrentGestionActionReconciliation({ summaryLimit: 100 }),
    ]);
    const after = { closures: closuresAfter, actions: actionsAfter };
    console.log(JSON.stringify({
      ok: true,
      readOnly: false,
      target,
      before,
      cleared: cleanup.updated,
      reconciled: reconciliation.updated,
      after,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      code: error?.code || 'STATE_CONSISTENCY_REPAIR_ERROR',
      message: error?.message || String(error),
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await closePool().catch(() => {});
  }
})();
