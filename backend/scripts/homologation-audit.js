const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env') });

const personaRepository = require('../repositories/oracle/personaRepository');
const { closePool } = require('../db/oraclePool');
const { buildHomologationAudit } = require('../services/homologationAuditService');

function readArgument(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((argument) => argument.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

(async () => {
  try {
    const tipoArgument = String(readArgument('tipo', 'all')).trim().toLowerCase();
    const tipo = ['all', 'condenado', 'sindicado'].includes(tipoArgument) ? tipoArgument : 'all';
    const pendingLimit = Math.max(1, Math.min(5000, Number.parseInt(readArgument('limit', '100'), 10) || 100));
    const values = await personaRepository.listCondenadosHomologationValues({ tipo, maxPerField: 5000 });
    const report = buildHomologationAudit({
      centerRows: values.centros,
      actionRows: values.acciones,
      pendingLimit,
    });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(
      JSON.stringify(
        { ok: false, code: error?.code || 'HOMOLOGATION_AUDIT_ERROR', message: error?.message || String(error) },
        null,
        2
      )
    );
    process.exitCode = 1;
  } finally {
    await closePool().catch(() => {});
  }
})();
