const { execute } = require('../../db/oraclePool');
const csvPagRepo = require('../../db/pag.repo');

function normalizeCedula(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function mapPagRow(row) {
  if (!row) return null;
  const cedula = String(row.CEDULA ?? '').trim();
  if (!cedula) return null;
  return {
    cedula,
    nombre: String(row.NOMBRE_PAG ?? row.NOMBRE ?? '').trim(),
    correo: String(row.CORREO ?? '').trim(),
    regional: String(row.REGIONAL ?? row.DEPENDENCIA ?? '').trim(),
  };
}

function normalizePag(value) {
  if (!value) return null;
  const cedula = normalizeCedula(value?.cedula ?? value?.CEDULA);
  if (!cedula) return null;
  return {
    cedula,
    nombre: String(value?.nombre ?? value?.NOMBRE ?? '').trim(),
    correo: String(value?.correo ?? value?.CORREO ?? '').trim(),
    regional: String(value?.regional ?? value?.REGIONAL ?? value?.dependencia ?? value?.DEPENDENCIA ?? '').trim(),
  };
}

function findByCedulaFromCsv(cedula) {
  return normalizePag(csvPagRepo.findByCedula(cedula));
}

async function findByCedula(cedula) {
  const normalized = normalizeCedula(cedula);
  if (!normalized) return null;

  const sql = `
    SELECT
      TO_CHAR(p.CEDULA_PAG) AS CEDULA,
      p.NOMBRE_PAG,
      p.CORREO,
      p.REGIONAL
    FROM DNDP.PAG p
    WHERE TO_CHAR(p.CEDULA_PAG) = :cedula
  `;

  try {
    const result = await execute(sql, { cedula: normalized }, { operation: 'pag.findByCedula' });
    const row = Array.isArray(result?.rows) ? result.rows[0] : null;
    return mapPagRow(row) || findByCedulaFromCsv(normalized);
  } catch (err) {
    const fallback = findByCedulaFromCsv(normalized);
    if (fallback) return fallback;
    throw err;
  }
}

module.exports = {
  findByCedula,
  normalizeCedula,
};
