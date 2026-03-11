import {
  type CelesteBlockId,
  type CelesteRecord,
} from '../config/formRules.celeste';

export interface EvaluateCelesteRulesInput {
  answers: CelesteRecord;
}

export interface EvaluateCelesteRulesResult {
  visibleBlocks: string[];
  locked: boolean;
  lockReason?: string;
  jumpToAurora: boolean;
  jumpPayload?: { target: 'aurora'; startBlock: 2 };
}

const PLACEHOLDERS = new Set(['', '-', '--', 'null', 'undefined', 'seleccione', 'todos']);

const REQ_BLOQUE_3: string[][] = [
  [
    'Defensor(a) Público(a) Asignado para tramitar la solicitud',
    'Defensor(a) Público(a) Asignado para tramitar la solicitud',
  ],
  ['Fecha de análisis jurídico del caso', 'Fecha de análisis jurídico del caso'],
  [
    'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
    'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
  ],
];

const REQ_BLOQUE_4: string[][] = [
  ['Fecha de entrevista', 'Fecha de entrevista'],
];

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

export function isFilled(v: unknown): boolean {
  const n = normalize(v);
  return !PLACEHOLDERS.has(n);
}

function getAnswerByKey(answers: CelesteRecord, key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(answers, key)) return answers[key];
  const target = normalize(key);
  const hit = Object.keys(answers || {}).find((k) => normalize(k) === target);
  return hit ? answers[hit] : undefined;
}

function areMandatoryFieldsFilledBloque3(answers: CelesteRecord): boolean {
  return REQ_BLOQUE_3.every((alternatives) => alternatives.some((k) => isFilled(getAnswerByKey(answers, k))));
}

function areMandatoryFieldsFilledBloque4(answers: CelesteRecord): boolean {
  return REQ_BLOQUE_4.every((alternatives) => alternatives.some((k) => isFilled(getAnswerByKey(answers, k))));
}

function resolveVisibleBlocks(answers: CelesteRecord): CelesteBlockId[] {
  const visible: CelesteBlockId[] = ['bloque1', 'bloque2Celeste', 'bloque3Celeste'];
  // Regla: CELESTE.B4.VISIBILIDAD.1
  if (areMandatoryFieldsFilledBloque3(answers)) visible.push('bloque4Celeste');
  // Regla: CELESTE.B5.VISIBILIDAD.2
  if (visible.includes('bloque4Celeste') && areMandatoryFieldsFilledBloque4(answers)) {
    visible.push('bloque5Celeste');
  }
  return visible;
}

export function evaluateCelesteRules({ answers }: EvaluateCelesteRulesInput): EvaluateCelesteRulesResult {
  const safeAnswers = (answers || {}) as CelesteRecord;
  const visibleBlocks = resolveVisibleBlocks(safeAnswers);

  return {
    visibleBlocks,
    locked: false,
    lockReason: undefined,
    jumpToAurora: false,
    jumpPayload: undefined,
  };
}

export default evaluateCelesteRules;
