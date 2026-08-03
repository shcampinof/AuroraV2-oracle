const {
  catalogMetadata,
  listCentros,
  resolveAccionPendiente,
  resolveCentro,
} = require('../domain/catalogosHomologacion');
const { normalizeSearchText, normalizeWhitespace } = require('../utils/textNormalization');

const REPORT_SCHEMA_VERSION = 1;
const DEFAULT_PENDING_LIMIT = 100;

function safeCount(value) {
  const parsed = Number.parseInt(String(value ?? '0'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function safeText(value, maxLength = 500) {
  return normalizeWhitespace(value).slice(0, maxLength);
}

function editDistance(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      const substitution = previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1);
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, substitution);
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function textualSimilarity(left, right) {
  const a = normalizeSearchText(left);
  const b = normalizeSearchText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

function suggestCenter(value) {
  const normalized = normalizeSearchText(value);
  if (normalized.length < 8) return null;
  let best = null;
  for (const center of listCentros()) {
    for (const alias of center.aliases) {
      const aliasNormalized = normalizeSearchText(alias);
      const distance = editDistance(normalized, aliasNormalized);
      const score = textualSimilarity(normalized, aliasNormalized);
      const conservativeMatch = score >= 0.92 || (Math.min(normalized.length, aliasNormalized.length) >= 12 && distance <= 2);
      if (!conservativeMatch || (best && best.score >= score)) continue;
      best = {
        id: center.id,
        label: center.label,
        score: Number(score.toFixed(4)),
        reason: 'similitud_textual_alta',
        requiresApproval: true,
      };
    }
  }
  return best;
}

function buildCenterAudit(rows) {
  const identities = new Map();
  let totalOccurrences = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const original = safeText(row?.valor ?? row?.value ?? row?.LUGAR);
    if (!original) continue;
    const count = safeCount(row?.cantidad ?? row?.count ?? row?.TOTAL) || 1;
    const resolved = resolveCentro(original);
    if (!resolved) continue;
    totalOccurrences += count;
    const previous = identities.get(resolved.id) || {
      id: resolved.id,
      label: resolved.label,
      homologado: resolved.homologado,
      occurrences: 0,
      rawValues: new Set(),
    };
    previous.occurrences += count;
    previous.rawValues.add(original);
    identities.set(resolved.id, previous);
  }

  const entries = Array.from(identities.values()).map((entry) => ({
    id: entry.id,
    label: entry.label,
    homologado: entry.homologado,
    occurrences: entry.occurrences,
    rawValues: Array.from(entry.rawValues).sort((a, b) => a.localeCompare(b)),
    suggestion: entry.homologado ? null : suggestCenter(entry.label),
  }));
  entries.sort((a, b) => b.occurrences - a.occurrences || a.label.localeCompare(b.label));
  const homologated = entries.filter((entry) => entry.homologado);
  const pending = entries.filter((entry) => !entry.homologado);
  const homologatedOccurrences = homologated.reduce((sum, entry) => sum + entry.occurrences, 0);

  return {
    summary: {
      rawValues: (Array.isArray(rows) ? rows : []).length,
      identities: entries.length,
      homologatedIdentities: homologated.length,
      pendingIdentities: pending.length,
      totalOccurrences,
      homologatedOccurrences,
      pendingOccurrences: totalOccurrences - homologatedOccurrences,
      occurrenceCoveragePercent: totalOccurrences
        ? Number(((homologatedOccurrences / totalOccurrences) * 100).toFixed(2))
        : null,
    },
    pending,
  };
}

function buildActionAudit(rows) {
  const pending = new Map();
  let records = 0;
  let totalOccurrences = 0;
  let homologatedOccurrences = 0;
  let missingSourceTextOccurrences = 0;
  let canonicalDerivedOccurrences = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const original = safeText(row?.valorOriginal ?? row?.value ?? row?.ACCION_ORIGINAL);
    const estadoCodigo = safeText(row?.estadoCodigo ?? row?.ESTADO_CODIGO, 100);
    const count = safeCount(row?.cantidad ?? row?.count ?? row?.TOTAL) || 1;
    const resolved = resolveAccionPendiente({ estadoCodigo, valorOriginal: original });
    records += count;
    if (resolved?.codigo && !resolved.codigo.startsWith('LEGACY_ACCION_')) {
      canonicalDerivedOccurrences += count;
    }
    if (!original) {
      missingSourceTextOccurrences += count;
      continue;
    }
    totalOccurrences += count;
    if (resolved?.homologada) {
      homologatedOccurrences += count;
      continue;
    }
    const key = `${estadoCodigo}|${normalizeSearchText(original)}`;
    const previous = pending.get(key) || {
      estadoCodigo,
      valorOriginal: original,
      occurrences: 0,
      expectedAction: resolved?.codigo
        ? { codigo: resolved.codigo, etiqueta: resolved.etiqueta }
        : null,
      reason: resolved?.fuente === 'estado_canonico' ? 'estado_texto_inconsistente' : 'texto_no_catalogado',
      requiresApproval: true,
    };
    previous.occurrences += count;
    pending.set(key, previous);
  }
  const pendingEntries = Array.from(pending.values()).sort(
    (a, b) => b.occurrences - a.occurrences || a.valorOriginal.localeCompare(b.valorOriginal)
  );

  return {
    summary: {
      rawValues: Array.from(
        new Set(
          (Array.isArray(rows) ? rows : [])
            .map((row) => normalizeSearchText(row?.valorOriginal ?? row?.value ?? row?.ACCION_ORIGINAL))
            .filter(Boolean)
        )
      ).length,
      records,
      sourceTextOccurrences: totalOccurrences,
      missingSourceTextOccurrences,
      sourceTextCoveragePercent: records
        ? Number(((totalOccurrences / records) * 100).toFixed(2))
        : null,
      canonicalDerivedOccurrences,
      totalOccurrences,
      homologatedOccurrences,
      pendingOccurrences: totalOccurrences - homologatedOccurrences,
      pendingValues: pendingEntries.length,
      occurrenceCoveragePercent: totalOccurrences
        ? Number(((homologatedOccurrences / totalOccurrences) * 100).toFixed(2))
        : null,
    },
    pending: pendingEntries,
  };
}

function buildHomologationAudit({ centerRows = [], actionRows = [], pendingLimit = DEFAULT_PENDING_LIMIT, now } = {}) {
  const safeLimit = Math.max(1, Math.min(5000, Number.parseInt(String(pendingLimit), 10) || DEFAULT_PENDING_LIMIT));
  const centers = buildCenterAudit(centerRows);
  const actions = buildActionAudit(actionRows);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: (now instanceof Date ? now : new Date()).toISOString(),
    readOnly: true,
    catalogs: catalogMetadata,
    centers: {
      summary: centers.summary,
      pending: centers.pending.slice(0, safeLimit),
      pendingReturned: Math.min(centers.pending.length, safeLimit),
      pendingTruncated: centers.pending.length > safeLimit,
    },
    actions: {
      summary: actions.summary,
      pending: actions.pending.slice(0, safeLimit),
      pendingReturned: Math.min(actions.pending.length, safeLimit),
      pendingTruncated: actions.pending.length > safeLimit,
    },
  };
}

module.exports = {
  buildHomologationAudit,
  suggestCenter,
  textualSimilarity,
};
