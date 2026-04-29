const { execute } = require('../../db/oraclePool');

const CALIFICACION_COLUMNS = [
  'CALIFICACION_1',
  'ACTA_1',
  'FECHA_INICIO_1',
  'FECHA_FIN_1',
  'FECHA_CALIFICACION_1',
  'CALIFICACION_2',
  'ACTA_2',
  'FECHA_INICIO_2',
  'FECHA_FIN_2',
  'FECHA_CALIFICACION_2',
  'CALIFICACION_3',
  'ACTA_3',
  'FECHA_INICIO_3',
  'FECHA_FIN_3',
  'FECHA_CALIFICACION_3',
  'CALIFICACION_4',
  'ACTA_4',
  'FECHA_INICIO_4',
  'FECHA_FIN_4',
  'FECHA_CALIFICACION_4',
];

async function upsertBySituacion(idSituacion, fields = {}) {
  const clean = {};
  CALIFICACION_COLUMNS.forEach((column) => {
    if (Object.prototype.hasOwnProperty.call(fields || {}, column)) {
      clean[column] = fields[column];
    }
  });

  if (!Object.keys(clean).length) return 0;

  const columns = Object.keys(clean);
  const updateSet = columns.map((column) => `c.${column} = src.${column}`).join(',\n        ');
  const insertColumns = ['ID_CALIFICACION', 'ID_SITUACION', 'FECHA_REGISTRO', ...columns];
  const insertValues = ['src.NEXT_ID', 'src.ID_SITUACION', 'SYSDATE', ...columns.map((column) => `src.${column}`)];
  const binds = { idSituacion: Number(idSituacion) };

  columns.forEach((column, idx) => {
    binds[`v${idx}`] = clean[column];
  });

  const selectValues = columns.map((column, idx) => `:${`v${idx}`} AS ${column}`).join(',\n        ');
  const sql = `
    MERGE INTO DNDP.CALIFICACION_CONDUCTA c
    USING (
      SELECT
        :idSituacion AS ID_SITUACION,
        (SELECT NVL(MAX(ID_CALIFICACION), 0) + 1 FROM DNDP.CALIFICACION_CONDUCTA) AS NEXT_ID,
        ${selectValues}
      FROM dual
    ) src
    ON (c.ID_SITUACION = src.ID_SITUACION)
    WHEN MATCHED THEN UPDATE SET
        ${updateSet},
        c.FECHA_REGISTRO = SYSDATE
    WHEN NOT MATCHED THEN INSERT (${insertColumns.join(', ')})
      VALUES (${insertValues.join(', ')})
  `;

  const result = await execute(sql, binds, {
    autoCommit: true,
    operation: 'calificacionConducta.upsertBySituacion',
  });

  return Number(result?.rowsAffected || 0);
}

module.exports = {
  upsertBySituacion,
  CALIFICACION_COLUMNS,
};
