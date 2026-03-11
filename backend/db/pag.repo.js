const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const PAG_CSV_PATH_CANDIDATES = [
  path.join(__dirname, '..', 'data', 'PAGcsv.csv'),
  path.join(__dirname, '..', 'data', 'PAG.csv'),
];

let cacheStamp = '';
let cacheByCedula = new Map();

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeCedula(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function getFileStamp(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return `${stat.size}:${stat.mtimeMs}`;
  } catch (_e) {
    return 'missing';
  }
}

function resolvePagCsvPath() {
  for (const candidate of PAG_CSV_PATH_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return PAG_CSV_PATH_CANDIDATES[0];
}

function pickHeader(headers, matcher) {
  for (const header of headers || []) {
    if (matcher(normalizeText(header))) return header;
  }
  return '';
}

function loadCache() {
  const csvPath = resolvePagCsvPath();
  const stamp = `${csvPath}|${getFileStamp(csvPath)}`;
  if (stamp === cacheStamp) return;

  cacheStamp = stamp;
  cacheByCedula = new Map();

  if (!fs.existsSync(csvPath)) return;

  const raw = fs.readFileSync(csvPath, 'utf8');
  let csvHeaders = [];
  const rows = parse(raw, {
    bom: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    columns: (headers) => {
      csvHeaders = Array.isArray(headers) ? headers.map((h) => String(h ?? '').trim()) : [];
      return csvHeaders;
    },
  });

  const cedulaHeader = pickHeader(csvHeaders, (name) => name.includes('cedula'));
  const nombreHeader = pickHeader(csvHeaders, (name) => name.includes('nombre'));
  const correoHeader = pickHeader(csvHeaders, (name) => name.includes('correo'));

  rows.forEach((row) => {
    const cedula = normalizeCedula(row?.[cedulaHeader]);
    if (!cedula) return;
    if (cacheByCedula.has(cedula)) return;

    cacheByCedula.set(cedula, {
      cedula,
      nombre: String(row?.[nombreHeader] ?? '').trim(),
      correo: String(row?.[correoHeader] ?? '').trim(),
    });
  });
}

function findByCedula(cedula) {
  const normalized = normalizeCedula(cedula);
  if (!normalized) return null;
  loadCache();
  return cacheByCedula.get(normalized) || null;
}

module.exports = {
  findByCedula,
  normalizeCedula,
};
