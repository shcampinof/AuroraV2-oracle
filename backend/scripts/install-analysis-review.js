const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '..', '.env'), quiet: true });
const db = require('../db/oraclePool');
const { getOracleSchema } = require('../config/oracle');
const { reviewCondition } = require('../repositories/oracle/analysisReviewRepository');

async function run({ apply = false } = {}) {
  const owner = getOracleSchema();
  const columns = (await db.execute(`SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS
    WHERE OWNER = :owner AND TABLE_NAME = 'GESTION_JURIDICA'
      AND COLUMN_NAME IN ('NUEVA_FECHA_ANALISIS', 'ID_GESTION_ORIGEN')`, { owner })).rows;
  const changes = [];
  for (const [name, type] of [['NUEVA_FECHA_ANALISIS', 'DATE'], ['ID_GESTION_ORIGEN', 'NUMBER']]) {
    const column = columns.find(row => row.COLUMN_NAME === name);
    if (column && !(column.DATA_TYPE === type || (type === 'DATE' && column.DATA_TYPE.startsWith('TIMESTAMP')))) {
      throw new Error(`${name} tiene un tipo incompatible: ${column.DATA_TYPE}`);
    }
    if (!column) {
      changes.push(`Agregar ${name}`);
      if (apply) await db.execute(`ALTER TABLE DNDP.GESTION_JURIDICA ADD (${name} ${type})`, {}, { autoCommit: true });
    }
  }
  const indexes = (await db.execute(`SELECT i.INDEX_NAME FROM ALL_INDEXES i
    JOIN ALL_IND_COLUMNS c ON c.INDEX_OWNER = i.OWNER AND c.INDEX_NAME = i.INDEX_NAME
    WHERE i.TABLE_OWNER = :owner AND i.TABLE_NAME = 'GESTION_JURIDICA'
      AND i.UNIQUENESS = 'UNIQUE' AND c.COLUMN_NAME = 'ID_GESTION_ORIGEN'
      AND (SELECT COUNT(*) FROM ALL_IND_COLUMNS cc
        WHERE cc.INDEX_OWNER = i.OWNER AND cc.INDEX_NAME = i.INDEX_NAME) = 1`, { owner })).rows;
  if (!indexes.length) {
    changes.push('Garantizar una revisión por gestión de origen');
    if (apply) await db.execute('CREATE UNIQUE INDEX DNDP.UQ_GESTION_REVISION_ORIGEN ON DNDP.GESTION_JURIDICA (ID_GESTION_ORIGEN)', {}, { autoCommit: true });
  }
  const dateIndexes = (await db.execute(`SELECT INDEX_NAME FROM ALL_IND_COLUMNS
    WHERE TABLE_OWNER = :owner AND TABLE_NAME = 'GESTION_JURIDICA'
      AND COLUMN_NAME = 'NUEVA_FECHA_ANALISIS' AND COLUMN_POSITION = 1`, { owner })).rows;
  if (!dateIndexes.length) {
    changes.push('Indexar la fecha de revisión para el proceso periódico');
    if (apply) await db.execute('CREATE INDEX DNDP.IX_GESTION_FECHA_REVISION ON DNDP.GESTION_JURIDICA (NUEVA_FECHA_ANALISIS)', {}, { autoCommit: true });
  }
  let backfilled = 0;
  if (apply) {
    // Se conserva el día del mes; si no existe, se usa el último día disponible.
    const result = await db.execute(`UPDATE DNDP.GESTION_JURIDICA g SET NUEVA_FECHA_ANALISIS =
      ADD_MONTHS(TRUNC(CAST(g.FECHA_ANALISIS AS DATE), 'MM'), 6)
      + LEAST(TO_NUMBER(TO_CHAR(g.FECHA_ANALISIS, 'DD')),
        TO_NUMBER(TO_CHAR(LAST_DAY(ADD_MONTHS(CAST(g.FECHA_ANALISIS AS DATE), 6)), 'DD'))) - 1
      WHERE g.NUEVA_FECHA_ANALISIS IS NULL AND EXISTS (
        SELECT 1 FROM DNDP.SITUACION_CARCELARIA s
        WHERE s.ID_SITUACION = g.ID_SITUACION AND s.ACTIVO = 1 AND ${reviewCondition()}
      )`, {}, { autoCommit: true, operation: 'analysisReview.backfill' });
    backfilled = Number(result.rowsAffected || 0);
  }
  return { ok: true, applied: apply, changes, backfilled };
}

if (require.main === module) run({ apply: process.argv.includes('--apply') })
  .then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => db.closePool());

module.exports = { run };
