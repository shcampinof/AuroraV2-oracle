const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env') });

const { execute, closePool } = require('../db/oraclePool');

const APPLY = process.argv.includes('--apply');
const OWNER = 'DNDP';
const TABLE = 'ASIGNACION';
const INDEX = 'IDX_ASIG_VIGENTE';
const TEMP_INDEX = 'IDX_ASIG_VIGENTE_V2';

function compact(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

async function listIndexExpressions(indexName) {
  const result = await execute(
    `SELECT c.COLUMN_POSITION, c.COLUMN_NAME, e.COLUMN_EXPRESSION
       FROM ALL_IND_COLUMNS c
       LEFT JOIN ALL_IND_EXPRESSIONS e
         ON e.INDEX_OWNER = c.INDEX_OWNER
        AND e.INDEX_NAME = c.INDEX_NAME
        AND e.COLUMN_POSITION = c.COLUMN_POSITION
      WHERE c.INDEX_OWNER = :owner
        AND c.INDEX_NAME = :indexName
      ORDER BY c.COLUMN_POSITION`,
    { owner: OWNER, indexName },
    { operation: 'migration.asignacionIndex.inspect' }
  );
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function countActiveDuplicates() {
  const result = await execute(
    `SELECT COUNT(*) AS TOTAL
       FROM (
         SELECT ID_PERSONA
           FROM DNDP.ASIGNACION
          WHERE FECHA_FIN IS NULL
          GROUP BY ID_PERSONA
         HAVING COUNT(*) > 1
       )`,
    {},
    { operation: 'migration.asignacionIndex.activeDuplicates' }
  );
  return Number(result?.rows?.[0]?.TOTAL || 0);
}

async function indexStatus(indexName) {
  const result = await execute(
    `SELECT STATUS
       FROM ALL_INDEXES
      WHERE OWNER = :owner
        AND INDEX_NAME = :indexName`,
    { owner: OWNER, indexName },
    { operation: 'migration.asignacionIndex.status' }
  );
  return String(result?.rows?.[0]?.STATUS || '').trim().toUpperCase();
}

async function main() {
  const duplicates = await countActiveDuplicates();
  if (duplicates > 0) {
    throw new Error(`Hay ${duplicates} persona(s) con más de una asignación activa. No se modificó el índice.`);
  }

  const current = await listIndexExpressions(INDEX);
  const currentExpression = compact(current?.[1]?.COLUMN_EXPRESSION);
  const legacyExpression = compact(`NVL(TO_CHAR("FECHA_FIN",'YYYYMMDD'),'VIGENTE')`);
  const correctExpression = compact(`CASE WHEN "FECHA_FIN" IS NULL THEN "ID_PERSONA" END`);

  if (current.length === 1 && compact(current[0]?.COLUMN_EXPRESSION) === correctExpression) {
    console.log('OK: IDX_ASIG_VIGENTE ya limita únicamente las asignaciones activas.');
    return;
  }

  if (
    current.length !== 2 ||
    compact(current[0]?.COLUMN_NAME) !== 'ID_PERSONA' ||
    currentExpression !== legacyExpression
  ) {
    throw new Error('La definición actual de IDX_ASIG_VIGENTE no coincide con la migración esperada.');
  }

  if (!APPLY) {
    console.log('Diagnóstico: IDX_ASIG_VIGENTE impide más de una reasignación por persona en el mismo día.');
    console.log('Ejecute con --apply para reemplazarlo por un índice único que controle solo la asignación activa.');
    return;
  }

  const temporaryStatus = await indexStatus(TEMP_INDEX);
  if (!temporaryStatus) {
    await execute(
      `CREATE UNIQUE INDEX DNDP.${TEMP_INDEX}
         ON DNDP.${TABLE} (CASE WHEN FECHA_FIN IS NULL THEN ID_PERSONA END)`,
      {},
      { operation: 'migration.asignacionIndex.createCorrectIndex' }
    );
  } else if (temporaryStatus !== 'VALID') {
    throw new Error(`${TEMP_INDEX} existe con estado ${temporaryStatus}; no se modificó el índice anterior.`);
  }

  if (await indexStatus(TEMP_INDEX) !== 'VALID') {
    throw new Error(`No fue posible validar ${TEMP_INDEX}; no se modificó el índice anterior.`);
  }

  await execute(
    `DROP INDEX DNDP.${INDEX}`,
    {},
    { operation: 'migration.asignacionIndex.dropLegacyIndex' }
  );
  await execute(
    `ALTER INDEX DNDP.${TEMP_INDEX} RENAME TO ${INDEX}`,
    {},
    { operation: 'migration.asignacionIndex.renameCorrectIndex' }
  );

  const finalRows = await listIndexExpressions(INDEX);
  const finalExpression = compact(finalRows?.[0]?.COLUMN_EXPRESSION);
  if (finalRows.length !== 1 || finalExpression !== correctExpression) {
    throw new Error('El índice nuevo fue creado, pero su validación final no coincide con la definición esperada.');
  }

  console.log('OK: IDX_ASIG_VIGENTE ahora permite múltiples reasignaciones diarias y una sola asignación activa.');
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => closePool().catch(() => {}));
