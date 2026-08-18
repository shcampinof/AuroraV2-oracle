const pplService = require('../services/pplService');

function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function getValue(row, columnName, fallback = '') {
  const source = row && typeof row === 'object' ? row : {};
  if (!columnName) return fallback;

  if (Object.prototype.hasOwnProperty.call(source, columnName)) {
    const value = source[columnName];
    const text = value == null ? '' : String(value);
    return text.trim() === '' ? fallback : value;
  }

  const needle = normalizeKey(columnName);
  for (const [key, value] of Object.entries(source)) {
    if (normalizeKey(key) !== needle) continue;
    const text = value == null ? '' : String(value);
    return text.trim() === '' ? fallback : value;
  }

  return fallback;
}

function getHeaderKey(columnName) {
  return String(columnName || '').trim();
}

function setValue(row, columnName, value) {
  if (!row || typeof row !== 'object') return;
  row[String(columnName || '').trim()] = value;
}

function ensureColumn(columnName) {
  return String(columnName || '').trim();
}

module.exports = {
  getAll: () => pplService.getAll(),
  getColumns: () => pplService.getColumns(),
  getByDocumento: (documento) => pplService.getByDocumento(documento),
  getActuacionesByDocumento: (documento) => pplService.getActuacionesByDocumento(documento),
  createActuacionByDocumento: (documento, payload) => pplService.createActuacionByDocumento(documento, payload),
  updateByDocumento: (documento, payload) => pplService.updateByDocumento(documento, payload),
  assignDefensor: (documentos, defensor, options) => pplService.assignDefensor(documentos, defensor, options),
  unassignDefensor: (documentos) => pplService.unassignDefensor(documentos),
  getDefensoresDistinct: (options) => pplService.getDefensoresDistinct(options),
  computeTipo: (row) => pplService.computeTipo(row),
  getDataVersion: () => pplService.getDataVersion(),
  getHeaderKey,
  getValue,
  setValue,
  ensureColumn,
};
