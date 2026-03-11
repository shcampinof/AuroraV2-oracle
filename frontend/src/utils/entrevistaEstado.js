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

export function pickActiveCase(registro) {
  const casos = Array.isArray(registro?.casos) ? registro.casos : [];
  if (!casos.length) return null;

  const activeId = String(registro?.activeCaseId || '').trim();
  if (activeId) {
    const hit = casos.find((c) => String(c?.caseId) === activeId);
    if (hit) return hit;
  }

  const sorted = [...casos].sort((a, b) =>
    String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''))
  );
  return sorted[sorted.length - 1] || null;
}

export function pickActiveCaseData(registro) {
  if (registro && typeof registro === 'object' && registro.data && typeof registro.data === 'object') {
    return registro.data;
  }
  const active = pickActiveCase(registro);
  if (active?.data && typeof active.data === 'object') return active.data;
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

