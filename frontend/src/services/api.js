function normalizeApiBase(base) {
  return String(base || '').trim().replace(/\/+$/, '');
}

function ensureApiSuffix(base) {
  const normalized = normalizeApiBase(base);
  if (!normalized) return normalized;

  if (normalized === '/api' || normalized.endsWith('/api')) return normalized;
  if (normalized.startsWith('/')) return `${normalized}/api`;

  try {
    const parsed = new URL(normalized);
    const path = String(parsed.pathname || '');
    if (!path || path === '/') {
      parsed.pathname = '/api';
    } else if (!path.endsWith('/api')) {
      parsed.pathname = `${path.replace(/\/+$/, '')}/api`;
    }
    return normalizeApiBase(parsed.toString());
  } catch {
    return normalized;
  }
}

function isLikelyLocalHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function shouldUseConfiguredApiBase(base) {
  const normalized = normalizeApiBase(base);
  if (!normalized) return false;

  if (typeof window === 'undefined') return true;

  try {
    const parsed = new URL(normalized, window.location.origin);
    const pageIsHttps = String(window.location.protocol || '').toLowerCase() === 'https:';
    const apiProtocol = String(parsed.protocol || '').toLowerCase();
    if (pageIsHttps && apiProtocol === 'http:') return false;

    const apiIsLocal = isLikelyLocalHost(parsed.hostname);
    const pageIsLocal = isLikelyLocalHost(window.location.hostname);
    if (apiIsLocal && !pageIsLocal) return false;

    const isDev =
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      Boolean(import.meta.env.DEV);
    // En desarrollo local, '/api' depende de proxy de Vite.
    // Si no hay proxy activo, termina devolviendo index.html.
    if (isDev && normalized === '/api' && isLikelyLocalHost(window.location.hostname)) return false;

    return true;
  } catch {
    return false;
  }
}

const CONFIGURED_API_BASE = ensureApiSuffix(
  typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_BASE_URL : ''
);

const DEFAULT_API_BASE = '/api';

const API_BASE = shouldUseConfiguredApiBase(CONFIGURED_API_BASE) ? CONFIGURED_API_BASE : DEFAULT_API_BASE;

const DEFAULT_FETCH_TIMEOUT_MS = 60000;

async function fetchJson(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const requestOptions = {
      ...(options || {}),
      signal: controller.signal,
    };
    try {
      const res = await fetch(url, requestOptions);
      return res;
    } catch (firstError) {
      // Fallback de resiliencia: si la base configurada falla en deploy, intenta same-origin /api.
      const fallbackBase = '/api';
      const canRetryWithFallback = API_BASE !== fallbackBase && String(url || '').startsWith(API_BASE);
      if (!canRetryWithFallback) throw firstError;
      const fallbackUrl = `${fallbackBase}${String(url).slice(API_BASE.length)}`;
      return fetch(fallbackUrl, requestOptions);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonOrThrow(res, fallbackMessage) {
  const contentType = String(res?.headers?.get?.('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) return res.json();

  const raw = await res.text().catch(() => '');
  const preview = String(raw || '').slice(0, 80).replace(/\s+/g, ' ').trim();
  throw new Error(
    `${fallbackMessage}. El backend respondio con contenido no JSON (${contentType || 'sin content-type'}): ${preview}`
  );
}

// =====================
// PPL (condenados / sindicados)
// =====================

// LISTADO
// GET /api/ppl?tipo=condenado|sindicado (opcional). Sin `tipo` -> devuelve todos.
export async function getPplListado(tipo) {
  const qs = tipo ? `?tipo=${encodeURIComponent(tipo)}` : '';
  const res = await fetchJson(`${API_BASE}/ppl${qs}`);
  if (!res.ok) throw new Error('Error consultando PPL');
  return readJsonOrThrow(res, 'Error consultando PPL'); // { tipo, columns, rows }
}

// CONSULTA POR CEDULA (unificada)
// GET /api/ppl/:documento
export async function getPplByDocumento(documento) {
  const res = await fetchJson(`${API_BASE}/ppl/${encodeURIComponent(documento)}`);
  if (!res.ok) throw new Error('Registro no encontrado');
  return readJsonOrThrow(res, 'Registro no encontrado'); // { tipo, registro }
}

// UPDATE (mock unificado)
// PUT /api/ppl/:documento
export async function updatePpl(documento, payload) {
  const res = await fetchJson(`${API_BASE}/ppl/${encodeURIComponent(documento)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Error actualizando registro');
  return readJsonOrThrow(res, 'Error actualizando registro'); // { tipo, registro }
}

// CREATE ACTUACION
// POST /api/ppl/:documento/actuaciones
export async function createPplActuacion(documento, payload) {
  const res = await fetchJson(`${API_BASE}/ppl/${encodeURIComponent(documento)}/actuaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error('Error creando actuacion');
  return readJsonOrThrow(res, 'Error creando actuacion'); // { documento, actuacion, registro }
}

// HISTORIAL DE ACTUACIONES
// GET /api/ppl/:documento/actuaciones
export async function getPplActuacionesByDocumento(documento) {
  const doc = String(documento ?? '').trim();
  if (!doc) return { documento: '', actuaciones: [] };

  const res = await fetchJson(`${API_BASE}/ppl/${encodeURIComponent(doc)}/actuaciones`);
  if (!res.ok) throw new Error('Error consultando historial de actuaciones');
  return readJsonOrThrow(res, 'Error consultando historial de actuaciones'); // { documento, actuaciones }
}

// =====================
// Formatos
// =====================
export async function getFormatos() {
  const res = await fetchJson(`${API_BASE}/formatos`);
  if (!res.ok) throw new Error('Error consultando formatos');
  return readJsonOrThrow(res, 'Error consultando formatos');
}

export function getFormatoDownloadUrl(id) {
  return `${API_BASE}/formatos/${encodeURIComponent(id)}/download`;
}

// =====================
// Asignacion de defensores (condenados)
// =====================
export async function getCondenados(options = 1000) {
  const isLegacyNumeric = typeof options === 'number' || typeof options === 'string';
  const source = isLegacyNumeric ? { limit: options } : options && typeof options === 'object' ? options : {};
  const rawTipo = String(source?.tipo || '').trim().toLowerCase();
  const safeTipo =
    rawTipo === 'all' || rawTipo === 'condenado' || rawTipo === 'sindicado' ? rawTipo : '';

  const safeLimit = Number.isFinite(Number(source?.limit))
    ? Math.max(1, Math.min(10000, Number(source.limit)))
    : 1000;
  const safeFilteredLimit = Number.isFinite(Number(source?.filteredLimit))
    ? Math.max(1, Math.min(200, Number(source.filteredLimit)))
    : 200;

  const filters = source?.filters && typeof source.filters === 'object' ? source.filters : {};
  const params = new URLSearchParams();
  if (safeTipo) params.set('tipo', safeTipo);
  params.set('limit', String(safeLimit));

  const filterKeys = [
    'defensor',
    'nombre',
    'documento',
    'lugar',
    'departamento',
    'municipio',
    'estadoAccion',
    'estado',
    'potencialSubrogado',
  ];
  let hasFilters = false;
  filterKeys.forEach((key) => {
    const value = String(filters?.[key] ?? '').trim();
    if (!value) return;
    params.set(key, value);
    hasFilters = true;
  });

  if (hasFilters) {
    params.set('filteredLimit', String(safeFilteredLimit));
  }

  const res = await fetchJson(`${API_BASE}/ppl/condenados?${params.toString()}`);
  if (!res.ok) throw new Error('Error consultando condenados');
  return readJsonOrThrow(res, 'Error consultando condenados'); // { columns, rows, meta }
}

export async function getDefensores() {
  const res = await fetchJson(`${API_BASE}/defensores`);
  if (!res.ok) throw new Error('Error consultando defensores');
  return readJsonOrThrow(res, 'Error consultando defensores'); // { defensores }
}

export async function getDefensoresCondenados() {
  const res = await fetchJson(`${API_BASE}/defensores?source=condenados`);
  if (!res.ok) throw new Error('Error consultando defensores');
  return readJsonOrThrow(res, 'Error consultando defensores'); // { defensores }
}

export async function createDefensor(nombre) {
  const res = await fetchJson(`${API_BASE}/defensores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = String(data?.error || 'Error guardando defensor.');
    throw new Error(message);
  }
  return data; // { defensor }
}

function normalizeDefensorOption(option) {
  if (!option || typeof option !== 'object') return null;

  const id = String(option.id ?? '').trim();
  const nombre = String(option.nombre ?? option.label ?? option.value ?? '').trim();
  if (!nombre) return null;

  return {
    id: id || nombre.toUpperCase().replace(/\s+/g, '_'),
    nombre,
  };
}

export function extractDefensoresCatalogo(data) {
  const opcionesRaw = Array.isArray(data?.opciones)
    ? data.opciones
    : Array.isArray(data?.defensores)
      ? data.defensores.map((name) => ({ nombre: name }))
      : [];

  const map = new Map();
  opcionesRaw.forEach((item) => {
    const normalized = normalizeDefensorOption(item);
    if (!normalized) return;
    const key = String(normalized.id || '').trim().toUpperCase();
    if (!key || map.has(key)) return;
    map.set(key, normalized);
  });

  return Array.from(map.values());
}

export async function getDefensoresCatalogo() {
  const data = await getDefensores();
  return extractDefensoresCatalogo(data);
}

export async function validatePagCedula(cedula) {
  const safeCedula = String(cedula ?? '').replace(/\D+/g, '');
  if (!safeCedula) throw new Error('Debe ingresar la cedula del PAG.');

  const res = await fetchJson(`${API_BASE}/ppl/pag/${encodeURIComponent(safeCedula)}/validar`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.message || 'Cedula PAG no valida.'));
  }

  return data?.pag || null;
}

export async function assignDefensorPpl(documento, defensor, options = {}) {
  const documentos = Array.isArray(documento)
    ? documento.map((d) => String(d || '').trim()).filter(Boolean)
    : [String(documento || '').trim()].filter(Boolean);
  const defensorNombre = String(defensor ?? '').trim();
  if (!documentos.length) throw new Error('No hay documentos para asignar.');
  if (!defensorNombre) throw new Error('Defensor invalido.');

  const res = await fetchJson(`${API_BASE}/ppl/asignar-defensor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentos,
      defensor: defensorNombre,
      ...(options || {}),
    }),
  });

  if (!res.ok) throw new Error('Error guardando la asignacion de defensor');
  return readJsonOrThrow(res, 'Error guardando la asignacion de defensor');
}

