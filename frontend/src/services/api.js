import { getAuthToken, syncAuthTokenToServiceWorker } from './authStorage.js';

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

export const API_BASE = shouldUseConfiguredApiBase(CONFIGURED_API_BASE) ? CONFIGURED_API_BASE : DEFAULT_API_BASE;

const DEFAULT_FETCH_TIMEOUT_MS = 120000;
const CONDENADOS_CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
const condenadosClientCache = new Map();
const condenadosFilterOptionsClientCache = new Map();
let condenadosCacheAuthToken = null;

function syncCondenadosCacheAuth() {
  const token = String(getAuthToken() || '');
  if (condenadosCacheAuthToken === token) return;
  condenadosClientCache.clear();
  condenadosFilterOptionsClientCache.clear();
  condenadosCacheAuthToken = token;
}

function readFreshClientCache(cache, key) {
  syncCondenadosCacheAuth();
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.createdAt >= CONDENADOS_CLIENT_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

async function loadWithClientCache(cache, key, loader, forceRefresh = false) {
  syncCondenadosCacheAuth();
  if (!forceRefresh) {
    const cached = readFreshClientCache(cache, key);
    if (cached) return cached;
  }

  const current = cache.get(key);
  if (!forceRefresh && current?.promise) return current.promise;

  const promise = Promise.resolve().then(loader);
  cache.set(key, { createdAt: Date.now(), promise, value: null });
  try {
    const value = await promise;
    cache.set(key, { createdAt: Date.now(), promise: null, value });
    return value;
  } catch (error) {
    if (cache.get(key)?.promise === promise) cache.delete(key);
    throw error;
  }
}

export function invalidateCondenadosClientCache() {
  condenadosClientCache.clear();
  condenadosFilterOptionsClientCache.clear();
}

function createFetchTimeoutError(timeoutMs) {
  const seconds = Math.max(1, Math.round(Number(timeoutMs || DEFAULT_FETCH_TIMEOUT_MS) / 1000));
  const err = new Error(
    `La consulta tardó demasiado en responder (${seconds}s). Intente de nuevo o aplique filtros para reducir la carga.`
  );
  err.code = 'FETCH_TIMEOUT';
  return err;
}

async function fetchJson(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort('timeout');
  }, timeoutMs);
  try {
    syncAuthTokenToServiceWorker();
    const requestOptions = {
      ...(options || {}),
      headers: {
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
        ...(options?.headers || {}),
      },
      signal: controller.signal,
    };
    try {
      const res = await fetch(url, requestOptions);
      return res;
    } catch (firstError) {
      if (timedOut || controller.signal.aborted) {
        throw createFetchTimeoutError(timeoutMs);
      }
      // Fallback de resiliencia: si la base configurada falla en deploy, intenta same-origin /api.
      const fallbackBase = '/api';
      const canRetryWithFallback = API_BASE !== fallbackBase && String(url || '').startsWith(API_BASE);
      if (!canRetryWithFallback) throw firstError;
      const fallbackUrl = `${fallbackBase}${String(url).slice(API_BASE.length)}`;
      try {
        return await fetch(fallbackUrl, requestOptions);
      } catch (fallbackError) {
        if (timedOut || controller.signal.aborted) {
          throw createFetchTimeoutError(timeoutMs);
        }
        throw fallbackError;
      }
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

export function isQueuedResponse(data) {
  return Boolean(data?.queued || data?.__queued);
}

function normalizeQueuedResponse(data, fallback = {}) {
  if (!isQueuedResponse(data)) return data;
  return {
    ...fallback,
    ...data,
    __queued: true,
    queued: true,
    message:
      data?.message ||
      'Operacion guardada localmente. Se sincronizara cuando vuelva la conexion.',
  };
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

// ACTUALIZACIÓN UNIFICADA
// PUT /api/ppl/:documento
export async function updatePpl(documento, payload) {
  const res = await fetchJson(`${API_BASE}/ppl/${encodeURIComponent(documento)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await readJsonOrThrow(res, 'Error actualizando registro');
  if (!res.ok) throw new Error(String(data?.message || 'Error actualizando registro'));
  invalidateCondenadosClientCache();
  return normalizeQueuedResponse(data, {
    registro: payload?.data && typeof payload.data === 'object' ? payload.data : null,
  }); // { tipo, registro }
}

// CREATE ACTUACION
// POST /api/ppl/:documento/actuaciones
export async function createPplActuacion(documento, payload) {
  const res = await fetchJson(`${API_BASE}/ppl/${encodeURIComponent(documento)}/actuaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const data = await readJsonOrThrow(res, 'Error creando actuacion');
  if (!res.ok) throw new Error(String(data?.message || 'Error creando actuación'));
  invalidateCondenadosClientCache();
  return normalizeQueuedResponse(data, { documento }); // { documento, actuacion, registro }
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

export async function getFormatoDownloadTarget(id) {
  const res = await fetchJson(`${API_BASE}/formatos/${encodeURIComponent(id)}/download-url`);
  if (!res.ok) throw new Error('Error preparando descarga');
  return readJsonOrThrow(res, 'Error preparando descarga');
}

// =====================
// Asignacion de defensores (condenados)
// =====================
export function getCondenadosRequest(options = 1000) {
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
  const safePage = Number.isFinite(Number(source?.page))
    ? Math.max(1, Math.trunc(Number(source.page)))
    : 1;
  const safePageSize = Number.isFinite(Number(source?.pageSize))
    ? Math.max(1, Math.min(200, Math.trunc(Number(source.pageSize))))
    : null;

  const filters = source?.filters && typeof source.filters === 'object' ? source.filters : {};
  const params = new URLSearchParams();
  if (safeTipo) params.set('tipo', safeTipo);
  params.set('limit', String(safeLimit));
  params.set('page', String(safePage));
  if (safePageSize) params.set('pageSize', String(safePageSize));

  const filterKeys = [
    'defensor',
    'defensorId',
    'nombre',
    'documento',
    'lugar',
    'centroId',
    'departamento',
    'municipio',
    'estadoAccion',
    'estadoCodigo',
    'estado',
    'accionCodigo',
    'accion',
    'potencialSubrogado',
    'asignacionEstado',
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

  return {
    key: params.toString(),
    forceRefresh: source?.forceRefresh === true,
  };
}

export function getCachedCondenados(options = 1000) {
  const { key } = getCondenadosRequest(options);
  return readFreshClientCache(condenadosClientCache, key);
}

export async function getCondenados(options = 1000) {
  const { key, forceRefresh } = getCondenadosRequest(options);
  return loadWithClientCache(
    condenadosClientCache,
    key,
    async () => {
      const res = await fetchJson(`${API_BASE}/ppl/condenados?${key}`);
      if (!res.ok) throw new Error('Error consultando condenados');
      return readJsonOrThrow(res, 'Error consultando condenados'); // { columns, rows, meta }
    },
    forceRefresh
  );
}

export function getCondenadosFilterOptionsRequest(options = {}) {
  const source = options && typeof options === 'object' ? options : {};
  const rawTipo = String(source?.tipo || '').trim().toLowerCase();
  const safeTipo =
    rawTipo === 'all' || rawTipo === 'condenado' || rawTipo === 'sindicado' ? rawTipo : 'all';

  const filters = source?.filters && typeof source.filters === 'object' ? source.filters : {};
  const params = new URLSearchParams();
  params.set('tipo', safeTipo);

  ['departamento', 'municipio', 'defensor', 'defensorId', 'centroId'].forEach((key) => {
    const value = String(filters?.[key] ?? '').trim();
    if (value) params.set(key, value);
  });

  return {
    key: params.toString(),
    forceRefresh: source?.forceRefresh === true,
  };
}

export function getCachedCondenadosFilterOptions(options = {}) {
  const { key } = getCondenadosFilterOptionsRequest(options);
  return readFreshClientCache(condenadosFilterOptionsClientCache, key);
}

export async function getCondenadosFilterOptions(options = {}) {
  const { key, forceRefresh } = getCondenadosFilterOptionsRequest(options);
  return loadWithClientCache(
    condenadosFilterOptionsClientCache,
    key,
    async () => {
      const res = await fetchJson(`${API_BASE}/ppl/condenados/filter-options?${key}`);
      if (!res.ok) throw new Error('Error consultando opciones de filtros');
      return readJsonOrThrow(res, 'Error consultando opciones de filtros');
    },
    forceRefresh
  );
}

export async function getDefensores() {
  const res = await fetchJson(`${API_BASE}/defensores`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error consultando defensores');
  return readJsonOrThrow(res, 'Error consultando defensores'); // { defensores }
}

export async function getReporteAtencionesDefensores({ fechaInicio, fechaFin, regional, defensorId }) {
  const params = new URLSearchParams({
    fechaInicio: String(fechaInicio || ''),
    fechaFin: String(fechaFin || ''),
    regional: String(regional || ''),
    defensorId: String(defensorId || ''),
  });
  const res = await fetchJson(`${API_BASE}/reportes/atenciones-defensores?${params.toString()}`, {
    cache: 'no-store',
  });
  const data = await readJsonOrThrow(res, 'Error generando el reporte de atenciones');
  if (!res.ok) {
    throw new Error(String(data?.message || 'No fue posible generar el reporte de atenciones.'));
  }
  return data;
}

export async function getReporteAtencionesOpciones() {
  const res = await fetchJson(`${API_BASE}/reportes/atenciones-defensores/opciones`, {
    cache: 'no-store',
  });
  const data = await readJsonOrThrow(res, 'Error consultando las opciones del reporte');
  if (!res.ok) {
    throw new Error(String(data?.message || 'No fue posible consultar regionales y defensores.'));
  }
  return data;
}

export async function getDefensoresCondenados() {
  const res = await fetchJson(`${API_BASE}/defensores?source=condenados`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error consultando defensores');
  return readJsonOrThrow(res, 'Error consultando defensores'); // { defensores }
}

export async function createDefensor(payloadOrNombre) {
  const payload =
    payloadOrNombre && typeof payloadOrNombre === 'object'
      ? payloadOrNombre
      : { nombre: payloadOrNombre };

  const res = await fetchJson(`${API_BASE}/defensores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = String(data?.error || 'Error guardando defensor.');
    throw new Error(message);
  }
  return normalizeQueuedResponse(data, {
    defensor: String(payload?.nombre || '').trim(),
  }); // { defensor }
}

function normalizeDefensorOption(option) {
  if (!option || typeof option !== 'object') return null;

  const id = String(option.id ?? '').trim();
  const nombre = String(option.nombre ?? option.label ?? option.value ?? '').trim();
  if (!nombre) return null;

  return {
    id: id || nombre.toUpperCase().replace(/\s+/g, '_'),
    nombre,
    regional: String(option.regional ?? '').trim(),
    correo: String(option.correo ?? '').trim(),
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

  const data = await readJsonOrThrow(res, 'Error guardando la asignacion de defensor');
  if (!res.ok) {
    throw new Error(String(data?.message || 'Error guardando la asignación de defensor'));
  }
  invalidateCondenadosClientCache();
  return normalizeQueuedResponse(data, { documentos, defensor: defensorNombre });
}

export async function unassignDefensorPpl(documento, options = {}) {
  const documentos = Array.isArray(documento)
    ? documento.map((d) => String(d || '').trim()).filter(Boolean)
    : [String(documento || '').trim()].filter(Boolean);
  if (!documentos.length) throw new Error('No hay documentos para desasignar.');

  const res = await fetchJson(`${API_BASE}/ppl/desasignar-defensor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentos, ...(options || {}) }),
  });

  const data = await readJsonOrThrow(res, 'Error desasignando el defensor');
  if (!res.ok) throw new Error(String(data?.message || 'Error desasignando el defensor'));
  invalidateCondenadosClientCache();
  return normalizeQueuedResponse(data, { documentos });
}

// =====================
// Administracion de cargas mensuales
// =====================
export async function getCargaBdSources() {
  const res = await fetchJson(`${API_BASE}/admin/cargas/fuentes`, { cache: 'no-store' });
  const data = await readJsonOrThrow(res, 'Error consultando fuentes de carga');
  if (!res.ok) throw new Error(String(data?.message || 'Error consultando fuentes de carga'));
  return data;
}

export async function getCargasBd() {
  const res = await fetchJson(`${API_BASE}/admin/cargas`, { cache: 'no-store' });
  const data = await readJsonOrThrow(res, 'Error consultando cargas');
  if (!res.ok) throw new Error(String(data?.message || 'Error consultando cargas'));
  return data;
}

export async function uploadCargaBd({ fuente, archivo }) {
  const formData = new FormData();
  formData.set('fuente', fuente);
  formData.set('archivo', archivo);

  const res = await fetchJson(
    `${API_BASE}/admin/cargas`,
    {
      method: 'POST',
      body: formData,
    },
    10 * 60 * 1000
  );

  const data = await readJsonOrThrow(res, 'Error cargando archivo');
  if (!res.ok) throw new Error(String(data?.message || 'Error cargando archivo'));
  return data;
}

export async function retryCargaBd(id) {
  const res = await fetchJson(`${API_BASE}/admin/cargas/${encodeURIComponent(id)}/retry`, {
    method: 'POST',
  });
  const data = await readJsonOrThrow(res, 'Error reintentando carga');
  if (!res.ok) throw new Error(String(data?.message || 'Error reintentando carga'));
  return data;
}

export async function getCargaBdLog(id) {
  const res = await fetchJson(`${API_BASE}/admin/cargas/${encodeURIComponent(id)}/log`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error consultando log de carga');
  return res.text();
}

export async function getActuacionesCleanupPreview(defensor = '') {
  const params = new URLSearchParams();
  if (defensor) params.set('defensor', defensor);
  const query = params.size ? `?${params}` : '';
  const res = await fetchJson(`${API_BASE}/admin/cargas/actuaciones/preview${query}`, { cache: 'no-store' });
  const data = await readJsonOrThrow(res, 'Error consultando actuaciones de prueba');
  if (!res.ok) throw new Error(String(data?.message || 'Error consultando actuaciones de prueba'));
  return data;
}

export async function deleteActuacionesCleanup({ defensor, expectedCount, expectedAssignments, confirmation }) {
  const res = await fetchJson(`${API_BASE}/admin/cargas/actuaciones`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ defensor, expectedCount, expectedAssignments, confirmation }),
  });
  const data = await readJsonOrThrow(res, 'Error eliminando actuaciones de prueba');
  if (!res.ok) throw new Error(String(data?.message || 'Error eliminando actuaciones de prueba'));
  invalidateCondenadosClientCache();
  return data;
}

// =====================
// Administracion de usuarios
// =====================
export async function getAdminUsers() {
  const res = await fetchJson(`${API_BASE}/admin/users`, { cache: 'no-store' });
  const data = await readJsonOrThrow(res, 'Error consultando usuarios');
  if (!res.ok) throw new Error(String(data?.message || 'Error consultando usuarios'));
  return data;
}

export async function saveAdminUser(payload) {
  const res = await fetchJson(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const data = await readJsonOrThrow(res, 'Error guardando usuario');
  if (!res.ok) throw new Error(String(data?.message || 'Error guardando usuario'));
  return data;
}

async function sendAdminUsersCsv(path, file, fallbackMessage) {
  const formData = new FormData();
  formData.append('archivo', file);
  const res = await fetchJson(`${API_BASE}/admin/users${path}`, {
    method: 'POST',
    body: formData,
  });
  const data = await readJsonOrThrow(res, fallbackMessage);
  if (!res.ok) throw new Error(String(data?.message || fallbackMessage));
  return data;
}

export function previewAdminUsersCsv(file) {
  return sendAdminUsersCsv('/import/preview', file, 'Error analizando el archivo CSV');
}

export function importAdminUsersCsv(file) {
  return sendAdminUsersCsv('/import', file, 'Error importando los usuarios');
}

export async function updateAdminUser(id, payload) {
  const res = await fetchJson(`${API_BASE}/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const data = await readJsonOrThrow(res, 'Error actualizando usuario');
  if (!res.ok) throw new Error(String(data?.message || 'Error actualizando usuario'));
  return data;
}

export async function deleteAdminUser(id) {
  const res = await fetchJson(`${API_BASE}/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await readJsonOrThrow(res, 'Error eliminando usuario');
  if (!res.ok) throw new Error(String(data?.message || 'Error eliminando usuario'));
  return data;
}
