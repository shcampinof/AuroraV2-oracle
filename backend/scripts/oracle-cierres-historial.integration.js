const assert = require('assert/strict');
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '..', '.env'), quiet: true });
const db = require('../db/oraclePool');

// Ejecuta el SQL del repositorio con CTE sintéticos. Solo SELECT.
async function run() {
  const modulePath = require.resolve('../repositories/oracle/personaRepository');
  const previousModule = require.cache[modulePath];
  const originalExecute = db.execute;
  let captured;
  let capturedBinds;
  try {
    db.execute = async (sql, binds) => { captured = sql; capturedBinds = binds; return { rows: [] }; };
    delete require.cache[modulePath];
    await require(modulePath).listAutomaticClosuresByDocumento('123', { scopeDepartamentos: ['CUNDINAMARCA'] });
  } finally {
    db.execute = originalExecute;
    delete require.cache[modulePath];
    if (previousModule) require.cache[modulePath] = previousModule;
  }
  const ctes = `WITH
    persona_fixture AS (
      SELECT 1 ID_PERSONA, '123' NUMERO FROM dual UNION ALL SELECT 2, '456' FROM dual
    ),
    situacion_fixture AS (
      SELECT 10 ID_SITUACION, 1 ID_PERSONA, 'ERON ANTERIOR' ESTABLECIMIENTO, 'CUNDINAMARCA' DEPARTAMENTO FROM dual
      UNION ALL SELECT 11, 1, 'ERON NUEVO', 'BOGOTA' FROM dual
      UNION ALL SELECT 12, 1, 'OTRO ANTERIOR', 'CUNDINAMARCA' FROM dual
      UNION ALL SELECT 20, 2, 'OTRA PERSONA', 'CUNDINAMARCA' FROM dual
    ),
    asignacion_fixture AS (
      SELECT 501 ID_ASIGNACION, 1 ID_PERSONA, DATE '2026-10-19' FECHA_FIN FROM dual
      UNION ALL SELECT 502, 1, CAST(NULL AS DATE) FROM dual
    ),
    gestion_fixture AS (
      SELECT 100 ID_GESTION, 10 ID_SITUACION, 501 ID_ASIGNACION_GESTION,
        'Cierre automático por cambio de regional.' CIERRE_CASO,
        'DEFENSORA ANTERIOR' DEFENSOR_GESTION, DATE '2026-01-01' FECHA_REGISTRO FROM dual
      UNION ALL SELECT 101, 11, 502, CAST(NULL AS VARCHAR2(200)), 'DEFENSOR ACTUAL', DATE '2026-10-19' FROM dual
      UNION ALL SELECT 102, 12, NULL, 'Cierre automático por cambio de ERON o regional.', 'DEFENSORA LEGADA', DATE '2025-01-01' FROM dual
      UNION ALL SELECT 103, 10, NULL, 'Otro motivo.', 'DEFENSORA ANTERIOR', DATE '2026-02-01' FROM dual
      UNION ALL SELECT 200, 20, NULL, 'Cierre automático por cambio de ERON o regional.', 'OTRA PERSONA', DATE '2026-10-19' FROM dual
    )`;
  const sql = ctes + captured.replaceAll('DNDP.PERSONA', 'persona_fixture')
    .replaceAll('DNDP.SITUACION_CARCELARIA', 'situacion_fixture')
    .replaceAll('DNDP.GESTION_JURIDICA', 'gestion_fixture').replaceAll('DNDP.ASIGNACION', 'asignacion_fixture');
  const rows = (await db.execute(sql, capturedBinds)).rows;
  assert.deepEqual(rows.map(row => row.ID_GESTION), [100, 102]);
  assert.equal(rows[0].DEFENSOR, 'DEFENSORA ANTERIOR');
  assert.equal(rows[0].ESTABLECIMIENTO, 'ERON ANTERIOR');
  assert.equal(rows[0].FECHA_CIERRE, '2026-10-19');
  assert.equal(rows[1].FECHA_CIERRE, null);
  console.log('OK Oracle: cierre de situación anterior, defensor original, fecha de fin, legado sin fecha y aislamiento por documento y departamento (solo SELECT).');
}
if (require.main === module) {
  if (process.env.RUN_ORACLE_INTEGRATION === 'true') run()
    .catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.closePool());
  else console.log('SKIP: configure RUN_ORACLE_INTEGRATION=true.');
}
module.exports = { run };
