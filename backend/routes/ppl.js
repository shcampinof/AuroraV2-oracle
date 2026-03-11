const express = require('express');
const consolidado = require('../db/oracleConsolidado.repo');
const pagRepo = require('../db/pag.repo');

const router = express.Router();

const DEFAULT_LIST_LIMIT = 5000;
const MAX_LIST_LIMIT = 10000;
const DEFAULT_CONDENADOS_LIMIT = 1000;
const DEFAULT_CONDENADOS_FILTERED_LIMIT = 200;
const MAX_CONDENADOS_FILTERED_LIMIT = 200;
const CONDENADOS_COLUMNS = [
  'numeroIdentificacion',
  'nombreUsuario',
  'lugarReclusion',
  'departamentoLugarReclusion',
  'municipioLugarReclusion',
  'autoridadCargo',
  'numeroProceso',
  'situacionJuridica',
  'defensorAsignado',
  'Estado del caso',
];
const MAX_ROUTE_CACHE_VARIANTS = 12;
const pplListCache = new Map();
const condenadosListCache = new Map();

function boundedCacheSet(map, key, value, maxEntries = MAX_ROUTE_CACHE_VARIANTS) {
  if (map.size >= maxEntries && !map.has(key)) {
    map.clear();
  }
  map.set(key, value);
}

function parseLimit(rawLimit, fallback = DEFAULT_LIST_LIMIT) {
  const parsed = Number.parseInt(String(rawLimit || `${fallback}`), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_LIST_LIMIT);
}

function parseFilteredLimit(rawLimit, fallback = DEFAULT_CONDENADOS_FILTERED_LIMIT) {
  const parsed = Number.parseInt(String(rawLimit || `${fallback}`), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_CONDENADOS_FILTERED_LIMIT);
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeDocumento(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function firstFilled(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function getValueWithFallback(row, primary, secondary = '', fallback = '') {
  return consolidado.getValue(row, primary, consolidado.getValue(row, secondary, fallback));
}

function canonicalEstadoLabel(value) {
  const key = normalizeText(value);
  if (!key) return '';
  if (key.includes('analizar el caso')) return 'Analizar el caso';
  if (key.includes('entrevistar al usuario')) return 'Entrevistar al usuario';
  if (key.includes('presentar solicitud')) return 'Presentar solicitud';
  if (key.includes('pendiente decision')) return 'Pendiente decisión';
  if (key.includes('caso cerrado') || key === 'cerrado') return 'Caso cerrado';
  return '';
}

function resolveEstadoLabelFromRawRow(row) {
  const estadoCaso = getValueWithFallback(row, 'Estado del caso', '', '');
  const estadoTramite = getValueWithFallback(row, 'Estado del trámite', 'Estado del tramite', '');
  const accion = getValueWithFallback(row, 'Acción a realizar', 'Accion a realizar', '');
  const actuacion = getValueWithFallback(row, 'Actuación a adelantar', 'Actuacion a adelantar', '');
  const posible = getValueWithFallback(row, 'posibleActuacionJudicial', '', '');
  return firstFilled(
    canonicalEstadoLabel(estadoCaso),
    canonicalEstadoLabel(estadoTramite),
    canonicalEstadoLabel(accion),
    canonicalEstadoLabel(actuacion),
    canonicalEstadoLabel(posible)
  );
}

function buildEstadoSource(row) {
  return {
    'Fecha de análisis jurídico del caso': getValueWithFallback(
      row,
      'Fecha de análisis jurídico del caso',
      'Fecha de analisis juridico del caso',
      ''
    ),
    'Resumen del análisis del caso': getValueWithFallback(
      row,
      'Resumen del análisis del caso',
      'Resumen del analisis del caso',
      ''
    ),
    'Fecha de entrevista': getValueWithFallback(row, 'Fecha de entrevista', '', ''),
    'Actuación a adelantar': getValueWithFallback(row, 'Actuación a adelantar', 'Actuacion a adelantar', ''),
    'Procedencia de libertad condicional': getValueWithFallback(
      row,
      'Procedencia de libertad condicional',
      '',
      ''
    ),
    'Procedencia de prisión domiciliaria de mitad de pena': getValueWithFallback(
      row,
      'Procedencia de prisión domiciliaria de mitad de pena',
      'Procedencia de prision domiciliaria de mitad de pena',
      ''
    ),
    'Procedencia de utilidad pública (solo para mujeres)': getValueWithFallback(
      row,
      'Procedencia de utilidad pública (solo para mujeres)',
      'Procedencia de utilidad publica (solo para mujeres)',
      ''
    ),
    'Procedencia de pena cumplida': getValueWithFallback(row, 'Procedencia de pena cumplida', '', ''),
    'Decisión del usuario': getValueWithFallback(row, 'Decisión del usuario', 'Decision del usuario', ''),
    'Cumple el requisito de marginalidad': getValueWithFallback(
      row,
      'Cumple el requisito de marginalidad',
      '',
      ''
    ),
    'Cumple el requisito de jefatura de hogar': getValueWithFallback(
      row,
      'Cumple el requisito de jefatura de hogar',
      '',
      ''
    ),
    'Se presenta recurso': getValueWithFallback(row, 'Se presenta recurso', '', ''),
    'Sentido de la decisión': getValueWithFallback(row, 'Sentido de la decisión', 'Sentido de la decision', ''),
    'Sentido de la decisión que resuelve recurso': getValueWithFallback(
      row,
      'Sentido de la decisión que resuelve recurso',
      'Sentido de la decision que resuelve recurso',
      ''
    ),
    'Sentido de la decisión que resuelve la solicitud': getValueWithFallback(
      row,
      'Sentido de la decisión que resuelve la solicitud',
      'Sentido de la decision que resuelve la solicitud',
      ''
    ),
    'Fecha de presentación de la solicitud a la autoridad': getValueWithFallback(
      row,
      'Fecha de presentación de la solicitud a la autoridad',
      'Fecha de presentacion de la solicitud a la autoridad',
      ''
    ),
    'Fecha de radicación de solicitud de utilidad pública': getValueWithFallback(
      row,
      'Fecha de radicación de solicitud de utilidad pública',
      'Fecha de radicacion de solicitud de utilidad publica',
      ''
    ),
    'Fecha de decisión de la autoridad': getValueWithFallback(
      row,
      'Fecha de decisión de la autoridad',
      'Fecha de decision de la autoridad',
      ''
    ),
    'Fecha de asignación del PAG': getValueWithFallback(
      row,
      'Fecha de asignación del PAG',
      'Fecha de asignacion del PAG',
      ''
    ),
    'Estado del caso': getValueWithFallback(row, 'Estado del caso', '', ''),
    'Estado del trámite': getValueWithFallback(row, 'Estado del trámite', 'Estado del tramite', ''),
    'Acción a realizar': getValueWithFallback(row, 'Acción a realizar', 'Accion a realizar', ''),
    'posibleActuacionJudicial': getValueWithFallback(row, 'posibleActuacionJudicial', '', ''),
  };
}

function mapCondenadoRow(row) {
  return {
    numeroIdentificacion: getValueWithFallback(row, 'Numero de identificacion', 'numero', ''),
    nombreUsuario: getValueWithFallback(row, 'Nombre', 'Nombre usuario', ''),
    lugarReclusion: getValueWithFallback(
      row,
      'Nombre del lugar de privacion de la libertad',
      'ESTABLECIMIENTO',
      ''
    ),
    departamentoLugarReclusion: getValueWithFallback(
      row,
      'Departamento del lugar de privacion de la libertad',
      'Departamento',
      ''
    ),
    municipioLugarReclusion: getValueWithFallback(
      row,
      'Distrito/municipio del lugar de privacion de la libertad',
      'Municipio',
      ''
    ),
    autoridadCargo: getValueWithFallback(row, 'Autoridad a cargo', 'autoridad', ''),
    numeroProceso: getValueWithFallback(row, 'Numero de proceso', 'Proceso', ''),
    situacionJuridica:
      getValueWithFallback(row, 'Situacion Juridica', 'situacion', '') ||
      getValueWithFallback(
        row,
        'Situacion Juridica actualizada (de conformidad con la rama judicial)',
        'Situacion Juridica actualizada',
        ''
      ),
    defensorAsignado: getValueWithFallback(
      row,
      'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
      'Defensor',
      ''
    ),
    estadoSource: buildEstadoSource(row),
    'Estado del caso': resolveEstadoLabelFromRawRow(row),
  };
}

function getCondenadosFiltersFromQuery(query) {
  return {
    defensor: String(query?.defensor ?? '').trim(),
    nombre: String(query?.nombre ?? '').trim(),
    documento: String(query?.documento ?? '').trim(),
    lugar: String(query?.lugar ?? '').trim(),
    departamento: String(query?.departamento ?? '').trim(),
    municipio: String(query?.municipio ?? '').trim(),
    estado: String(query?.estado ?? '').trim(),
  };
}

function hasCondenadosFilters(filters) {
  return Object.values(filters || {}).some((value) => String(value || '').trim() !== '');
}

function matchesPrefix(value, filterValue) {
  const needle = normalizeText(filterValue);
  if (!needle) return true;
  const haystack = normalizeText(value);
  if (!haystack) return false;
  return haystack.startsWith(needle);
}

function matchesContains(value, filterValue) {
  const needle = normalizeText(filterValue);
  if (!needle) return true;
  const haystack = normalizeText(value);
  if (!haystack) return false;
  return haystack.includes(needle);
}

function matchesCondenadoFilters(row, filters) {
  const documentoFiltro = normalizeDocumento(filters?.documento);
  if (documentoFiltro) {
    const documentoRow = normalizeDocumento(row?.numeroIdentificacion);
    if (!documentoRow || !documentoRow.startsWith(documentoFiltro)) return false;
  }

  if (!matchesContains(row?.nombreUsuario, filters?.nombre)) return false;
  if (!matchesPrefix(row?.defensorAsignado, filters?.defensor)) return false;
  if (!matchesPrefix(row?.lugarReclusion, filters?.lugar)) return false;
  if (!matchesPrefix(row?.departamentoLugarReclusion, filters?.departamento)) return false;
  if (!matchesPrefix(row?.municipioLugarReclusion, filters?.municipio)) return false;

  const estadoFiltro = canonicalEstadoLabel(filters?.estado);
  if (estadoFiltro) {
    const estadoRow = canonicalEstadoLabel(row?.['Estado del caso']);
    if (!estadoRow || estadoRow !== estadoFiltro) return false;
  }

  return true;
}

function uniqueMappedRows(rows) {
  const byKey = new Map();
  for (const row of rows || []) {
    const key = [
      normalizeText(row?.numeroIdentificacion),
      normalizeText(row?.numeroProceso),
      normalizeText(row?.nombreUsuario),
      normalizeText(row?.situacionJuridica),
      normalizeText(row?.municipioLugarReclusion),
    ].join('|');
    // Conserva la version mas reciente de cada caso (misma llave).
    byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

function keepLatestByDocumento(rows) {
  const byDoc = new Map();
  for (const row of rows || []) {
    const docKey = normalizeDocumento(row?.numeroIdentificacion);
    if (!docKey) continue;
    // La ultima aparicion corresponde a la actuacion mas reciente.
    byDoc.set(docKey, row);
  }
  return Array.from(byDoc.values());
}

function resolveDefensorFromRegistro(registro) {
  const source = registro && typeof registro === 'object' ? registro : {};
  const directKeys = [
    'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
    'Defensor(a) Público(a) Asignado para tramitar la solicitud',
    'Defensor(a) PÃºblico(a) Asignado para tramitar la solicitud',
    'Defensor',
    'defensorAsignado',
  ];

  for (const key of directKeys) {
    const value = String(source?.[key] ?? '').trim();
    if (value) return value;
  }

  for (const [key, rawValue] of Object.entries(source)) {
    const normalized = normalizeText(key).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    const isDefensorField =
      normalized === 'defensor a publico a asignado para tramitar la solicitud' ||
      normalized === 'defensor asignado' ||
      normalized === 'defensor';
    if (!isDefensorField) continue;
    const value = String(rawValue ?? '').trim();
    if (value) return value;
  }

  return '';
}

function hydrateRegistroDefensor(registro, fallbackDefensor = '') {
  const base = registro && typeof registro === 'object' ? registro : {};
  const defensor = resolveDefensorFromRegistro(base) || String(fallbackDefensor || '').trim();
  if (!defensor) return { ...base, defensorAsignado: '' };
  return {
    ...base,
    defensorAsignado: defensor,
    'Defensor(a) Publico(a) Asignado para tramitar la solicitud': defensor,
    'Defensor(a) Público(a) Asignado para tramitar la solicitud': defensor,
    Defensor: defensor,
  };
}

async function resolveDefensorByDocumento(documento) {
  const doc = String(documento || '').trim();
  if (!doc) return '';

  const actuaciones = await consolidado.getActuacionesByDocumento(doc);
  let fallback = '';
  for (const item of actuaciones) {
    const row = item?.registro;
    const defensor = resolveDefensorFromRegistro(row);
    if (!defensor) continue;
    fallback = defensor;
  }
  return fallback;
}

function extractDefensorFromPayload(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const source = body?.data && typeof body.data === 'object' ? body.data : body;
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(source, key);

  const keys = [
    'defensorAsignado',
    'Defensor',
    'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
    'Defensor(a) Público(a) Asignado para tramitar la solicitud',
    'Defensor(a) PÃºblico(a) Asignado para tramitar la solicitud',
  ];

  for (const key of keys) {
    if (!hasOwn(key)) continue;
    return String(source[key] ?? '').trim();
  }

  return null;
}

function isOnlyDefensorPayload(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const source = body?.data && typeof body.data === 'object' ? body.data : body;
  const keys = Object.keys(source || {});
  if (!keys.length) return false;

  let hasDefensorKey = false;
  for (const key of keys) {
    const normalized = normalizeText(key).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    const isDefensorField =
      normalized === 'defensor a publico a asignado para tramitar la solicitud' ||
      normalized === 'defensor asignado' ||
      normalized === 'defensor';

    if (isDefensorField) {
      hasDefensorKey = true;
      continue;
    }

    return false;
  }

  return hasDefensorKey;
}

// Listado por tipo: /api/ppl?tipo=condenado | sindicado
router.get('/', async (req, res) => {
  const tipo = String(req.query.tipo || 'all').trim().toLowerCase();
  const limit = parseLimit(req.query.limit, DEFAULT_LIST_LIMIT);
  const version = Number(consolidado.getDataVersion?.() || 0);
  const cacheKey = `${version}|${tipo}|${limit}`;
  if (pplListCache.has(cacheKey)) {
    return res.json(pplListCache.get(cacheKey));
  }

  try {
    const allRows = await consolidado.getAll();
    const rows =
      tipo === 'condenado' || tipo === 'sindicado'
        ? allRows.filter((r) => consolidado.computeTipo(r) === tipo)
        : allRows;
    const payload = { tipo, columns: consolidado.getColumns(), rows: rows.slice(0, limit) };
    boundedCacheSet(pplListCache, cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error('[ppl:listado] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error consultando PPL.' });
  }
});

// Listado de condenados (mapeado para tabla de asignacion)
router.get('/condenados', async (req, res) => {
  const filters = getCondenadosFiltersFromQuery(req.query);
  const hasFilters = hasCondenadosFilters(filters);
  const limit = parseLimit(req.query.limit, DEFAULT_CONDENADOS_LIMIT);
  const filteredLimit = parseFilteredLimit(req.query.filteredLimit, DEFAULT_CONDENADOS_FILTERED_LIMIT);
  const effectiveLimit = hasFilters ? filteredLimit : limit;
  const version = Number(consolidado.getDataVersion?.() || 0);
  const filtersKey = hasFilters ? JSON.stringify(filters) : 'nofilter';
  const cacheKey = `${version}|${limit}|${filteredLimit}|${filtersKey}`;
  if (condenadosListCache.has(cacheKey)) {
    return res.json(condenadosListCache.get(cacheKey));
  }

  try {
    const all = await consolidado.getAll();
    // Esta ruta alimenta la tabla PAG y debe exponer solo casos condenados.
    const onlyCondenados = all.filter((row) => consolidado.computeTipo(row) === 'condenado');
    const ordered = uniqueMappedRows(onlyCondenados.map((row) => mapCondenadoRow(row)));
    const matched = hasFilters ? ordered.filter((mapped) => matchesCondenadoFilters(mapped, filters)) : ordered;
    const documentoFiltro = normalizeDocumento(filters?.documento);
    const matchedCollapsed = documentoFiltro ? keepLatestByDocumento(matched) : matched;
    const rows = matchedCollapsed.slice(0, effectiveLimit);
    const payload = {
      columns: CONDENADOS_COLUMNS,
      rows,
      meta: {
        filtered: hasFilters,
        totalAvailable: ordered.length,
        totalMatched: matchedCollapsed.length,
        returned: rows.length,
        limitApplied: effectiveLimit,
        truncated: matchedCollapsed.length > effectiveLimit,
      },
    };
    boundedCacheSet(condenadosListCache, cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error('[ppl:condenados] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error consultando condenados.' });
  }
});

// Validar cedula PAG contra catalogo CSV
// GET /api/ppl/pag/:cedula/validar
router.get('/pag/:cedula/validar', (req, res) => {
  const cedula = String(req.params?.cedula || '').trim();
  if (!cedula) {
    return res.status(400).json({ message: 'Debe indicar la cedula del PAG.' });
  }

  const pag = pagRepo.findByCedula(cedula);
  if (!pag) {
    return res.status(404).json({ message: 'Cedula PAG no encontrada en el listado.' });
  }

  return res.json({ ok: true, pag });
});

// Asignacion masiva de defensor por documento(s)
// POST /api/ppl/asignar-defensor
// body: { documentos: string[] | string, defensor: string, pagCedula: string }
router.post('/asignar-defensor', async (req, res) => {
  const body = req.body || {};
  const defensor = String(body?.defensor || '').trim();
  const pagCedula = String(body?.pagCedula || '').trim();
  const rawDocs = Array.isArray(body?.documentos) ? body.documentos : [body?.documentos];
  const documentos = rawDocs.map((d) => String(d || '').trim()).filter(Boolean);

  if (!defensor) {
    return res.status(400).json({ message: 'Debe indicar un defensor.' });
  }
  if (!pagCedula) {
    return res.status(400).json({ message: 'Debe indicar la cedula del PAG que asigna.' });
  }
  if (!documentos.length) {
    return res.status(400).json({ message: 'Debe indicar al menos un documento.' });
  }

  const pag = pagRepo.findByCedula(pagCedula);
  if (!pag) {
    return res.status(400).json({ message: 'Cedula PAG no valida para asignar.' });
  }

  try {
    const pagAsignador = pag?.nombre ? `${pag.nombre} (${pag.cedula})` : String(pag.cedula || '').trim();
    const updated = await consolidado.assignDefensor(documentos, defensor, { pagAsignador });
    return res.json({
      ok: true,
      updated,
      documentos: Array.from(new Set(documentos)),
      defensor,
      pag,
    });
  } catch (err) {
    console.error('[ppl:asignar-defensor] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error guardando la asignación de defensor.' });
  }
});

// Historial de actuaciones por documento
router.get('/:documento/actuaciones', async (req, res) => {
  const doc = req.params.documento;
  try {
    const base = await consolidado.getByDocumento(doc);
    if (!base) return res.status(404).json({ message: 'No encontrado' });

    const defensorBase = resolveDefensorFromRegistro(base) || (await resolveDefensorByDocumento(doc));
    const actuaciones = (await consolidado.getActuacionesByDocumento(doc)).map((actuacion) => ({
      ...actuacion,
      registro: hydrateRegistroDefensor(actuacion?.registro, defensorBase),
    }));
    return res.json({ documento: doc, actuaciones });
  } catch (err) {
    console.error('[ppl:actuaciones:get] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error consultando historial de actuaciones.' });
  }
});

// Crear actuacion persistente por documento
router.post('/:documento/actuaciones', async (req, res) => {
  const doc = req.params.documento;
  const body = req.body || {};

  try {
    if (!(await consolidado.getByDocumento(doc))) {
      return res.status(404).json({ message: 'No encontrado' });
    }

    const actuacion = await consolidado.createActuacionByDocumento(doc, body);
    if (!actuacion) {
      return res.status(400).json({ message: 'No fue posible crear la actuacion' });
    }

    const defensorBase = resolveDefensorFromRegistro(actuacion?.registro) || (await resolveDefensorByDocumento(doc));
    const hydratedRegistro = hydrateRegistroDefensor(actuacion?.registro, defensorBase);

    return res.status(201).json({
      documento: doc,
      actuacion: {
        ...actuacion,
        registro: hydratedRegistro,
      },
      registro: hydratedRegistro,
    });
  } catch (err) {
    console.error('[ppl:actuaciones:create] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error creando actuación.' });
  }
});

// Busqueda unificada por documento: devuelve tipo + registro
router.get('/:documento', async (req, res) => {
  const doc = req.params.documento;

  try {
    const r = await consolidado.getByDocumento(doc);
    if (r) {
      const fallbackDefensor = await resolveDefensorByDocumento(doc);
      return res.json({
        tipo: consolidado.computeTipo(r),
        registro: hydrateRegistroDefensor(r, fallbackDefensor),
      });
    }
    return res.status(404).json({ message: 'No encontrado' });
  } catch (err) {
    console.error('[ppl:getByDocumento] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error consultando documento.' });
  }
});

// Update unificado
router.put('/:documento', async (req, res) => {
  const doc = req.params.documento;
  const body = req.body || {};

  try {
    if (await consolidado.getByDocumento(doc)) {
      const defensor = extractDefensorFromPayload(body);
      if (defensor !== null && isOnlyDefensorPayload(body)) {
        const updated = await consolidado.assignDefensor([doc], defensor);
        if (!updated) return res.status(404).json({ message: 'No encontrado' });
        const refreshed = await consolidado.getByDocumento(doc);
        return res.json({ tipo: consolidado.computeTipo(refreshed), registro: hydrateRegistroDefensor(refreshed) });
      }

      const upd = await consolidado.updateByDocumento(doc, body);
      if (!upd) return res.status(404).json({ message: 'No encontrado' });
      return res.json({ tipo: consolidado.computeTipo(upd), registro: hydrateRegistroDefensor(upd) });
    }
    return res.status(404).json({ message: 'No encontrado' });
  } catch (err) {
    console.error('[ppl:update] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error actualizando registro.' });
  }
});

module.exports = router;

