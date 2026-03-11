import { evaluateAuroraRules } from '../utils/evaluateAuroraRules';
import { pickActiveCaseData } from '../utils/entrevistaEstado';

type AnyRecord = Record<string, unknown>;

export interface EstadoActuacionInfo {
  estadoLogico: string;
  etiqueta: string;
  claseBase: string;
  claseSemaforo: string;
  claseFinal: string;
  diasSemaforo: number | null;
  // Backward-compatible aliases for current UI consumers.
  label: string;
  className: string;
}

export interface EstadoDisplayInfo {
  label: string;
  className: string;
}

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function firstFilledValue(...values: unknown[]): string {
  for (const value of values) {
    const text = toText(value);
    if (text && text !== '-' && text !== '\u2014') return text;
  }
  return '';
}

function pickFirstValue(source: AnyRecord, keys: string[]): string {
  if (!source || typeof source !== 'object') return '';
  return firstFilledValue(...keys.map((key) => source?.[key]));
}

function resolveEstadoSource(record: unknown): AnyRecord {
  const source = record && typeof record === 'object' ? (record as AnyRecord) : {};
  const fromEstadoSource = source?.estadoSource;
  if (fromEstadoSource && typeof fromEstadoSource === 'object') {
    return fromEstadoSource as AnyRecord;
  }
  return pickActiveCaseData(source);
}

export function normalizeEstadoActuacion(value: unknown): string {
  return toText(value)
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function canonicalEstadoLabel(value: unknown): string {
  const key = normalizeEstadoActuacion(value);
  if (key === 'analizar el caso') return 'Analizar el caso';
  if (key === 'entrevistar al usuario') return 'Entrevistar al usuario';
  if (key === 'presentar solicitud') return 'Presentar solicitud';
  if (key === 'pendiente decision') return 'Pendiente decisi\u00f3n';
  if (key === 'caso cerrado') return 'Caso cerrado';
  return toText(value);
}

export function getEstadoClassByLabel(estado: unknown): string {
  const key = normalizeEstadoActuacion(estado);
  if (key === 'analizar el caso') return 'estado--verde';
  if (key === 'entrevistar al usuario') return 'estado--amarillo';
  if (key === 'presentar solicitud') return 'estado--rojo';
  if (key === 'pendiente decision') return 'estado--azul';
  if (key === 'caso cerrado') return 'estado--gris';
  if (key === 'cerrado') return 'estado--gris';
  if (key === 'activo') return 'estado--azul';
  return '';
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = toText(value);
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const dmyMatch = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getDaysSince(value: unknown): number | null {
  const date = parseDateValue(value);
  if (!date) return null;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}

export function getSemaforoClassByDays(days: number | null): string {
  if (days === null || !Number.isFinite(days)) return '';
  // Regla: ESTADO.SEMAFORO.VERDE.1
  if (days <= 15) return 'estado--verde';
  // Regla: ESTADO.SEMAFORO.AMARILLO.1
  if (days <= 30) return 'estado--amarillo';
  // Regla: ESTADO.SEMAFORO.ROJO.1
  return 'estado--rojo';
}

function getEstadoTramiteValue(record: unknown): string {
  const data = resolveEstadoSource(record);
  return firstFilledValue(
    data?.['Acci\u00f3n a realizar'] ??
      data?.['Accion a realizar'] ??
      data?.['Actuaci\u00f3n a adelantar'] ??
      data?.['Actuacion a adelantar'] ??
      data?.posibleActuacionJudicial ??
      data?.['Estado del caso'] ??
      data?.['Estado del tr\u00e1mite'] ??
      data?.['Estado del tramite'] ??
      data?.estado ??
      data?.estadoEntrevista ??
      data?.['Estado entrevista']
  );
}

function buildEstadoInfo(
  estadoLogico: string,
  etiqueta: string,
  claseBase: string,
  claseSemaforo = '',
  diasSemaforo: number | null = null
): EstadoActuacionInfo {
  const claseFinal = claseSemaforo || claseBase;
  return {
    estadoLogico,
    etiqueta,
    claseBase,
    claseSemaforo,
    claseFinal,
    diasSemaforo,
    label: etiqueta,
    className: claseFinal,
  };
}

export function obtenerEstadoActuacion(record: unknown): EstadoActuacionInfo {
  const safeRecord = record && typeof record === 'object' ? (record as AnyRecord) : {};
  const data = resolveEstadoSource(safeRecord);
  const derivedStatus = canonicalEstadoLabel(evaluateAuroraRules({ answers: data || {} }).derivedStatus);
  const derivedKey = normalizeEstadoActuacion(derivedStatus);

  // Regla: ESTADO.CASO_CERRADO.1
  if (derivedKey === 'caso cerrado') {
    return buildEstadoInfo(derivedKey, 'Caso cerrado', 'estado--gris');
  }
  // Regla: ESTADO.PENDIENTE_DECISION.1
  if (derivedKey === 'pendiente decision') {
    return buildEstadoInfo(derivedKey, 'Pendiente decisi\u00f3n', 'estado--azul');
  }
  // Regla: ESTADO.ANALIZAR.1
  if (derivedKey === 'analizar el caso') {
    const fechaAsignacionPag = firstFilledValue(
      pickFirstValue(data, [
        'Fecha de asignaci\u00f3n del PAG',
        'Fecha asignaci\u00f3n del PAG',
        'Fecha de asignaci\u00f3n PAG',
        'Fecha asignaci\u00f3n PAG',
        'Fecha de asignaci\u00f3n',
        'Fecha de asignacion',
        'fechaAsignacionPAG',
        'fechaAsignacionPag',
        'fechaAsignacion',
      ]),
      safeRecord?.createdAt
    );
    const dias = getDaysSince(fechaAsignacionPag);
    const semaforo = getSemaforoClassByDays(dias);
    return buildEstadoInfo(derivedKey, 'Analizar el caso', 'estado--verde', semaforo || 'estado--verde', dias);
  }
  // Regla: ESTADO.ENTREVISTAR.1
  if (derivedKey === 'entrevistar al usuario') {
    const fechaAnalisis = pickFirstValue(data, [
      'Fecha de an\u00e1lisis jur\u00eddico del caso',
      'Fecha de analisis juridico del caso',
      'aurora_b3_fechaAnalisis',
    ]);
    const dias = getDaysSince(fechaAnalisis);
    const semaforo = getSemaforoClassByDays(dias);
    return buildEstadoInfo(derivedKey, 'Entrevistar al usuario', 'estado--amarillo', semaforo || 'estado--amarillo', dias);
  }
  // Regla: ESTADO.SOLICITUD.1
  if (derivedKey === 'presentar solicitud') {
    const fechaEntrevista = pickFirstValue(data, ['Fecha de entrevista']);
    const dias = getDaysSince(fechaEntrevista);
    const semaforo = getSemaforoClassByDays(dias);
    return buildEstadoInfo(derivedKey, 'Presentar solicitud', 'estado--rojo', semaforo || 'estado--rojo', dias);
  }

  const fallbackLabel = firstFilledValue(getEstadoTramiteValue(safeRecord), derivedStatus);
  const fallbackClass = getEstadoClassByLabel(fallbackLabel);
  return buildEstadoInfo(normalizeEstadoActuacion(fallbackLabel), fallbackLabel, fallbackClass);
}

export function getEstadoDisplayInfo(record: unknown): EstadoDisplayInfo {
  const estado = obtenerEstadoActuacion(record);
  const label = toText(estado?.etiqueta);
  const className = toText(estado?.claseFinal || getEstadoClassByLabel(label));
  return { label, className };
}

export default obtenerEstadoActuacion;
