const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const CONSOLIDADO_CSV_PATH = path.join(__dirname, '..', 'data', 'consolidado_ppl.csv');
const CSV_PATH = CONSOLIDADO_CSV_PATH;

let rawCache = null;
let rawHeaders = null; // headers como aparecen en el CSV (incluye vacios)
let logicalHeaders = null; // headers legacy usados por el frontend
let headers = null; // headers saneados (clave de objeto)
let headerByNorm = null; // norm(header) -> header saneado
let headerByNormLoose = null; // normLoose(header) -> header saneado
let headerKeyCache = null; // cache para resolucion de columnas
let dataVersion = 0; // incrementa cuando se persisten cambios al CSV
let scopedRowsCache = null; // cache de filas filtradas por alcance regional

const TODO_TO_LEGACY_HEADERS = {
  nombre: 'Nombre',
  'tipo de indentificacion': 'Tipo de indentificación',
  numero: 'Número de identificación',
  situacion: 'Situación Jurídica',
  genero: 'Género',
  enfoque: 'Enfoque Étnico/Racial/Cultural',
  'fecha de nacimiento': 'Fecha de nacimiento',
  'lugar de privacion': 'Lugar de privación de la libertad',
  establecimiento: 'Nombre del lugar de privación de la libertad',
  departamento: 'Departamento del lugar de privación de la libertad',
  municipio: 'Distrito/municipio del lugar de privación de la libertad',
  'sigue cdt': '¿ La persona sigue en el CDT?',
  autoridad: 'Autoridad a cargo',
  proceso: 'Número de proceso',
  'situacion juridica actualizada': 'Situación Jurídica actualizada (de conformidad con la rama judicial)',
  pena: 'Pena (años, meses y días)',
  'pena dias': 'Pena total en días',
  privacion: 'Tiempo que la persona lleva privada de la libertad (en días)',
  redencion: 'Redención total acumulada en días',
  'tiempo efectivo': 'Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)',
  porcentaje: 'Porcentaje de avance de pena cumplida',
  fase: 'Fase de tramiento',
  requerimienotosi: '¿ Cuenta con requerimientos judiciales por otros procesos ?',
  'fecha calificacion': 'Fecha última calificación',
  calificacion: 'Calificación de conducta',
  'no acta de calificacion de conducta': 'No.Acta de calificación de conducta',
  'evaluacion de conducta desde': 'Evaluación de conducta desde',
  'evaluacion de conducta hasta': 'Evaluación de conducta hasta',
  defensor: 'Defensor(a) Público(a) Asignado para tramitar la solicitud',
  'fecha analisis': 'Fecha de análisis jurídico del caso',
  'atencion medica': '¿REQUIERE ATENCIÓN MÉDICA PERMANENTE?',
  gestacion: '¿ESTÁ EN ESTADO DE GESTACIÓN?',
  'cabeza de famlia': '¿ES MUJER CABEZA DE FAMILIA?',
  'vencimiento de terminos': 'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
  'utilidad publica': 'Procedencia de utilidad pública (solo para mujeres)',
  'libertad condicional': 'Procedencia de libertad condicional',
  'prision domiciliaria de mitad de pena': 'Procedencia de prisión domiciliaria de mitad de pena',
  'fecha de recepcion de pruebas aportadas por el usuario si aplic':
    'Fecha de recepción de pruebas aportadas por el usuario (Si aplica)',
  'fecha de revision del expediente y elementos materiales probator':
    'FECHA DE REVISIÓN DEL EXPEDIENTE Y ELEMENTOS MATERIALES PROBATORIOS',
  'confirmacion de la procedencia de la solicitud de vencimiento de':
    'CONFIRMACIÓN DE LA PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
  'fecha de solicitud de audiencia de control de garantias para sus':
    'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA',
};

const HEADER_ALIASES = {
  'numero de identificacion': ['numero', 'numero de identificacion'],
  'situacion juridica': ['situacion', 'situacion juridica'],
  'enfoque etnico racial cultural': ['enfoque'],
  'lugar de privacion de la libertad': ['lugar de privacion'],
  'nombre del lugar de privacion de la libertad': ['establecimiento'],
  'departamento del lugar de privacion de la libertad': ['departamento'],
  'distrito municipio del lugar de privacion de la libertad': ['municipio'],
  'la persona sigue en el cdt': ['sigue cdt'],
  'autoridad a cargo': ['autoridad'],
  'numero de proceso': ['proceso'],
  'situacion juridica actualizada de conformidad con la rama judicial': ['situacion juridica actualizada'],
  'pena anos meses y dias': ['pena'],
  'pena total en dias': ['pena dias'],
  'tiempo que la persona lleva privada de la libertad en dias': ['privacion'],
  'redencion total acumulada en dias': ['redencion'],
  'tiempo efectivo de pena cumplida en dias teniendo en cuenta la redencion': ['tiempo efectivo'],
  'porcentaje de avance de pena cumplida': ['porcentaje'],
  'fase de tramiento': ['fase'],
  'cuenta con requerimientos judiciales por otros procesos': ['requerimienotosi', 'requerimientos'],
  requerimientos: ['cuenta con requerimientos judiciales por otros procesos', 'requerimienotosi'],
  'fecha ultima calificacion': ['fecha calificacion'],
  'calificacion de conducta': ['calificacion'],
  'no acta de calificacion de conducta': ['no de acta de calificacion de conducta', 'no acta'],
  'evaluacion de conducta desde': ['evaluacion desde'],
  'evaluacion de conducta hasta': ['evaluacion hasta'],
  'defensor a publico a asignado para tramitar la solicitud': ['defensor'],
  'fecha de analisis juridico del caso': ['fecha analisis'],
  'requiere atencion medica permanente': ['atencion medica'],
  'esta en estado de gestacion': ['gestacion'],
  'es mujer cabeza de familia': ['cabeza de famlia'],
  'procedencia de la solicitud de vencimiento de terminos': ['vencimiento de terminos'],
  'procedencia de utilidad publica solo para mujeres': ['utilidad publica'],
  'procedencia de libertad condicional': ['libertad condicional'],
  'procedencia de prision domiciliaria de mitad de pena': ['prision domiciliaria de mitad de pena'],
  'fecha de recepcion de pruebas aportadas por el usuario si aplica': [
    'fecha de recepcion de pruebas aportadas por el usuario si aplic',
  ],
  'fecha de revision del expediente y elementos materiales probatorios': [
    'fecha de revision del expediente y elementos materiales probator',
  ],
  'confirmacion de la procedencia de la solicitud de vencimiento de terminos': [
    'confirmacion de la procedencia de la solicitud de vencimiento de',
  ],
  'fecha de solicitud de audiencia de control de garantias para sustentar revocatoria': [
    'fecha de solicitud de audiencia de control de garantias para sus',
  ],
  'fecha de presentacion de la solicitud a la autoridad': [
    'fecha de presentacion de solicitud a la autoridad',
    'fecha de presentacion de la solicitud a la autoridad judicial',
    'fecha de presentacion de solicitud a la autoridad judicial',
  ],
  'fecha de presentacion de solicitud a la autoridad': [
    'fecha de presentacion de la solicitud a la autoridad',
    'fecha de presentacion de la solicitud a la autoridad judicial',
    'fecha de presentacion de solicitud a la autoridad judicial',
  ],
  'fecha de radicacion de solicitud de utilidad publica': ['fecha de radicacion de la solicitud de utilidad publica'],
  'fecha de radicacion de la solicitud de utilidad publica': ['fecha de radicacion de solicitud de utilidad publica'],
};

function maybeDecodeMojibake(value) {
  const raw = String(value ?? '');
  if (!/[\u00C3\u00C2\u00E2]/.test(raw)) return raw;
  try {
    return Buffer.from(raw, 'latin1').toString('utf8');
  } catch (_e) {
    return raw;
  }
}

function norm(value) {
  return maybeDecodeMojibake(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normLoose(value) {
  return maybeDecodeMojibake(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

const ALLOWED_DEPARTAMENTOS_SCOPE = new Set(
  ['Antioquia', 'Norte de Santander', 'Cauca', 'Santander'].map((value) => normLoose(value))
);

function makeUniqueHeader(existing, base) {
  let out = base;
  let n = 1;
  while (existing.has(out)) {
    n += 1;
    out = `${base}__${n}`;
  }
  existing.add(out);
  return out;
}

function sanitizeHeaders(input) {
  const existing = new Set();
  return (input || []).map((h, i) => {
    const raw = String(h ?? '');
    const trimmed = raw.trim();
    const base = trimmed || `__extra_${i}`;
    return makeUniqueHeader(existing, base);
  });
}

function buildHeaderIndex(raw, sanitized) {
  const map = new Map();
  (raw || []).forEach((h, i) => {
    const rawKey = String(h ?? '');
    const sanitizedKey = sanitized[i];
    map.set(norm(rawKey), sanitizedKey);
    map.set(norm(sanitizedKey), sanitizedKey);
  });
  return map;
}

function buildHeaderLooseIndex(raw, sanitized) {
  const map = new Map();
  (raw || []).forEach((h, i) => {
    const rawKey = String(h ?? '');
    const sanitizedKey = sanitized[i];
    map.set(normLoose(rawKey), sanitizedKey);
    map.set(normLoose(sanitizedKey), sanitizedKey);
  });
  return map;
}

function toLogicalHeader(headerName) {
  const source = maybeDecodeMojibake(String(headerName ?? ''));
  const mapped = TODO_TO_LEGACY_HEADERS[normLoose(source)];
  return String(mapped || source).trim();
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[,\n\r"]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function loadRaw() {
  const rawBuffer = fs.readFileSync(CSV_PATH);
  const utf8Text = rawBuffer.toString('utf8');
  const text = utf8Text.includes('\uFFFD') ? rawBuffer.toString('latin1') : utf8Text;

  let hdr = null;
  let hdrLogical = null;
  const rows = parse(text, {
    bom: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    columns: (h) => {
      hdr = Array.isArray(h) ? h.map((x) => maybeDecodeMojibake(String(x ?? ''))) : [];
      hdrLogical = (hdr || []).map((name) => toLogicalHeader(name));
      return sanitizeHeaders(hdrLogical);
    },
  });

  const decodedRows = rows.map((row) => {
    const next = {};
    Object.keys(row || {}).forEach((key) => {
      const value = row?.[key];
      next[key] = typeof value === 'string' ? maybeDecodeMojibake(value) : value;
    });
    return next;
  });

  rawHeaders = hdr || [];
  logicalHeaders = hdrLogical || [];
  headers = sanitizeHeaders(logicalHeaders);
  headerByNorm = buildHeaderIndex(rawHeaders, headers);
  headerByNormLoose = buildHeaderLooseIndex(rawHeaders, headers);
  headerKeyCache = new Map();
  scopedRowsCache = null;

  return decodedRows;
}

function getRaw() {
  if (!rawCache) rawCache = loadRaw();
  return rawCache;
}

function getHeaderKey(columnName) {
  getRaw();
  const cacheKey = normLoose(columnName);
  if (headerKeyCache && headerKeyCache.has(cacheKey)) return headerKeyCache.get(cacheKey);

  const normalized = norm(columnName);
  const direct = headerByNorm.get(normalized);
  if (direct) {
    headerKeyCache?.set(cacheKey, direct);
    return direct;
  }

  const loose = normLoose(columnName);
  const fromLooseHeader = headerByNormLoose.get(loose);
  if (fromLooseHeader) {
    headerKeyCache?.set(cacheKey, fromLooseHeader);
    return fromLooseHeader;
  }

  const aliases = HEADER_ALIASES[loose] || [];
  for (const alias of aliases) {
    const aliasKey = headerByNorm.get(norm(alias));
    if (aliasKey) {
      headerKeyCache?.set(cacheKey, aliasKey);
      return aliasKey;
    }

    const aliasLoose = normLoose(alias);
    const looseHit = headerByNormLoose.get(aliasLoose);
    if (looseHit) {
      headerKeyCache?.set(cacheKey, looseHit);
      return looseHit;
    }
  }

  headerKeyCache?.set(cacheKey, null);
  return null;
}

function ensureColumn(columnName, defaultValue = '') {
  getRaw();

  const existing = getHeaderKey(columnName);
  if (existing) return existing;

  const raw = String(columnName ?? '');
  const sanitized = makeUniqueHeader(new Set(headers), raw.trim() || `__extra_${rawHeaders.length}`);

  rawHeaders.push(raw);
  logicalHeaders.push(raw);
  headers.push(sanitized);
  headerByNorm = buildHeaderIndex(rawHeaders, headers);
  headerByNormLoose = buildHeaderLooseIndex(rawHeaders, headers);
  headerKeyCache = new Map();

  rawCache.forEach((row) => {
    if (row && row[sanitized] === undefined) row[sanitized] = defaultValue;
  });

  return sanitized;
}

function getValue(row, columnName, fallback = '') {
  const key = getHeaderKey(columnName);
  if (!key) return fallback;
  const val = row?.[key];
  const text = val == null ? '' : String(val);
  return text.trim() === '' ? fallback : val;
}

function setValue(row, columnName, value) {
  const key = ensureColumn(columnName);
  row[key] = value == null ? '' : value;
}

function getDocumentoKey() {
  return (
    getHeaderKey('Número de identificación') ||
    getHeaderKey('Numero de identificacion') ||
    getHeaderKey('numeroIdentificacion') ||
    getHeaderKey('numero')
  );
}

function getSituacionKey() {
  return getHeaderKey('Situación Jurídica') || getHeaderKey('situacion_juridica') || getHeaderKey('situacion');
}

function getSituacionActualizadaKey() {
  return (
    getHeaderKey('Situación Jurídica actualizada (de conformidad con la rama judicial)') ||
    getHeaderKey('situacion_juridica_actualizada') ||
    getHeaderKey('Situación Jurídica actualizada')
  );
}

function getDepartamentoKey() {
  return (
    getHeaderKey('Departamento del lugar de privación de la libertad') ||
    getHeaderKey('Departamento del lugar de privacion de la libertad') ||
    getHeaderKey('Departamento') ||
    getHeaderKey('departamento')
  );
}

function normalizeDepartamentoForScope(value) {
  return normLoose(String(value ?? '')).replace(/\s+/g, ' ').trim();
}

function isRowAllowedByScope(row, departamentoKey = null) {
  const key = departamentoKey || getDepartamentoKey();
  if (!key) return true;
  const departamento = normalizeDepartamentoForScope(row?.[key]);
  if (!departamento) return false;
  return ALLOWED_DEPARTAMENTOS_SCOPE.has(departamento);
}

function getScopedRows() {
  const rows = getRaw();
  if (scopedRowsCache) return scopedRowsCache;

  const departamentoKey = getDepartamentoKey();
  if (!departamentoKey) {
    scopedRowsCache = rows;
    return scopedRowsCache;
  }

  scopedRowsCache = rows.filter((row) => isRowAllowedByScope(row, departamentoKey));
  return scopedRowsCache;
}

function expandScientificIntegerString(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const match = text.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!match) return '';

  const sign = match[1] || '';
  const intPart = match[2] || '';
  const fracPart = match[3] || '';
  const exponent = Number.parseInt(match[4] || '0', 10);

  if (!Number.isFinite(exponent)) return '';
  if (sign === '-') return '';

  const digits = `${intPart}${fracPart}`;
  const decimalIndex = intPart.length + exponent;

  if (decimalIndex < 0) return '';

  if (decimalIndex >= digits.length) {
    return `${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  }

  const integerPart = digits.slice(0, decimalIndex);
  const fractionalPart = digits.slice(decimalIndex);
  if (!/^0*$/.test(fractionalPart)) return '';
  return integerPart;
}

function normalizeDocumentoValue(value) {
  const raw = maybeDecodeMojibake(String(value ?? '')).trim();
  if (!raw) return '';

  const scientificExpanded = expandScientificIntegerString(raw);
  const source = scientificExpanded || raw;

  const decimalWhole = source.match(/^([+-]?\d+)\.0+$/);
  const maybeInteger = decimalWhole ? decimalWhole[1] : source;
  if (/^[+-]?\d+$/.test(maybeInteger)) return maybeInteger.replace(/^\+/, '');

  const compactNumeric = source.replace(/[\s.,_-]+/g, '');
  if (/^[+-]?\d+$/.test(compactNumeric)) return compactNumeric.replace(/^\+/, '');

  return normLoose(raw).replace(/\s+/g, '');
}

function isSameDocumento(a, b) {
  return normalizeDocumentoValue(a) === normalizeDocumentoValue(b);
}

function getDocumentoRowIndexes(rows, docKey, documento) {
  const normalizedTarget = normalizeDocumentoValue(documento);
  if (!normalizedTarget) return [];
  const departamentoKey = getDepartamentoKey();

  const out = [];
  for (let idx = 0; idx < (rows || []).length; idx += 1) {
    const row = rows[idx];
    if (!isRowAllowedByScope(row, departamentoKey)) continue;
    const rowDoc = normalizeDocumentoValue(row?.[docKey]);
    if (rowDoc !== normalizedTarget) continue;
    out.push(idx);
  }
  return out;
}

function getLastDocumentoRowIndex(rows, docKey, documento) {
  const indexes = getDocumentoRowIndexes(rows, docKey, documento);
  return indexes.length ? indexes[indexes.length - 1] : -1;
}

function computeTipo(row) {
  const sj = String(getValue(row, 'Situación Jurídica', '') || '').toLowerCase();
  const sja = String(
    getValue(row, 'Situación Jurídica actualizada (de conformidad con la rama judicial)', '') || ''
  ).toLowerCase();

  if (sja.includes('condenad')) return 'condenado';
  if (sj.includes('condenad')) return 'condenado';
  return 'sindicado';
}

function getAll() {
  return getScopedRows();
}

function getColumns() {
  getRaw();
  const seen = new Set();
  const unique = [];
  for (const h of logicalHeaders || []) {
    const col = String(h ?? '');
    if (col.trim() === '') continue;
    const key = norm(col);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(col);
  }
  return unique;
}

function getByDocumento(documento) {
  const doc = String(documento ?? '').trim();
  if (!doc) return null;

  const docKey = getDocumentoKey();
  if (!docKey) return null;

  const rows = getRaw();
  const departamentoKey = getDepartamentoKey();
  const normalizedDoc = normalizeDocumentoValue(doc);
  const hits = rows
    .map((r, idx) => ({ row: r, idx }))
    .filter(
      ({ row }) =>
        isRowAllowedByScope(row, departamentoKey) && normalizeDocumentoValue(row?.[docKey]) === normalizedDoc
    );
  if (!hits.length) return null;

  // Para precarga del formulario: toma la actuacion mas reciente.
  const lastHit = hits[hits.length - 1].row;
  const currentDef = readDefensorValue(lastHit);
  if (currentDef) {
    const hydrated = { ...lastHit };
    writeDefensorValue(hydrated, currentDef);
    return hydrated;
  }

  // Compatibilidad: si la ultima actuacion no trae defensor pero otra si, lo expone.
  const fallbackWithDef = [...hits]
    .reverse()
    .find(({ row }) => readDefensorValue(row) !== '');
  if (!fallbackWithDef) return lastHit;

  const hydrated = { ...lastHit };
  writeDefensorValue(hydrated, readDefensorValue(fallbackWithDef.row));
  return hydrated;
}

function buildActuacionId(documento, rowIndex) {
  return `${norm(documento)}-${rowIndex}`;
}

function parseRowIndexFromActuacionId(actuacionId) {
  const text = String(actuacionId ?? '').trim();
  if (!text) return null;
  const match = text.match(/-(\d+)$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeBaseFieldName(value) {
  return maybeDecodeMojibake(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

const CAMPOS_BASE_NUEVA_ACTUACION = new Set([
  'nombre',
  'nombre usuario',
  'tipo de indentificacion',
  'tipo de identificacion',
  'numero de identificacion',
  'numero',
  'situacion juridica',
  'situacion',
  'situacion juridica actualizada de conformidad con la rama judicial',
  'situacion juridica actualizada',
  'genero',
  'enfoque etnico racial cultural',
  'enfoque',
  'nacionalidad',
  'fecha de nacimiento',
  'edad',
  'lugar de privacion de la libertad',
  'lugar de privacion',
  'nombre del lugar de privacion de la libertad',
  'establecimiento',
  'departamento del lugar de privacion de la libertad',
  'departamento',
  'distrito municipio del lugar de privacion de la libertad',
  'municipio',
  'la persona sigue en el cdt',
  'sigue cdt',
  'autoridad a cargo',
  'autoridad',
  'numero de proceso',
  'proceso',
  'delitos',
  'fecha de captura',
  'pena anos meses y dias',
  'pena',
  'pena total en dias',
  'pena dias',
  'tiempo que la persona lleva privada de la libertad en dias',
  'privacion',
  'redencion total acumulada en dias',
  'redencion',
  'tiempo efectivo de pena cumplida en dias teniendo en cuenta la redencion',
  'tiempo efectivo',
  'porcentaje de avance de pena cumplida',
  'porcentaje',
  'fase de tramiento',
  'fase',
  'cuenta con requerimientos judiciales por otros procesos',
  'requerimienotosi',
  'fecha ultima calificacion',
  'fecha calificacion',
  'calificacion de conducta',
  'calificacion',
  'no acta de calificacion de conducta',
  'evaluacion de conducta desde',
  'evaluacion de conducta hasta',
  'pag',
  'defensor a publico a asignado para tramitar la solicitud',
  'defensor',
  '__rowindex',
]);

function isBaseFieldForNuevaActuacion(value) {
  return CAMPOS_BASE_NUEVA_ACTUACION.has(normalizeBaseFieldName(value));
}

function getRawHeaderByKey(headerKey) {
  getRaw();
  const idx = headers.indexOf(headerKey);
  if (idx < 0) return headerKey;
  return rawHeaders[idx] || headerKey;
}

function getActuacionesByDocumento(documento) {
  const doc = String(documento ?? '').trim();
  if (!doc) return [];

  const docKey = getDocumentoKey();
  if (!docKey) return [];

  const normalizedDoc = normalizeDocumentoValue(doc);
  const departamentoKey = getDepartamentoKey();

  return getRaw()
    .map((registro, rowIndex) => ({ registro, rowIndex }))
    .filter(
      ({ registro }) =>
        isRowAllowedByScope(registro, departamentoKey) &&
        normalizeDocumentoValue(registro?.[docKey]) === normalizedDoc
    )
    .map(({ registro, rowIndex }) => ({
      id: buildActuacionId(doc, rowIndex),
      rowIndex,
      registro,
    }));
}

function createActuacionByDocumento(documento, payload) {
  const doc = String(documento ?? '').trim();
  if (!doc) return null;

  const docKey = getDocumentoKey();
  if (!docKey) return null;

  const rows = getRaw();
  const actuacionesExistentes = getActuacionesByDocumento(doc);
  if (!actuacionesExistentes.length) return null;

  const referencia =
    rows[actuacionesExistentes[actuacionesExistentes.length - 1].rowIndex] || actuacionesExistentes[0].registro;
  const defensorBase =
    readDefensorValue(referencia) ||
    [...actuacionesExistentes]
      .reverse()
      .map(({ rowIndex }) => rows[rowIndex])
      .map((row) => readDefensorValue(row))
      .find((value) => String(value || '').trim() !== '') ||
    '';

  const incoming = payload && typeof payload === 'object' ? payload : {};
  const safe = incoming.data && typeof incoming.data === 'object' ? { ...incoming.data } : { ...incoming };

  // La fila nueva solo conserva Bloques 1-2; Bloque 3+ queda limpio por defecto.
  const nuevaFila = {};
  (headers || []).forEach((headerKey, index) => {
    const rawHeader = rawHeaders[index] || headerKey;
    nuevaFila[headerKey] = isBaseFieldForNuevaActuacion(rawHeader) ? referencia?.[headerKey] ?? '' : '';
  });

  Object.keys(safe).forEach((fieldName) => {
    const headerKey = getHeaderKey(fieldName);
    if (!headerKey) return;
    const rawHeader = getRawHeaderByKey(headerKey);
    if (!isBaseFieldForNuevaActuacion(rawHeader) && !isBaseFieldForNuevaActuacion(headerKey)) return;
    nuevaFila[headerKey] = safe[fieldName] == null ? '' : safe[fieldName];
  });

  nuevaFila[docKey] = doc;
  if (!readDefensorValue(nuevaFila) && defensorBase) {
    writeDefensorValue(nuevaFila, defensorBase);
  }

  rows.push(nuevaFila);
  saveRaw(rows);

  const rowIndex = rows.length - 1;
  return {
    id: buildActuacionId(doc, rowIndex),
    rowIndex,
    registro: nuevaFila,
  };
}

function updateByDocumento(documento, patch) {
  const doc = String(documento ?? '').trim();
  if (!doc) return null;

  const docKey = getDocumentoKey();
  if (!docKey) return null;

  const rows = getRaw();
  const incoming = patch && typeof patch === 'object' ? patch : {};

  const explicitRowIndex =
    Number.isInteger(incoming?.rowIndex) && incoming.rowIndex >= 0 ? Number(incoming.rowIndex) : null;
  const parsedActuacionRowIndex = parseRowIndexFromActuacionId(incoming?.actuacionId);
  const departamentoKey = getDepartamentoKey();

  let idx = -1;
  if (
    explicitRowIndex != null &&
    isSameDocumento(rows?.[explicitRowIndex]?.[docKey], doc) &&
    isRowAllowedByScope(rows?.[explicitRowIndex], departamentoKey)
  ) {
    idx = explicitRowIndex;
  } else if (
    parsedActuacionRowIndex != null &&
    isSameDocumento(rows?.[parsedActuacionRowIndex]?.[docKey], doc) &&
    isRowAllowedByScope(rows?.[parsedActuacionRowIndex], departamentoKey)
  ) {
    idx = parsedActuacionRowIndex;
  } else {
    idx = getLastDocumentoRowIndex(rows, docKey, doc);
  }
  if (idx < 0) return null;

  const safe = incoming.data && typeof incoming.data === 'object' ? { ...incoming.data } : { ...incoming };

  ensureColumn('Estado del caso', '');
  ensureColumn('Sentido de la decisión', '');
  ensureColumn('Motivo de la decisión negativa', '');
  ensureColumn('Sentido de la decisión que resuelve recurso', '');
  ensureColumn('Sentido de la decisión que resuelve la solicitud', '');
  ensureColumn('RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO', '');
  ensureColumn('SENTIDO DE LA DECISIÓN', '');
  ensureColumn('MOTIVO DE LA DECISIÓN NEGATIVA', '');
  ensureColumn('¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?', '');
  ensureColumn('Fecha de presentación del recurso', '');
  ensureColumn('Fecha de presentación de solicitud a la autoridad', '');
  ensureColumn('Fecha de presentación de la solicitud a la autoridad', '');
  ensureColumn('Fecha de radicación de solicitud de utilidad pública', '');
  ensureColumn('Fecha de radicación de la solicitud de utilidad pública', '');
  ensureColumn('SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO', '');
  ensureColumn('Cierre del caso por imposibilidad de avanzar (si aplica)', '');
  ensureColumn('Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad pública', '');
  ensureColumn('No.Acta de calificación de conducta', '');
  ensureColumn('Evaluación de conducta desde', '');
  ensureColumn('Evaluación de conducta hasta', '');
  ensureColumn('redirectedToAurora', '');

  delete safe.caseId;
  delete safe.casos;
  delete safe.activeCaseId;
  delete safe.tipo;
  delete safe.tipoPpl;
  delete safe.data;
  delete safe.rowIndex;
  delete safe.actuacionId;

  const row = rows[idx];
  Object.keys(safe).forEach((k) => {
    const key = getHeaderKey(k);
    if (key) row[key] = safe[k];
  });

  row[docKey] = doc;

  saveRaw(rows);
  return row;
}

function saveRaw(rows) {
  getRaw();
  const hdr = rawHeaders && rawHeaders.length ? rawHeaders : [];
  const keys = headers && headers.length ? headers : [];

  const lines = [];
  lines.push(hdr.map((h) => csvEscape(h)).join(','));

  for (const r of rows || []) {
    const line = keys.map((k) => csvEscape(r?.[k])).join(',');
    lines.push(line);
  }

  fs.writeFileSync(CSV_PATH, lines.join('\n'), 'utf8');
  dataVersion += 1;
  scopedRowsCache = null;
}

function getDataVersion() {
  return dataVersion;
}

function isPlaceholderDefensor(nombre) {
  const raw = String(nombre || '').trim();
  if (!raw) return false;
  const cleaned = raw.toUpperCase().replace(/\s+/g, ' ');
  if (cleaned === 'DEFENSOR(A) - EJEMPLO') return true;
  if (/^DEFENSOR\s*\(A\)\s*\d+$/.test(cleaned)) return true;
  return false;
}

function getDefensorKey() {
  return (
    getHeaderKey('Defensor(a) Público(a) Asignado para tramitar la solicitud') ||
    getHeaderKey('Defensor(a) Publico(a) Asignado para tramitar la solicitud')
  );
}

function getDefensorAliasKeys() {
  const keys = new Set();
  const aliases = [
    'Defensor(a) Público(a) Asignado para tramitar la solicitud',
    'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
    'Defensor',
  ];

  aliases.forEach((name) => {
    const key = getHeaderKey(name);
    if (key) keys.add(key);
  });

  // Garantiza que exista al menos una columna canonica para persistir.
  if (!keys.size) {
    keys.add(ensureColumn('Defensor(a) Público(a) Asignado para tramitar la solicitud', ''));
  }

  return Array.from(keys);
}

function readDefensorValue(row) {
  const keys = getDefensorAliasKeys();
  for (const key of keys) {
    const val = String(row?.[key] ?? '').trim();
    if (val) return val;
  }
  return '';
}

function writeDefensorValue(row, defensor) {
  const value = String(defensor ?? '').trim();
  const keys = getDefensorAliasKeys();
  keys.forEach((key) => {
    row[key] = value;
  });
}

function getPagKey() {
  return getHeaderKey('PAG') || ensureColumn('PAG', '');
}

function writePagValue(row, pagAsignador) {
  const value = String(pagAsignador ?? '').trim();
  const key = getPagKey();
  row[key] = value;
}

function assignDefensor(documentos, defensor, options = {}) {
  const docs = new Set((documentos || []).map((d) => normalizeDocumentoValue(d)).filter(Boolean));
  if (!docs.size) return 0;

  const docKey = getDocumentoKey();
  if (!docKey) return 0;
  const departamentoKey = getDepartamentoKey();
  const pagAsignador = String(options?.pagAsignador ?? '').trim();

  let updated = 0;
  getRaw().forEach((row) => {
    if (!isRowAllowedByScope(row, departamentoKey)) return;
    const doc = normalizeDocumentoValue(row?.[docKey]);
    if (!docs.has(doc)) return;
    writeDefensorValue(row, defensor);
    if (pagAsignador) writePagValue(row, pagAsignador);
    updated += 1;
  });

  if (updated) saveRaw(rawCache);
  return updated;
}

function getDefensoresDistinct({ tipo } = {}) {
  const docKey = getDocumentoKey();

  if (!docKey) return [];
  const needTipo = String(tipo || '').trim().toLowerCase();
  const departamentoKey = getDepartamentoKey();

  const set = new Set();
  getRaw().forEach((row) => {
    if (!isRowAllowedByScope(row, departamentoKey)) return;
    if (needTipo) {
      const computed = computeTipo(row);
      if (computed !== needTipo) return;
    }

    const val = readDefensorValue(row);
    if (val && !isPlaceholderDefensor(val)) set.add(val);
  });
  return Array.from(set).sort();
}

module.exports = {
  getAll,
  getColumns,
  getByDocumento,
  getActuacionesByDocumento,
  createActuacionByDocumento,
  updateByDocumento,
  assignDefensor,
  getDefensoresDistinct,
  getHeaderKey,
  getValue,
  setValue,
  ensureColumn,
  computeTipo,
  getDataVersion,
};
