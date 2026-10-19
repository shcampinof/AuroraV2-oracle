const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '..', '.env'), quiet: true });
const db = require('../db/oraclePool');
const { getOracleSchema } = require('../config/oracle');

async function compileDependencies(owner) {
  const result = await db.execute(`SELECT DISTINCT o.OBJECT_NAME, o.OBJECT_TYPE
    FROM ALL_OBJECTS o JOIN ALL_DEPENDENCIES d
      ON d.OWNER = o.OWNER AND d.NAME = o.OBJECT_NAME AND d.TYPE = o.OBJECT_TYPE
    WHERE o.OWNER = :owner AND o.STATUS = 'INVALID'
      AND d.REFERENCED_OWNER = :owner AND d.REFERENCED_NAME = 'GESTION_JURIDICA'`, { owner });
  const compiled = [];
  for (const row of result.rows) {
    if (!['PROCEDURE', 'FUNCTION', 'VIEW', 'TRIGGER', 'PACKAGE', 'PACKAGE BODY'].includes(row.OBJECT_TYPE)
      || !/^[A-Z][A-Z0-9_$#]*$/.test(row.OBJECT_NAME)) {
      throw new Error(`Dependencia pendiente de revisión: ${row.OBJECT_TYPE} ${row.OBJECT_NAME}`);
    }
    const kind = row.OBJECT_TYPE === 'PACKAGE BODY' ? 'PACKAGE' : row.OBJECT_TYPE;
    const suffix = row.OBJECT_TYPE === 'PACKAGE BODY' ? ' BODY' : '';
    await db.execute(`ALTER ${kind} ${owner}.${row.OBJECT_NAME} COMPILE${suffix}`, {}, {
      operation: 'gestion.compileDependency', autoCommit: true,
    });
    compiled.push(row.OBJECT_NAME);
  }
  const invalid = await db.execute(`SELECT DISTINCT o.OBJECT_NAME FROM ALL_OBJECTS o
    JOIN ALL_DEPENDENCIES d ON d.OWNER = o.OWNER AND d.NAME = o.OBJECT_NAME AND d.TYPE = o.OBJECT_TYPE
    WHERE o.OWNER = :owner AND o.STATUS = 'INVALID'
      AND d.REFERENCED_OWNER = :owner AND d.REFERENCED_NAME = 'GESTION_JURIDICA'`, { owner });
  if (invalid.rows.length) throw new Error(`Dependencias inválidas: ${invalid.rows.map(row => row.OBJECT_NAME).join(', ')}`);
  return compiled;
}

// Columna opcional: las filas anteriores conservan el respaldo histórico del reporte.
// No se infiere ni modifica el autor de ninguna gestión existente.
async function run({ apply = false } = {}) {
  const owner = getOracleSchema();
  const result = await db.execute(`SELECT DATA_TYPE FROM ALL_TAB_COLUMNS
    WHERE OWNER = :owner AND TABLE_NAME = 'GESTION_JURIDICA'
      AND COLUMN_NAME = 'ID_ASIGNACION_GESTION'`, { owner });
  if (result.rows.length) {
    if (result.rows[0].DATA_TYPE !== 'NUMBER') throw new Error('ID_ASIGNACION_GESTION debe ser NUMBER.');
    return { ok: true, changed: false, applied: false, compiled: apply ? await compileDependencies(owner) : [] };
  }
  if (apply) await db.execute('ALTER TABLE DNDP.GESTION_JURIDICA ADD (ID_ASIGNACION_GESTION NUMBER)', {}, { operation: 'gestion.installAssignment', autoCommit: true });
  return { ok: true, changed: true, applied: apply, compiled: apply ? await compileDependencies(owner) : [] };
}
if (require.main === module) run({ apply: process.argv.includes('--apply') })
  .then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => db.closePool());
module.exports = { run };
