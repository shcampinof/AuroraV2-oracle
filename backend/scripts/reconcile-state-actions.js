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
    const before = await personaRepository.previewCurrentGestionActionReconciliation({ summaryLimit: 100 });
    const target = {
      serviceName: config.serviceName,
      schema: config.schema,
    };

    if (!applyChanges) {
      console.log(JSON.stringify({
        ok: true,
        readOnly: true,
        target,
        ...before,
        instruction: 'Ejecute npm run sync:state-actions para aplicar exactamente esta reconciliacion.',
      }, null, 2));
      return;
    }

    const applied = await personaRepository.reconcileCurrentGestionActions();
    const after = await personaRepository.previewCurrentGestionActionReconciliation({ summaryLimit: 100 });
    console.log(JSON.stringify({
      ok: true,
      readOnly: false,
      target,
      before,
      updated: applied.updated,
      after,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      code: error?.code || 'STATE_ACTION_RECONCILIATION_ERROR',
      message: error?.message || String(error),
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await closePool().catch(() => {});
  }
})();
