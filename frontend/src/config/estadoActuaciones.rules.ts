import { evaluateAuroraRules } from '../utils/evaluateAuroraRules';
import { evaluateCelesteRules } from '../utils/evaluateCelesteRules';
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

function latin1ToUtf8(value: string): string {
  try {
    return decodeURIComponent(escape(value));
  } catch {
    return value;
  }
}

function decodeMojibakeValue(value: unknown): string {
  let out = String(value ?? '').trim();
  for (let i = 0; i < 2; i += 1) {
    if (!/[\u00C3\u00C2\u00E2]/.test(out)) break;
    const decoded = latin1ToUtf8(out);
    if (!decoded || decoded === out) break;
    out = decoded;
  }
  return out;
}

function toText(value: unknown): string {
  return decodeMojibakeValue(value).trim();
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
  const normalizedEntries = Object.entries(source).map(([rawKey, value]) => {
    const normalizedKey = normalizeEstadoActuacion(rawKey).replace(/[^a-z0-9]+/g, ' ').trim();
    return { normalizedKey, value };
  });
  const values = keys.map((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
    const normalizedTarget = normalizeEstadoActuacion(key).replace(/[^a-z0-9]+/g, ' ').trim();
    const hit = normalizedEntries.find((entry) => entry.normalizedKey === normalizedTarget);
    return hit?.value;
  });
  return firstFilledValue(...values);
}

function resolveEstadoSource(record: unknown): AnyRecord {
  const source = record && typeof record === 'object' ? (record as AnyRecord) : {};
  const activeData = pickActiveCaseData(source);
  const fromEstadoSource = source?.estadoSource;
  if (fromEstadoSource && typeof fromEstadoSource === 'object') {
    return { ...(activeData || {}), ...(fromEstadoSource as AnyRecord) };
  }
  return activeData;
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
  if (key === 'pendiente audiencia') return 'Pendiente audiencia';
  if (key === 'pendiente decision de audiencia') return 'Pendiente decisión de audiencia';
  if (key === 'presentar solicitud') return 'Presentar solicitud';
  if (key === 'presentar recurso') return 'Presentar recurso';
  if (key.includes('pendiente de presentar solicitud')) return 'Presentar solicitud';
  if (key.includes('pendiente presentar solicitud')) return 'Presentar solicitud';
  if (key === 'pendiente decision') return 'Pendiente decisi\u00f3n';
  if (key.includes('pendiente de decision')) return 'Pendiente decisi\u00f3n';
  if (key === 'caso cerrado') return 'Caso cerrado';
  return toText(value);
}

export function getEstadoClassByLabel(estado: unknown): string {
  const key = normalizeEstadoActuacion(estado);
  if (key === 'analizar el caso') return 'estado--verde';
  if (key === 'entrevistar al usuario') return 'estado--amarillo';
  if (key === 'pendiente audiencia') return 'estado--azul';
  if (key === 'pendiente decision de audiencia') return 'estado--azul';
  if (key === 'presentar solicitud') return 'estado--rojo';
  if (key === 'presentar recurso') return 'estado--rojo';
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

function resolveTipoFromText(value: unknown): 'condenado' | 'sindicado' | '' {
  const text = normalizeEstadoActuacion(value);
  if (!text || text === '-') return '';
  if (text.includes('sindicad')) return 'sindicado';
  if (text.includes('condenad')) return 'condenado';
  return '';
}

function resolveFlow(record: AnyRecord, data: AnyRecord): 'condenado' | 'sindicado' {
  const fromSituacion = resolveTipoFromText(pickFirstValue(data, ['Situación Jurídica']));
  if (fromSituacion) return fromSituacion;
  const fromSituacionActualizada = resolveTipoFromText(
    pickFirstValue(data, ['Situación Jurídica actualizada (de conformidad con la rama judicial)'])
  );
  if (fromSituacionActualizada) return fromSituacionActualizada;

  const fromHints =
    resolveTipoFromText(record?.tipo) ||
    resolveTipoFromText(data?.tipo) ||
    resolveTipoFromText(data?.tipoPpl) ||
    resolveTipoFromText(data?.__tipoApi);
  if (fromHints) return fromHints;

  return 'condenado';
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
  const flow = resolveFlow(safeRecord, data);
  const derivedStatus = canonicalEstadoLabel(
    flow === 'sindicado'
      ? evaluateCelesteRules({ answers: data || {} }).derivedStatus
      : evaluateAuroraRules({ answers: data || {} }).derivedStatus
  );
  const derivedKey = normalizeEstadoActuacion(derivedStatus);
  const fallbackStatus = canonicalEstadoLabel(getEstadoTramiteValue(safeRecord));
  const fallbackKey = normalizeEstadoActuacion(fallbackStatus);
  const canPromoteFallback = new Set([
    'entrevistar al usuario',
    'pendiente audiencia',
    'pendiente decision de audiencia',
    'presentar solicitud',
    'presentar recurso',
    'pendiente decision',
    'caso cerrado',
  ]);
  const estadoKey =
    derivedKey === 'analizar el caso' && canPromoteFallback.has(fallbackKey) ? fallbackKey : derivedKey;

  // Regla: ESTADO.CASO_CERRADO.1
  if (estadoKey === 'caso cerrado') {
    return buildEstadoInfo(estadoKey, 'Caso cerrado', 'estado--gris');
  }
  // Regla: ESTADO.PENDIENTE_DECISION.1
  if (estadoKey === 'pendiente decision') {
    return buildEstadoInfo(estadoKey, 'Pendiente decisi\u00f3n', 'estado--azul');
  }
  // Regla: ESTADO.ANALIZAR.1
  if (estadoKey === 'analizar el caso') {
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
    return buildEstadoInfo(estadoKey, 'Analizar el caso', 'estado--verde', semaforo || 'estado--verde', dias);
  }
  // Regla: ESTADO.ENTREVISTAR.1
  if (estadoKey === 'entrevistar al usuario') {
    const fechaAnalisis = pickFirstValue(data, [
      'Fecha de an\u00e1lisis jur\u00eddico del caso',
      'Fecha de analisis juridico del caso',
      'aurora_b3_fechaAnalisis',
    ]);
    const dias = getDaysSince(fechaAnalisis);
    const semaforo = getSemaforoClassByDays(dias);
    return buildEstadoInfo(
      estadoKey,
      'Entrevistar al usuario',
      'estado--amarillo',
      semaforo || 'estado--amarillo',
      dias
    );
  }
  if (estadoKey === 'pendiente audiencia') {
    return buildEstadoInfo(estadoKey, 'Pendiente audiencia', 'estado--azul');
  }
  if (estadoKey === 'pendiente decision de audiencia') {
    return buildEstadoInfo(estadoKey, 'Pendiente decisión de audiencia', 'estado--azul');
  }
  // Regla: ESTADO.SOLICITUD.1
  if (estadoKey === 'presentar solicitud') {
    const fechaEntrevista = pickFirstValue(data, ['Fecha de entrevista']);
    const dias = getDaysSince(fechaEntrevista);
    const semaforo = getSemaforoClassByDays(dias);
    return buildEstadoInfo(estadoKey, 'Presentar solicitud', 'estado--rojo', semaforo || 'estado--rojo', dias);
  }
  if (estadoKey === 'presentar recurso') {
    return buildEstadoInfo(estadoKey, 'Presentar recurso', 'estado--rojo');
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
