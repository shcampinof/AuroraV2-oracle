const { execute } = require('../../db/oraclePool');

function normalizeCedula(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function mapPagRow(row) {
  if (!row) return null;
  const cedula = String(row.CEDULA ?? '').trim();
  if (!cedula) return null;
  return {
    cedula,
    nombre: String(row.NOMBRE_PAG ?? '').trim(),
    correo: String(row.CORREO ?? '').trim(),
    regional: String(row.REGIONAL ?? '').trim(),
  };
}

async function findByCedula(cedula) {
  const normalized = normalizeCedula(cedula);
  if (!normalized) return null;

  const sql = `
    SELECT
      TO_CHAR(p.CEDULA) AS CEDULA,
      p.NOMBRE_PAG,
      p.CORREO,
      p.REGIONAL
    FROM DNDP.PAG p
    WHERE TO_CHAR(p.CEDULA) = :cedula
  `;

  const result = await execute(sql, { cedula: normalized }, { operation: 'pag.findByCedula' });
  const row = Array.isArray(result?.rows) ? result.rows[0] : null;
  return mapPagRow(row);
}

module.exports = {
  findByCedula,
  normalizeCedula,
};
