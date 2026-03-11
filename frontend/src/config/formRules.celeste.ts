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

export type CelesteDerivedStatus = 'Caso cerrado' | 'En gestion' | 'Pendiente de analisis';

const FIELD = {
  q19: 'Defensor(a) Público(a) Asignado para tramitar la solicitud',
  q20: 'Fecha de análisis jurídico del caso',
  q21: 'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
  q22: 'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO',
  q23: 'Fecha de entrevista',
} as const;

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
  if (n.startsWith('no')) return 'no';
  return '';
}

export const mandatoryByBlock: Record<CelesteBlockId, FieldRef[]> = {
  bloque1: [],
  bloque2Celeste: [
    { key: 'Autoridad a cargo', label: '14 Autoridad judicial a cargo' },
    { key: 'Número de proceso', label: '15 Numero de proceso' },
    { key: 'Delitos', label: '16 Delitos' },
    { key: 'Fecha de captura', label: '17 Fecha de captura' },
    { key: 'TIEMPO QUE LA PERSONA LLEVA PRIVADA DE LA LIBERTAD (EN MESES)', label: '18 Tiempo privado de la libertad (meses)' },
  ],
  bloque3Celeste: [
    { key: FIELD.q19, label: '19 Defensor(a) publico(a) asignado' },
    { key: FIELD.q20, label: '20 Fecha de analisis juridico del caso' },
    { key: FIELD.q21, label: '21 Analisis juridico y actuacion a desplegar' },
    { key: FIELD.q22, label: '22 Resumen del analisis juridico del caso', optional: true },
  ],
  bloque4Celeste: [{ key: FIELD.q23, label: '23 Fecha de la entrevista para informar al usuario' }],
  bloque5Celeste: [],
};

export const blockOrder: CelesteBlockId[] = ['bloque1', 'bloque2Celeste', 'bloque3Celeste', 'bloque4Celeste', 'bloque5Celeste'];
export const initialVisibleBlocks: CelesteBlockId[] = ['bloque1', 'bloque2Celeste', 'bloque3Celeste'];
export const jumpRules: JumpRule[] = [];
export const closeCaseRules: CloseCaseRule[] = [];

export function getCloseCaseMatch(_answers: CelesteRecord): CloseCaseRule | null {
  return null;
}

export function isCaseClosedCeleste(_answers: CelesteRecord): boolean {
  return false;
}

export function areMandatoryFieldsFilledCeleste(answers: CelesteRecord, blockId: CelesteBlockId): boolean {
  const fields = mandatoryByBlock[blockId] || [];
  return fields.every((f) => f.optional || isFilled(answers?.[f.key]));
}

export function resolveVisibleBlocksCeleste(answers: CelesteRecord): CelesteBlockId[] {
  const visible: CelesteBlockId[] = [...initialVisibleBlocks];
  // Regla: CELESTE.B4.VISIBILIDAD.1
  if (!areMandatoryFieldsFilledCeleste(answers, 'bloque3Celeste')) return visible;

  visible.push('bloque4Celeste');
  // Regla: CELESTE.B5.VISIBILIDAD.2
  if (areMandatoryFieldsFilledCeleste(answers, 'bloque4Celeste')) visible.push('bloque5Celeste');
  return visible;
}

export function deriveStatusCeleste(answers: CelesteRecord): CelesteDerivedStatus {
  const visible = resolveVisibleBlocksCeleste(answers);
  if (visible.includes('bloque5Celeste')) return 'En gestion';
  return 'Pendiente de analisis';
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
