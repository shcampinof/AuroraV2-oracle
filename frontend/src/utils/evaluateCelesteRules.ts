import {
  type CelesteBlockId,
  type CelesteRecord,
} from '../config/formRules.celeste';

export interface EvaluateCelesteRulesInput {
  answers: CelesteRecord;
}

export type CelesteDerivedStatus =
  | 'Analizar el caso'
  | 'Entrevistar al usuario'
  | 'Pendiente audiencia'
  | 'Pendiente decisión de audiencia'
  | 'Presentar solicitud'
  | 'Presentar recurso'
  | 'Pendiente decisión'
  | 'Caso cerrado';

export interface EvaluateCelesteRulesResult {
  visibleBlocks: string[];
  locked: boolean;
  lockReason?: string;
  jumpToAurora: boolean;
  jumpPayload?: { target: 'aurora'; startBlock: 2 };
  derivedStatus: CelesteDerivedStatus;
}

const PLACEHOLDERS = new Set(['', '-', '--', 'null', 'undefined', 'seleccione', 'todos']);

const FIELD = {
  q19: 'Defensor(a) Público(a) Asignado para tramitar la solicitud',
  q20: 'Fecha de análisis jurídico del caso',
  q21: 'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
  q22: 'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO',
  q23: 'Fecha de entrevista',
  q24: 'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA',
  q25: 'FECHA DE REALIZACIÓN DE AUDIENCIA',
  q26: 'SENTIDO DE LA DECISIÓN',
  q28: '¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?',
  q29: 'Fecha de presentación del recurso',
  q30: 'Fecha de la decisión del recurso',
  q31: 'SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO',
} as const;

const REQ_BLOQUE_3: string[] = [FIELD.q19, FIELD.q20, FIELD.q21, FIELD.q22];
const REQ_BLOQUE_4: string[] = [FIELD.q23];

function toText(v: unknown): string {
  return String(v ?? '').trim();
}

export function normalize(v: unknown): string {
  return toText(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeLoose(v: unknown): string {
  return normalize(v)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeKeyLoose(v: unknown): string {
  return normalize(v)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function latin1ToUtf8(value: string): string {
  try {
    return decodeURIComponent(escape(value));
  } catch {
    return value;
  }
}

function utf8ToLatin1(value: string): string {
  try {
    return unescape(encodeURIComponent(value));
  } catch {
    return value;
  }
}

function keyVariants(value: unknown): string[] {
  const raw = toText(value);
  if (!raw) return [''];
  const variants = new Set<string>([raw]);
  for (let i = 0; i < 2; i += 1) {
    const snapshot = Array.from(variants);
    for (const v of snapshot) {
      variants.add(latin1ToUtf8(v));
      variants.add(utf8ToLatin1(v));
    }
  }
  return Array.from(new Set(Array.from(variants).map((v) => normalizeKeyLoose(v))));
}

export function isFilled(v: unknown): boolean {
  const n = normalize(v);
  return !PLACEHOLDERS.has(n);
}

function getAnswerByKey(answers: CelesteRecord, key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(answers, key)) return answers[key];
  const targetVariants = keyVariants(key);
  const hit = Object.keys(answers || {}).find((k) => {
    const candidateVariants = keyVariants(k);
    return candidateVariants.some((candidate) => targetVariants.includes(candidate));
  });
  return hit ? answers[hit] : undefined;
}

function normalizeYesNo(v: unknown): 'si' | 'no' | '' {
  const n = normalize(v);
  if (n === 'si') return 'si';
  if (n === 'no') return 'no';
  return '';
}

function startsWithNormalized(value: unknown, expected: string): boolean {
  return normalizeLoose(value).startsWith(normalizeLoose(expected));
}

function isNoSeAvanzaraQ21(value: unknown): boolean {
  return startsWithNormalized(value, 'No se avanzará');
}

function isSeAvanzaraQ21(value: unknown): boolean {
  return startsWithNormalized(value, 'Se avanzará');
}

function isRevocaOSustituyeQ26(value: unknown): boolean {
  const n = normalize(value);
  return n.includes('revoca medida') || n.includes('sustituye medida');
}

function isNiegaQ26(value: unknown): boolean {
  return normalize(value).includes('niega la solicitud');
}

function areMandatoryFieldsFilled(answers: CelesteRecord, requiredKeys: string[]): boolean {
  return requiredKeys.every((key) => isFilled(getAnswerByKey(answers, key)));
}

function resolveVisibleBlocks(answers: CelesteRecord, locked: boolean): CelesteBlockId[] {
  const visible: CelesteBlockId[] = ['bloque1', 'bloque2Celeste', 'bloque3Celeste'];
  if (locked) return visible;

  // Regla: SINDICADO.B4.VISIBILIDAD.1
  if (areMandatoryFieldsFilled(answers, REQ_BLOQUE_3)) visible.push('bloque4Celeste');
  // Regla: SINDICADO.B5.VISIBILIDAD.2
  if (visible.includes('bloque4Celeste') && areMandatoryFieldsFilled(answers, REQ_BLOQUE_4)) {
    visible.push('bloque5Celeste');
  }
  return visible;
}

function deriveStatus(answers: CelesteRecord): CelesteDerivedStatus {
  const q21 = getAnswerByKey(answers, FIELD.q21);
  const q23 = getAnswerByKey(answers, FIELD.q23);
  const q24 = getAnswerByKey(answers, FIELD.q24);
  const q25 = getAnswerByKey(answers, FIELD.q25);
  const q26 = getAnswerByKey(answers, FIELD.q26);
  const q28 = getAnswerByKey(answers, FIELD.q28);
  const q29 = getAnswerByKey(answers, FIELD.q29);
  const q30 = getAnswerByKey(answers, FIELD.q30);
  const q31 = getAnswerByKey(answers, FIELD.q31);

  // Regla 2
  if (isNoSeAvanzaraQ21(q21)) return 'Caso cerrado';
  // Cierre por resultado final de recurso (fecha o sentido diligenciados).
  if (isFilled(q30)) return 'Caso cerrado';
  if (isFilled(q31)) return 'Caso cerrado';
  // Regla 1
  if (!areMandatoryFieldsFilled(answers, REQ_BLOQUE_3)) return 'Analizar el caso';
  // Regla 3
  if (!isSeAvanzaraQ21(q21)) return 'Analizar el caso';
  if (!isFilled(q23)) return 'Entrevistar al usuario';

  // Nuevos estados intermedios de audiencia.
  if (isFilled(q24) && !isFilled(q25)) return 'Pendiente audiencia';
  if (isFilled(q25) && !isFilled(q26)) return 'Pendiente decisión de audiencia';

  const has24And25 = isFilled(q24) && isFilled(q25);
  if (has24And25 && isRevocaOSustituyeQ26(q26)) {
    // Regla 5
    return 'Caso cerrado';
  }

  if (has24And25 && isNiegaQ26(q26)) {
    // Regla 7
    if (normalizeYesNo(q28) === 'no') return 'Caso cerrado';
    // Regla 9
    if (isFilled(q29)) return 'Pendiente decisión';
    // Reglas 6 y 8
    return 'Presentar recurso';
  }

  // Regla 4
  return 'Presentar solicitud';
}

export function evaluateCelesteRules({ answers }: EvaluateCelesteRulesInput): EvaluateCelesteRulesResult {
  const safeAnswers = (answers || {}) as CelesteRecord;
  const closedByQ21 = isNoSeAvanzaraQ21(getAnswerByKey(safeAnswers, FIELD.q21));
  const visibleBlocks = resolveVisibleBlocks(safeAnswers, closedByQ21);
  const derivedStatus = deriveStatus(safeAnswers);

  return {
    visibleBlocks,
    locked: closedByQ21,
    lockReason: closedByQ21 ? 'Caso cerrado por análisis jurídico de la pregunta 21.' : undefined,
    jumpToAurora: false,
    jumpPayload: undefined,
    derivedStatus,
  };
}

export default evaluateCelesteRules;
