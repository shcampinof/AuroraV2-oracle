const crypto = require('crypto');
const centrosCatalog = require('../catalogs/centros-reclusion.v1.json');
const accionesCatalog = require('../catalogs/acciones-pendientes.v1.json');
const { normalizeSearchText, normalizeWhitespace } = require('../utils/textNormalization');

const OTROS_LUGARES_ACTIVOS_ID = 'CATEGORIA_OTROS_LUGARES_ACTIVOS';

function validateCatalog(catalog, name) {
  if (Number(catalog?.schemaVersion) !== 1 || !Array.isArray(catalog?.items)) {
    throw new Error(`Catálogo inválido: ${name}`);
  }
  const ids = new Set();
  for (const item of catalog.items) {
    const id = String(item?.id || '').trim();
    const label = normalizeWhitespace(item?.label);
    if (!id || !label || ids.has(id)) throw new Error(`Entrada inválida o duplicada en ${name}: ${id}`);
    ids.add(id);
  }
}

validateCatalog(centrosCatalog, 'centros-reclusion');
validateCatalog(accionesCatalog, 'acciones-pendientes');

function catalogDigest(catalog) {
  return crypto.createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
}

function buildIndex(catalog) {
  const byId = new Map();
  const byAlias = new Map();
  for (const rawItem of catalog.items) {
    const item = Object.freeze({
      ...rawItem,
      id: String(rawItem.id).trim(),
      label: normalizeWhitespace(rawItem.label),
      aliases: Array.from(new Set([rawItem.label, ...(rawItem.aliases || [])].map(normalizeWhitespace).filter(Boolean))),
      estadoCodigos: Array.from(new Set((rawItem.estadoCodigos || []).map((value) => String(value || '').trim()).filter(Boolean))),
    });
    byId.set(item.id, item);
    for (const alias of item.aliases) {
      const key = normalizeSearchText(alias);
      const previous = byAlias.get(key);
      if (previous && previous.id !== item.id) {
        throw new Error(`Alias ambiguo en catálogo: ${alias}`);
      }
      byAlias.set(key, item);
    }
  }
  return { byId, byAlias };
}

const centrosIndex = buildIndex(centrosCatalog);
const accionesIndex = buildIndex(accionesCatalog);
const accionByEstado = new Map();
for (const item of accionesIndex.byId.values()) {
  for (const estadoCodigo of item.estadoCodigos) {
    const previous = accionByEstado.get(estadoCodigo);
    if (previous && previous.id !== item.id) {
      throw new Error(`Estado ambiguo en catálogo de acciones: ${estadoCodigo}`);
    }
    accionByEstado.set(estadoCodigo, item);
  }
}

function legacyId(prefix, normalizedValue) {
  const digest = crypto.createHash('sha256').update(String(normalizedValue || '')).digest('hex').slice(0, 12).toUpperCase();
  return `${prefix}_${digest}`;
}

function resolveCentro(value) {
  const valorOriginal = normalizeWhitespace(value);
  if (!valorOriginal) return null;
  const claveNormalizada = normalizeSearchText(valorOriginal);
  const known = centrosIndex.byAlias.get(claveNormalizada);
  if (known) {
    return {
      id: known.id,
      label: known.label,
      homologado: true,
      valorOriginal,
      claveNormalizada,
      catalogVersion: centrosCatalog.catalogVersion,
    };
  }
  return {
    id: legacyId('LEGACY_CENTRO', claveNormalizada),
    label: valorOriginal,
    homologado: false,
    valorOriginal,
    claveNormalizada,
    catalogVersion: centrosCatalog.catalogVersion,
  };
}

function getCentroById(id) {
  return centrosIndex.byId.get(String(id || '').trim()) || null;
}

function getCentroNormalizedAliases(id) {
  const item = getCentroById(id);
  return item ? Array.from(new Set(item.aliases.map(normalizeSearchText))) : [];
}

function getAllCentroNormalizedAliases() {
  return Array.from(new Set(
    Array.from(centrosIndex.byId.values()).flatMap((item) => item.aliases.map(normalizeSearchText))
  ));
}

function getAccionByCodigo(id) {
  return accionesIndex.byId.get(String(id || '').trim()) || null;
}

function resolveAccionCodigo(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (accionesIndex.byId.has(raw)) return raw;
  return accionesIndex.byAlias.get(normalizeSearchText(raw))?.id || '';
}

function resolveAccionPendiente({ estadoCodigo = '', valorOriginal = '' } = {}) {
  const original = normalizeWhitespace(valorOriginal);
  const byOriginal = original ? accionesIndex.byAlias.get(normalizeSearchText(original)) || null : null;
  const byEstado = accionByEstado.get(String(estadoCodigo || '').trim()) || null;
  const canonical = byEstado || byOriginal;

  if (canonical) {
    return {
      codigo: canonical.id,
      etiqueta: canonical.label,
      homologada: !original || byOriginal?.id === canonical.id,
      fuente: byEstado ? 'estado_canonico' : 'texto_homologado',
      valorOriginal: original,
      catalogVersion: accionesCatalog.catalogVersion,
    };
  }

  if (!original) return null;
  const normalized = normalizeSearchText(original);
  return {
    codigo: legacyId('LEGACY_ACCION', normalized),
    etiqueta: original,
    homologada: false,
    fuente: 'texto_legacy',
    valorOriginal: original,
    catalogVersion: accionesCatalog.catalogVersion,
  };
}

function listAcciones() {
  return Array.from(accionesIndex.byId.values()).map((item) => ({
    codigo: item.id,
    etiqueta: item.label,
    estadoCodigos: [...item.estadoCodigos],
  }));
}

function listCentros() {
  return Array.from(centrosIndex.byId.values()).map((item) => ({
    id: item.id,
    label: item.label,
    aliases: [...item.aliases],
  }));
}

module.exports = {
  catalogMetadata: {
    acciones: {
      version: accionesCatalog.catalogVersion,
      items: accionesIndex.byId.size,
      sha256: catalogDigest(accionesCatalog),
    },
    centros: {
      version: centrosCatalog.catalogVersion,
      items: centrosIndex.byId.size,
      sha256: catalogDigest(centrosCatalog),
    },
  },
  catalogVersions: {
    acciones: accionesCatalog.catalogVersion,
    centros: centrosCatalog.catalogVersion,
  },
  getAccionByCodigo,
  getCentroById,
  getAllCentroNormalizedAliases,
  getCentroNormalizedAliases,
  listAcciones,
  listCentros,
  resolveAccionPendiente,
  resolveAccionCodigo,
  resolveCentro,
  OTROS_LUGARES_ACTIVOS_ID,
};
