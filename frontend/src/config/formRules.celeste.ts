export type CelesteBlockId =
  | 'bloque1'
  | 'bloque2Celeste'
  | 'bloque3Celeste'
  | 'bloque4Celeste'
  | 'bloque5Celeste';

export type CelesteFlow = 'sindicado' | 'condenado';
export type CelesteRecord = Record<string, unknown>;

export interface FieldRef {
  key: string;
  label: string;
  optional?: boolean;
}

export interface CloseCaseRule {
  id: string;
  questionKey: string;
  description: string;
  matches: string[];
}

export interface JumpRule {
  id: string;
  sourceField: string;
  description: string;
  when: (answers: CelesteRecord) => boolean;
  targetFlow: 'aurora';
  targetBlock: 'bloque2Aurora';
  saveBeforeRedirect: boolean;
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

const REQUIRED_19_22 = [FIELD.q19, FIELD.q20, FIELD.q21, FIELD.q22];

function text(v: unknown): string {
  return String(v ?? '').trim();
}

export function normalizeCelesteValue(v: unknown): string {
  return text(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeCelesteLoose(v: unknown): string {
  return normalizeCelesteValue(v)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeKeyLoose(v: unknown): string {
  return normalizeCelesteValue(v)
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
  const raw = text(value);
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

export function equalsInsensitive(a: unknown, b: string): boolean {
  return normalizeCelesteValue(a) === normalizeCelesteValue(b);
}

export function isFilled(v: unknown): boolean {
  const t = text(v);
  if (!t) return false;
  const n = normalizeCelesteValue(t);
  return n !== '-' && n !== 'seleccione' && n !== 'todos';
}

export function normalizeYesNo(v: unknown): 'si' | 'no' | '' {
  if (typeof v === 'boolean') return v ? 'si' : 'no';
  const n = normalizeCelesteValue(v);
  if (n === 'si') return 'si';
  if (n === 'no') return 'no';
  return '';
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

function areKeysFilled(answers: CelesteRecord, keys: string[]): boolean {
  return keys.every((key) => isFilled(getAnswerByKey(answers, key)));
}

function startsWithNormalized(value: unknown, expected: string): boolean {
  return normalizeCelesteLoose(value).startsWith(normalizeCelesteLoose(expected));
}

function isNoSeAvanzaraQ21(answers: CelesteRecord): boolean {
  return startsWithNormalized(getAnswerByKey(answers, FIELD.q21), 'No se avanzará');
}

function isSeAvanzaraQ21(answers: CelesteRecord): boolean {
  return startsWithNormalized(getAnswerByKey(answers, FIELD.q21), 'Se avanzará');
}

function isRevocaOSustituyeQ26(answers: CelesteRecord): boolean {
  const n = normalizeCelesteValue(getAnswerByKey(answers, FIELD.q26));
  return n.includes('revoca medida') || n.includes('sustituye medida');
}

function isNiegaQ26(answers: CelesteRecord): boolean {
  return normalizeCelesteValue(getAnswerByKey(answers, FIELD.q26)).includes('niega la solicitud');
}

function deriveBloque5StatusCeleste(answers: CelesteRecord): CelesteDerivedStatus | '' {
  const q24 = getAnswerByKey(answers, FIELD.q24);
  const q25 = getAnswerByKey(answers, FIELD.q25);
  const q26 = getAnswerByKey(answers, FIELD.q26);
  const q28 = getAnswerByKey(answers, FIELD.q28);
  const q29 = getAnswerByKey(answers, FIELD.q29);
  const q30 = getAnswerByKey(answers, FIELD.q30);
  const q31 = getAnswerByKey(answers, FIELD.q31);

  if (isFilled(q30) || isFilled(q31)) return 'Caso cerrado';
  if (isRevocaOSustituyeQ26(answers)) return 'Caso cerrado';
  if (isNiegaQ26(answers)) {
    if (normalizeYesNo(q28) === 'si') return 'Pendiente decisión';
    if (normalizeYesNo(q28) === 'no') return 'Caso cerrado';
    return 'Presentar recurso';
  }
  if (isFilled(q29) || normalizeYesNo(q28) === 'si') return 'Pendiente decisión';
  if (isFilled(q25) && !isFilled(q26)) return 'Pendiente decisión de audiencia';
  if (isFilled(q24) && !isFilled(q25)) return 'Pendiente audiencia';
  if ([q24, q25, q26, q28].some((value) => isFilled(value))) return 'Presentar solicitud';
  return '';
}

export const mandatoryByBlock: Record<CelesteBlockId, FieldRef[]> = {
  bloque1: [],
  bloque2Celeste: [
    { key: 'Autoridad a cargo', label: '14 Autoridad judicial a cargo' },
    { key: 'Número de proceso', label: '15 Número de proceso' },
    { key: 'Delitos', label: '16 Delitos' },
    { key: 'Fecha de captura', label: '17 Fecha de captura' },
    {
      key: 'TIEMPO QUE LA PERSONA LLEVA PRIVADA DE LA LIBERTAD (EN MESES)',
      label: '18 Tiempo privado de la libertad (meses)',
    },
  ],
  bloque3Celeste: [
    { key: FIELD.q19, label: '19 Defensor(a) público(a) asignado' },
    { key: FIELD.q20, label: '20 Fecha de análisis jurídico del caso' },
    { key: FIELD.q21, label: '21 Análisis jurídico y actuación a desplegar' },
    { key: FIELD.q22, label: '22 Resumen del análisis jurídico del caso' },
  ],
  bloque4Celeste: [{ key: FIELD.q23, label: '23 Fecha de la entrevista para informar al usuario' }],
  bloque5Celeste: [],
};

export const blockOrder: CelesteBlockId[] = ['bloque1', 'bloque2Celeste', 'bloque3Celeste', 'bloque4Celeste', 'bloque5Celeste'];
export const initialVisibleBlocks: CelesteBlockId[] = ['bloque1', 'bloque2Celeste', 'bloque3Celeste'];
export const jumpRules: JumpRule[] = [];

export const closeCaseRules: CloseCaseRule[] = [
  {
    id: 'SINDICADO.CIERRE.Q21.NO_AVANZA',
    questionKey: FIELD.q21,
    description: 'Si Q21 inicia con "No se avanzará...", el caso se cierra.',
    matches: ['No se avanzará'],
  },
];

export function getCloseCaseMatch(answers: CelesteRecord): CloseCaseRule | null {
  if (isNoSeAvanzaraQ21(answers)) return closeCaseRules[0];
  return null;
}

export function isCaseClosedCeleste(answers: CelesteRecord): boolean {
  return deriveStatusCeleste(answers) === 'Caso cerrado';
}

export function areMandatoryFieldsFilledCeleste(answers: CelesteRecord, blockId: CelesteBlockId): boolean {
  const fields = mandatoryByBlock[blockId] || [];
  return fields.every((f) => f.optional || isFilled(getAnswerByKey(answers, f.key)));
}

export function resolveVisibleBlocksCeleste(answers: CelesteRecord): CelesteBlockId[] {
  const visible: CelesteBlockId[] = [...initialVisibleBlocks];
  if (isNoSeAvanzaraQ21(answers)) return visible;

  // Regla: SINDICADO.B4.VISIBILIDAD.1
  if (!areMandatoryFieldsFilledCeleste(answers, 'bloque3Celeste')) return visible;

  visible.push('bloque4Celeste');
  // Regla: SINDICADO.B5.VISIBILIDAD.2
  if (areMandatoryFieldsFilledCeleste(answers, 'bloque4Celeste')) visible.push('bloque5Celeste');
  return visible;
}

export function deriveStatusCeleste(answers: CelesteRecord): CelesteDerivedStatus {
  if (isNoSeAvanzaraQ21(answers)) return 'Caso cerrado';
  const bloque5Status = deriveBloque5StatusCeleste(answers);
  if (bloque5Status) return bloque5Status;
  if (!areKeysFilled(answers, REQUIRED_19_22)) return 'Analizar el caso';
  if (!isSeAvanzaraQ21(answers)) return 'Analizar el caso';
  if (!isFilled(getAnswerByKey(answers, FIELD.q23))) return 'Entrevistar al usuario';
  return 'Presentar solicitud';
}

export const celesteFormRules = {
  blockOrder,
  initialVisibleBlocks,
  mandatoryByBlock,
  jumpRules,
  closeCaseRules,
  helpers: {
    normalizeCelesteValue,
    normalizeYesNo,
    equalsInsensitive,
    isFilled,
    isCaseClosedCeleste,
    getCloseCaseMatch,
    areMandatoryFieldsFilledCeleste,
    resolveVisibleBlocksCeleste,
    deriveStatusCeleste,
  },
};

export default celesteFormRules;
