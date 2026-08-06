import auroraFormRules, {
  type AuroraBlockId,
  type DerivedStatus,
  type FormRecord,
} from '../config/formRules.aurora';
import { AURORA_FIELD_IDS } from '../config/auroraFieldIds';

type VariantState = 'default' | 'utilidadPublica' | 'tramiteNormal';

export interface EvaluateAuroraRulesInput {
  answers: FormRecord;
}

export interface EvaluateAuroraRulesResult {
  visibleBlocks: string[];
  blockVariants: Record<string, VariantState>;
  locked: boolean;
  lockReason?: string;
  disabledFields: string[];
  derivedStatus: DerivedStatus;
}

const PLACEHOLDER_VALUES = new Set(['-', '--', 'null', 'undefined', 'seleccione', 'todos']);
const OTRAS_SOLICITUDES_KEY = 'Otras solicitudes a tramitar';
const OTRAS_SOLICITUDES_MULTIPLE_LINE = 'MAS DE UNA OPCION';
const OTRAS_SOLICITUDES_MULTIPLE_LINE_LEGACY = 'MAS DE UNA OPCION (VER RESUMEN ANALISIS DEL CASO)';

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeText(value: unknown): string {
  const decoded = decodeMojibakeValue(toText(value));
  return decoded
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeKeyLoose(value: unknown): string {
  return normalizeText(value)
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

function decodeMojibakeValue(value: string): string {
  let out = toText(value);
  for (let i = 0; i < 2; i += 1) {
    if (!/[\u00C3\u00C2\u00E2]/.test(out)) break;
    const decoded = latin1ToUtf8(out);
    if (!decoded || decoded === out) break;
    out = decoded;
  }
  return out;
}

function keyVariants(value: unknown): string[] {
  const raw = toText(value);
  if (!raw) return [''];
  const variants = new Set<string>([raw]);
  // Two conversion rounds cover common mojibake chains (utf8<->latin1 applied more than once).
  for (let i = 0; i < 2; i += 1) {
    const snapshot = Array.from(variants);
    for (const v of snapshot) {
      variants.add(latin1ToUtf8(v));
      variants.add(utf8ToLatin1(v));
    }
  }
  return Array.from(new Set(Array.from(variants).map((v) => normalizeKeyLoose(v))));
}

function readAnswer(answers: FormRecord, key: string): unknown {
  if (!answers) return undefined;
  if (Object.prototype.hasOwnProperty.call(answers, key)) return answers[key];
  const lookupVariants = keyVariants(key);
  const matched = Object.keys(answers).find((k) => {
    const candidateVariants = keyVariants(k);
    return candidateVariants.some((cv) => lookupVariants.includes(cv));
  });
  if (!matched) return undefined;
  return answers[matched];
}

function readFieldValue(answers: FormRecord, field: { key: string; id?: string }): unknown {
  if (field.id) {
    const byId = readAnswer(answers, field.id);
    if (byId !== undefined && byId !== null && String(byId).trim() !== '') return byId;
  }
  return readAnswer(answers, field.key);
}

export function normalizeYesNo(value: unknown): 'si' | 'no' | '' {
  if (typeof value === 'boolean') return value ? 'si' : 'no';
  const n = normalizeText(value);
  if (n === 'si' || n === 'sí') return 'si';
  if (n === 'no') return 'no';
  return '';
}

export function includesInsensitive(haystack: unknown, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}

export function isFilled(value: unknown): boolean {
  const raw = toText(value);
  if (!raw) return false;
  return !PLACEHOLDER_VALUES.has(normalizeText(raw));
}

function isAffirmativeProcedencia(value: unknown): boolean {
  if (!isFilled(value)) return false;
  if (normalizeYesNo(value) === 'si') return true;
  return normalizeText(value).startsWith('si');
}

function parseOtrasSolicitudesSelection(value: unknown): string[] {
  const text = toText(value);
  if (!text) return [];
  const parts = text
    .split(/\r?\n|\s*\|\s*|\s*;\s*/g)
    .map((item) => toText(item))
    .filter(Boolean);

  const selected: string[] = [];
  const seen = new Set<string>();
  const isP36MultipleMarker = (normalizedValue: string) =>
    (normalizedValue.includes('mas de una') && normalizedValue.includes('opci')) || (normalizedValue.includes('resumen') && normalizedValue.includes('opci'));
  for (const part of parts) {
    const normalized = normalizeText(part);
    if (!normalized) continue;
    if (
      isP36MultipleMarker(normalized) ||
      normalized === normalizeText(OTRAS_SOLICITUDES_MULTIPLE_LINE) ||
      normalized === normalizeText(OTRAS_SOLICITUDES_MULTIPLE_LINE_LEGACY)
    ) {
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    selected.push(part);
  }
  return selected;
}

function isMandatoryFieldFilled(answers: FormRecord, field: { key: string; id?: string }): boolean {
  const value = readFieldValue(answers, field);
  if (normalizeKeyLoose(field.key) === normalizeKeyLoose(OTRAS_SOLICITUDES_KEY)) {
    return parseOtrasSolicitudesSelection(value).length > 0;
  }
  return isFilled(value);
}

function hasAtLeastOneSiBetween30And34(answers: FormRecord): boolean {
  const block3Fields = auroraFormRules.mandatoryByBlock?.bloque3 || [];
  const targetIds = new Set([
    AURORA_FIELD_IDS.B3_PROCEDENCIA_LIBERTAD_CONDICIONAL,
    AURORA_FIELD_IDS.B3_PROCEDENCIA_PRISION_DOMICILIARIA,
    AURORA_FIELD_IDS.B3_PROCEDENCIA_UTILIDAD_PUBLICA,
    AURORA_FIELD_IDS.B3_PROCEDENCIA_PENA_CUMPLIDA,
    AURORA_FIELD_IDS.B3_PROCEDENCIA_ACUMULACION_PENAS,
  ]);

  const targets = block3Fields.filter((field) => field.id && targetIds.has(field.id));
  return targets.some((field) => isAffirmativeProcedencia(readFieldValue(answers, field)));
}

function hasPositiveOtrasSolicitudesInP36(answers: FormRecord): boolean {
  const block3Fields = auroraFormRules.mandatoryByBlock?.bloque3 || [];
  const q36Field =
    block3Fields.find((field) => field.id === AURORA_FIELD_IDS.B3_ANALISIS_ACTUACION) ||
    block3Fields.find((field) => normalizeKeyLoose(field.key) === normalizeKeyLoose(OTRAS_SOLICITUDES_KEY));
  if (!q36Field) return false;

  const selections = parseOtrasSolicitudesSelection(readFieldValue(answers, q36Field));
  return selections.some((item) => normalizeText(item) !== 'ninguna');
}

function firstLockMatch(answers: FormRecord) {
  return auroraFormRules.lockRules.find((rule) => rule.when(answers));
}

function getActiveBlock5Variant(answers: FormRecord): {
  id: AuroraBlockId;
  state: VariantState;
} {
  const ruleEnabled = auroraFormRules.conditionalBlockVisibility.some((rule) => rule.when(answers));
  if (ruleEnabled) return { id: 'bloque5UtilidadPublica', state: 'utilidadPublica' };

  const defaultVariant = auroraFormRules.blockVariants.bloque5.defaultVariant;
  if (defaultVariant === 'bloque5TramiteNormal') return { id: defaultVariant, state: 'default' };
  return { id: defaultVariant, state: 'tramiteNormal' };
}

function areMandatoryFieldsFilled(answers: FormRecord, blockId: string): boolean {
  const fields = auroraFormRules.mandatoryByBlock?.[blockId] || [];
  const complete = fields.every((field) => field.optional || isMandatoryFieldFilled(answers, field));
  return complete;
}

function evaluateVisibleBlocks(answers: FormRecord, locked: boolean, activeBlock5: AuroraBlockId): AuroraBlockId[] {
  const visible: AuroraBlockId[] = ['bloque1', 'bloque2Aurora'];
  if (!locked) visible.push('bloque3');

  // Progresión: 2 -> 3 -> 4 -> 5
  // Regla: AURORA.B4.VISIBILIDAD.2
  // Para habilitar Bloque 4: obligatorios de Bloque 3 + al menos un "Si" entre Q30-Q34.
  if (
    visible.includes('bloque3') &&
    areMandatoryFieldsFilled(answers, 'bloque3') &&
    (hasAtLeastOneSiBetween30And34(answers) || hasPositiveOtrasSolicitudesInP36(answers))
  ) {
    visible.push('bloque4');
  }
  // Regla: AURORA.B5.VISIBILIDAD.1
  if (!locked && visible.includes('bloque4') && areMandatoryFieldsFilled(answers, 'bloque4')) {
    visible.push(activeBlock5);
  }

  return visible;
}

function evaluateDisabledFields(answers: FormRecord): string[] {
  const disabled = new Set<string>();

  for (const rule of auroraFormRules.dependencyRules) {
    if (!rule.when(answers)) continue;
    (rule.effects.disable || []).forEach((field) => disabled.add(field));
  }

  // Reglas de habilitación que remueven de deshabilitados si estaban.
  for (const rule of auroraFormRules.dependencyRules) {
    if (!rule.when(answers)) continue;
    (rule.effects.enable || []).forEach((field) => disabled.delete(field));
  }

  return Array.from(disabled);
}

function normalizeDerivedStatus(status: string): DerivedStatus {
  const n = normalizeText(status);
  if (n.includes('caso cerrado')) return 'Caso cerrado';
  if (n.includes('analizar el caso')) return 'Analizar el caso';
  if (n.includes('entrevistar al usuario')) return 'Entrevistar al usuario';
  if (n.includes('presentar solicitud')) return 'Presentar solicitud';
  if (n.includes('presentar recurso')) return 'Presentar recurso';
  if (n.includes('pendiente')) return 'Pendiente decisión';
  return 'Analizar el caso';
}

function evaluateDerivedStatus(answers: FormRecord): DerivedStatus {
  const hit = auroraFormRules.derivedStatusRules.find((rule) => rule.when(answers));
  return normalizeDerivedStatus(hit?.status || 'Analizar el caso');
}

export function evaluateAuroraRules({ answers }: EvaluateAuroraRulesInput): EvaluateAuroraRulesResult {
  const safeAnswers = (answers || {}) as FormRecord;

  const lockHit = firstLockMatch(safeAnswers);
  const locked = Boolean(lockHit);
  const activeVariant = getActiveBlock5Variant(safeAnswers);

  const visibleBlocks = evaluateVisibleBlocks(safeAnswers, locked, activeVariant.id);
  const disabledFields = evaluateDisabledFields(safeAnswers);
  const derivedStatus = evaluateDerivedStatus(safeAnswers);

  return {
    visibleBlocks,
    blockVariants: {
      bloque5: activeVariant.state,
    },
    locked,
    lockReason: lockHit?.description,
    disabledFields,
    derivedStatus,
  };
}

export default evaluateAuroraRules;

