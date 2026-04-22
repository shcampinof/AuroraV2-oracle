function normText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isEmptyValue(v) {
  if (v == null) return true;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' || t === '-';
  }
  return false;
}

export function hasAnyFilled(obj, keys) {
  const target = obj || {};
  return (keys || []).some((k) => !isEmptyValue(target?.[k]));
}

function toNumberOrNull(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseRowIndexFromIdentifier(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const suffix = text.match(/-(\d+)$/);
  if (suffix) return toNumberOrNull(suffix[1]);
  if (/^\d+$/.test(text)) return toNumberOrNull(text);
  return null;
}

function parseDateToMs(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = new Date(text);
  const ms = parsed.getTime();
  if (!Number.isFinite(ms)) return null;
  return ms;
}

function normalizeCaseCandidates(registro) {
  const casos = Array.isArray(registro?.casos) ? registro.casos : [];
  const actuaciones = Array.isArray(registro?.actuaciones) ? registro.actuaciones : [];

  const mappedActuaciones = actuaciones.map((item) => ({
    ...item,
    caseId: item?.caseId ?? item?.id,
    data:
      item?.data && typeof item.data === 'object'
        ? item.data
        : item?.registro && typeof item.registro === 'object'
          ? item.registro
          : undefined,
  }));

  return [...casos, ...mappedActuaciones];
}

export function pickActiveCase(registro) {
  const casos = normalizeCaseCandidates(registro);
  if (!casos.length) return null;

  const activeId = String(registro?.activeCaseId || '').trim();
  if (activeId) {
    const hit = casos.find((c) => {
      const caseId = String(c?.caseId ?? '').trim();
      const directId = String(c?.id ?? '').trim();
      return caseId === activeId || directId === activeId;
    });
    if (hit) return hit;
  }

  const withOrderHint = casos
    .map((c, index) => ({
      item: c,
      index,
      rowIndex:
        toNumberOrNull(c?.rowIndex) ??
        parseRowIndexFromIdentifier(c?.caseId) ??
        parseRowIndexFromIdentifier(c?.id),
      createdAtMs: parseDateToMs(c?.createdAt),
    }))
    .sort((a, b) => {
      if (a.rowIndex != null && b.rowIndex != null && a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
      if (a.rowIndex != null && b.rowIndex == null) return 1;
      if (a.rowIndex == null && b.rowIndex != null) return -1;
      if (a.createdAtMs != null && b.createdAtMs != null && a.createdAtMs !== b.createdAtMs) {
        return a.createdAtMs - b.createdAtMs;
      }
      if (a.createdAtMs != null && b.createdAtMs == null) return 1;
      if (a.createdAtMs == null && b.createdAtMs != null) return -1;
      return a.index - b.index;
    });

  return withOrderHint[withOrderHint.length - 1]?.item || null;
}

export function pickActiveCaseData(registro) {
  const active = pickActiveCase(registro);
  if (active?.data && typeof active.data === 'object') return active.data;
  if (registro && typeof registro === 'object' && registro.data && typeof registro.data === 'object') {
    return registro.data;
  }
  return registro && typeof registro === 'object' ? registro : {};
}

function getStringField(obj, keys) {
  for (const k of keys || []) {
    const v = obj?.[k];
    if (!isEmptyValue(v)) return String(v);
  }
  return '';
}

function decisionIndicaAvanzar(decision) {
  const s = normText(decision);
  if (!s) return false;
  if (s.includes('desea que el defensor') && s.includes('avance')) return true;
  if (s.includes('defensor') && s.includes('avance') && s.includes('solicitud')) return true;
  if (s.includes('defensor') && s.includes('avance') && s.includes('tramite')) return true;
  return false;
}

const POST_VISITA_KEYS = {
  sindicado: [
    'fechaRevisionExpediente',
    'confirmacionProcedenciaVencimiento',
    'fechaSolicitudAudiencia',
    'fechaRealizacionAudiencia',
    'sentidoDecision',
    'motivoDecisionNegativa',
    'seRecurrioDecisionNegativa',
    'sentidoDecisionRecurso',
  ],
  condenado: [
    'Fecha de recepción de pruebas aportadas por el usuario',
    'Fecha de recepción de pruebas aportadas por el usuario',
    'Fecha de solicitud de documentos al INPEC',
    'Fecha de recepción de documentos del INPEC',
    'Fecha de presentación de solicitud a la autoridad judicial',
    'Fecha de presentación de solicitud a la autoridad judicial',
    'Fecha de decisión de la autoridad judicial',
    'Fecha de decisión de la autoridad judicial',
    'Sentido de la decisión',
    'Sentido de la decisión',
    'Motivo de la decisión negativa (Libertad condicional si aplica)',
    'Motivo de la decisión negativa (Libertad condicional si aplica)',
    'Motivo de la decisión negativa (Prisión domiciliaria si aplica)',
    'Motivo de la decisión negativa (Prisión domiciliaria si aplica)',
    'Fecha de recurso en caso desfavorable',
    'Fecha de presentación del recurso',
    'Fecha de la decisión del recurso',
    'Sentido de la decisión que resuelve recurso',
    'Sentido de la decisión que resuelve recurso',
    'Tipo de solicitud a tramitar',
    'Autoridad a la que se dirige',
    'Fecha de la solicitud',
    'Fecha de respuesta de la solicitud',
    'Sentido de la decisión que resuelve la solicitud',
    'Sentido de la decisión que resuelve la solicitud',
    'Fecha de insistencia de la solicitud (si aplica)',
    'Datos adjuntos',
  ],
};

const DECISION_KEYS = {
  sindicado: ['decisionUsuario', 'Decisión del usuario', 'Decisión del usuario'],
  condenado: ['Decisión del usuario', 'Decisión del usuario', 'decisionUsuario'],
};

const EXCLUDED_KEYS = new Set([
  'casos',
  'activeCaseId',
  'caseId',
  'createdAt',
  'tipo',
  'tipoPpl',
  // Campos base (segun regla)
  'numeroIdentificacion',
  'Title',
  'nombre',
  'Nombre usuario',
  'nombreUsuario',
]);

export function getEstadoEntrevista(registro, tipo) {
  const t = String(tipo || '').trim().toLowerCase();
  const data = pickActiveCaseData(registro);
  const keys = Object.keys(data || {}).filter((k) => !EXCLUDED_KEYS.has(k));

  const anyFilled = keys.some((k) => !isEmptyValue(data?.[k]));
  if (!anyFilled) {
    return { code: 'SIN_INICIAR', label: 'Sin iniciar', color: 'gray' };
  }

  const postKeys = POST_VISITA_KEYS[t] || [];
  if (hasAnyFilled(data, postKeys)) {
    return { code: 'TRAMITE_EN_CURSO', label: 'Trámite en curso', color: 'cyan' };
  }

  const decision = getStringField(data, DECISION_KEYS[t] || []);
  if (decisionIndicaAvanzar(decision)) {
    return {
      code: 'PENDIENTE_TRAMITE_POST_VISITA',
      label: 'Entrevista realizada  Pendiente trámite (post-visita)',
      color: 'amber',
    };
  }

  return { code: 'EN_PROGRESO_B1', label: 'Entrevista en curso', color: 'blue' };
}

