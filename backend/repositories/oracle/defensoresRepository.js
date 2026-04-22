const { execute } = require('../../db/oraclePool');

function createRepoError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeCedula(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function normalizeNombre(nombre) {
  return String(nombre ?? '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanNombre(nombre) {
  return String(nombre ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertNombreValido(nombre) {
  if (!nombre) {
    throw createRepoError('El nombre del defensor es obligatorio.', 400, 'INVALID_DEFENSOR_NAME');
  }
  if (!/^[\p{L}\s]+$/u.test(nombre)) {
    throw createRepoError('El nombre solo puede contener letras y espacios.', 400, 'INVALID_DEFENSOR_NAME');
  }
}

function buildDefensorIdFromNombre(nombre) {
  const base = normalizeNombre(nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'DEFENSOR';
}

function toOptions(items = []) {
  const ids = new Map();
  return (items || [])
    .map((item) => {
      if (typeof item === 'string') {
        const displayNombre = String(item || '').replace(/\s+/g, ' ').trim();
        if (!displayNombre) return null;
        const baseId = buildDefensorIdFromNombre(displayNombre);
        const count = (ids.get(baseId) || 0) + 1;
        ids.set(baseId, count);
        const id = count === 1 ? baseId : `${baseId}_${count}`;
        return { id, nombre: displayNombre };
      }

      const nombre = String(item?.nombre ?? item?.NOMBRE ?? '').replace(/\s+/g, ' ').trim();
      if (!nombre) return null;
      const cedula = String(item?.cedula ?? item?.CEDULA ?? item?.id ?? '').trim();
      return { id: cedula || buildDefensorIdFromNombre(nombre), nombre };
    })
    .filter(Boolean);
}

function mapDefensorRow(row) {
  if (!row) return null;
  const cedula = String(row.CEDULA ?? '').trim();
  if (!cedula) return null;
  return {
    cedula,
    nombre: String(row.NOMBRE ?? '').trim(),
    correo: String(row.CORREO ?? '').trim(),
    regional: String(row.REGIONAL ?? '').trim(),
    cedulaPag: String(row.CEDULA_PAG ?? '').trim(),
  };
}

async function listAll() {
  const sql = `
    SELECT
      TO_CHAR(d.CEDULA) AS CEDULA,
      d.NOMBRE,
      d.CORREO,
      d.REGIONAL,
      TO_CHAR(d.CEDULA_PAG) AS CEDULA_PAG
    FROM DNDP.DEFENSORES d
    ORDER BY d.NOMBRE ASC
  `;

  const result = await execute(sql, {}, { operation: 'defensores.listAll' });
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  return rows.map(mapDefensorRow).filter(Boolean);
}

async function findByCedula(cedula) {
  const normalized = normalizeCedula(cedula);
  if (!normalized) return null;

  const sql = `
    SELECT
      TO_CHAR(d.CEDULA) AS CEDULA,
      d.NOMBRE,
      d.CORREO,
      d.REGIONAL,
      TO_CHAR(d.CEDULA_PAG) AS CEDULA_PAG
    FROM DNDP.DEFENSORES d
    WHERE TO_CHAR(d.CEDULA) = :cedula
  `;

  const result = await execute(sql, { cedula: normalized }, { operation: 'defensores.findByCedula' });
  const row = Array.isArray(result?.rows) ? result.rows[0] : null;
  return mapDefensorRow(row);
}

async function create({ cedula, nombre, correo = '', regional = '', cedulaPag = '' } = {}) {
  const normalizedCedula = normalizeCedula(cedula);
  if (!normalizedCedula) {
    throw createRepoError('La cedula del defensor es obligatoria.', 400, 'INVALID_DEFENSOR_CEDULA');
  }

  const cleanNombreValue = cleanNombre(nombre);
  assertNombreValido(cleanNombreValue);

  const exists = await findByCedula(normalizedCedula);
  if (exists) {
    throw createRepoError('El defensor ya existe.', 409, 'DUPLICATE_DEFENSOR');
  }

  const sql = `
    INSERT INTO DNDP.DEFENSORES (CEDULA, NOMBRE, CORREO, REGIONAL, CEDULA_PAG)
    VALUES (:cedula, :nombre, :correo, :regional, :cedulaPag)
  `;

  const binds = {
    cedula: normalizedCedula,
    nombre: cleanNombreValue,
    correo: String(correo || '').trim() || null,
    regional: String(regional || '').trim() || null,
    cedulaPag: normalizeCedula(cedulaPag) || null,
  };

  await execute(sql, binds, { autoCommit: true, operation: 'defensores.create' });

  return {
    cedula: normalizedCedula,
    nombre: cleanNombreValue,
    correo: binds.correo || '',
    regional: binds.regional || '',
    cedulaPag: binds.cedulaPag || '',
  };
}

module.exports = {
  listAll,
  findByCedula,
  create,
  toOptions,
  normalizeNombre,
  assertNombreValido,
  normalizeCedula,
};
