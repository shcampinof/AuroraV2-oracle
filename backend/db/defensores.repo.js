const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const DEFENSORES_CSV_PATH = path.join(__dirname, '..', 'data', 'defensores.csv');

let cache = null;

function createRepoError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function maybeDecodeMojibake(value) {
  const raw = String(value ?? '');
  if (!/[\u00C3\u00C2\u00E2]/.test(raw)) return raw;
  try {
    return Buffer.from(raw, 'latin1').toString('utf8');
  } catch (_e) {
    return raw;
  }
}

function normalizeNombre(nombre) {
  return maybeDecodeMojibake(nombre)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function assertNombreValido(nombre) {
  if (!nombre) {
    throw createRepoError('El nombre del defensor es obligatorio.', 400, 'INVALID_DEFENSOR_NAME');
  }
  if (!/^[\p{L}\s]+$/u.test(nombre)) {
    throw createRepoError(
      'El nombre solo puede contener letras y espacios.',
      400,
      'INVALID_DEFENSOR_NAME'
    );
  }
}

function isPlaceholderDefensor(nombre) {
  const raw = normalizeNombre(nombre);
  if (!raw) return false;
  const cleaned = raw;
  if (cleaned === 'DEFENSOR(A) - EJEMPLO') return true;
  if (/^DEFENSOR\s*\(A\)\s*\d+$/.test(cleaned)) return true;
  return false;
}

function ensureCustomFile() {
  if (!fs.existsSync(DEFENSORES_CSV_PATH)) {
    fs.writeFileSync(DEFENSORES_CSV_PATH, 'nombre\n', 'utf8');
  }
}

function normalizeHeaderName(value) {
  return maybeDecodeMojibake(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function getBestNameColumn(row) {
  const entries = Object.entries(row || {});
  if (!entries.length) return '';
  const preferred = entries.find(([key]) => {
    const normalized = normalizeHeaderName(key);
    return normalized.includes('nombre') || normalized.includes('defensor');
  });
  if (preferred) return preferred[0];
  return entries[0][0];
}

function parseCsvRecords(csvPath, { ensure = false } = {}) {
  if (!fs.existsSync(csvPath)) {
    if (ensure) {
      fs.writeFileSync(csvPath, 'nombre\n', 'utf8');
    } else {
      return [];
    }
  }

  const rawBuffer = fs.readFileSync(csvPath);
  const utf8Text = rawBuffer.toString('utf8');
  const raw = utf8Text.includes('\uFFFD') ? rawBuffer.toString('latin1') : utf8Text;
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  });

  return rows
    .map((row) => {
      const nameColumn = getBestNameColumn(row);
      const rawNombre = String(row?.[nameColumn] ?? '').trim();
      const nombre = normalizeNombre(rawNombre);
      if (!nombre || isPlaceholderDefensor(nombre)) return null;
      return {
        nombre,
        displayNombre: maybeDecodeMojibake(rawNombre).replace(/\s+/g, ' ').trim() || nombre,
      };
    })
    .filter(Boolean);
}

function dedupeRecords(records) {
  const map = new Map();
  (records || []).forEach((record) => {
    const normalized = normalizeNombre(record?.nombre);
    if (!normalized || isPlaceholderDefensor(normalized)) return;
    if (!map.has(normalized)) {
      const display = String(record?.displayNombre || normalized).replace(/\s+/g, ' ').trim();
      map.set(normalized, display || normalized);
    }
  });
  return Array.from(map.entries()).map(([nombre, displayNombre]) => ({ nombre, displayNombre }));
}

function load() {
  ensureCustomFile();
  return dedupeRecords(parseCsvRecords(DEFENSORES_CSV_PATH, { ensure: true }));
}

function getAll() {
  if (!cache) cache = load();
  return cache.map((item) => item.displayNombre);
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function save(allNames) {
  const lines = ['nombre'];
  allNames.forEach((name) => {
    lines.push(escapeCsvValue(name));
  });
  fs.writeFileSync(DEFENSORES_CSV_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function buildDefensorIdFromNombre(nombre) {
  const base = normalizeNombre(nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'DEFENSOR';
}

function toOptions(nombres) {
  const ids = new Map();
  return (nombres || []).map((nombre) => {
    const displayNombre = String(nombre ?? '').replace(/\s+/g, ' ').trim();
    const baseId = buildDefensorIdFromNombre(displayNombre);
    const count = (ids.get(baseId) || 0) + 1;
    ids.set(baseId, count);
    const id = count === 1 ? baseId : `${baseId}_${count}`;
    return { id, nombre: displayNombre };
  });
}

function getAllOptions() {
  return toOptions(getAll());
}

function create(nombreInput) {
  const nombre = normalizeNombre(nombreInput);
  assertNombreValido(nombre);

  const current = load();
  if (current.some((item) => normalizeNombre(item?.nombre) === nombre)) {
    throw createRepoError('El defensor ya existe.', 409, 'DUPLICATE_DEFENSOR');
  }

  const customCurrent = parseCsvRecords(DEFENSORES_CSV_PATH, { ensure: true }).map((item) => item.nombre);
  const nextCustom = [...customCurrent, nombre];
  save(nextCustom);
  cache = null;

  return nombre;
}

module.exports = {
  getAll,
  getAllOptions,
  toOptions,
  create,
  normalizeNombre,
  assertNombreValido,
};
