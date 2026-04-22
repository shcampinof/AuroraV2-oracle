const { execute } = require('../../db/oraclePool');

const SITUACION_COLUMNS = new Set([
  'FECHA_CAPTURA',
  'SITUACION',
  'DELITOS',
  'PROCESO',
  'AUTORIDAD',
  'SITUACION_JURIDICA_ACTUALIZADA',
  'LUGAR_PRIVACION',
  'ESTABLECIMIENTO',
  'DEPARTAMENTO',
  'MUNICIPIO',
  'SIGUE_CDT',
  'PENA',
  'PENA_DIAS',
  'PRIVACION',
  'REDENCION',
  'TIEMPO_EFECTIVO',
  'PORCENTAJE',
  'FASE',
  'ENFOQUE',
  'REQUERIMIENTOS',
  'FECHA_CALIFICACION',
  'CALIFICACION',
  'ATENCION_MEDICA',
  'GESTACION',
  'CABEZA_FAMILIA',
  'FECHA_REGISTRO',
  'ACTIVO',
]);

async function updateSituacionById(idSituacion, fields = {}) {
  const updates = Object.entries(fields || {}).filter(([column]) => SITUACION_COLUMNS.has(String(column || '').toUpperCase()));
  if (!updates.length) return 0;

  const setClauses = [];
  const binds = { idSituacion: Number(idSituacion) };

  updates.forEach(([column, value], idx) => {
    const bindKey = `v${idx}`;
    setClauses.push(`${String(column).toUpperCase()} = :${bindKey}`);
    binds[bindKey] = value;
  });

  const sql = `
    UPDATE DNDP.SITUACION_CARCELARIA
       SET ${setClauses.join(', ')}
     WHERE ID_SITUACION = :idSituacion
  `;

  const result = await execute(sql, binds, {
    autoCommit: true,
    operation: 'situacion.updateSituacionById',
  });

  return Number(result?.rowsAffected || 0);
}

module.exports = {
  updateSituacionById,
  SITUACION_COLUMNS,
};
