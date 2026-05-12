
const { getOptionalGestionSequence } = require('../config/oracle');
const personaRepo = require('../repositories/oracle/personaRepository');
const situacionRepo = require('../repositories/oracle/situacionRepository');
const gestionRepo = require('../repositories/oracle/gestionRepository');
const asignacionRepo = require('../repositories/oracle/asignacionRepository');
const calificacionConductaRepo = require('../repositories/oracle/calificacionConductaRepository');
const defensoresRepo = require('../repositories/oracle/defensoresRepository');
const { DEFAULT_SCOPE_DEPARTAMENTOS } = require('../repositories/oracle/sqlFragments');

let dataVersion = 0;

const SCOPE_DEPARTAMENTOS = [...DEFAULT_SCOPE_DEPARTAMENTOS];

const LEGACY_COLUMNS = [
  'Nombre',
  'Tipo de indentificación',
  'Número de identificación',
  'Situación Jurídica',
  'Género',
  'Enfoque Étnico/Racial/Cultural',
  'Nacionalidad',
  'Fecha de nacimiento',
  'Edad',
  'Lugar de privación de la libertad',
  'Nombre del lugar de privación de la libertad',
  'Departamento del lugar de privación de la libertad',
  'Distrito/municipio del lugar de privación de la libertad',
  '¿ La persona sigue en el CDT?',
  'Autoridad a cargo',
  'Número de proceso',
  'Delitos',
  'Situación Jurídica actualizada (de conformidad con la rama judicial)',
  'Fecha de captura',
  'Pena (años, meses y días)',
  'Pena total en días',
  'Tiempo que la persona lleva privada de la libertad (en días)',
  'Redención total acumulada en días',
  'Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)',
  'Porcentaje de avance de pena cumplida',
  'Fase de tramiento',
  '¿ Cuenta con requerimientos judiciales por otros procesos ?',
  'Fecha última calificación',
  'No.Acta de calificación de conducta',
  'Evaluación de conducta desde',
  'Evaluación de conducta hasta',
  'Calificación de conducta',
  'PAG',
  'Defensor(a) Público(a) Asignado para tramitar la solicitud',
  'Acción a realizar',
  'Fecha de análisis jurídico del caso',
  'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
  'Procedencia de utilidad pública (solo para mujeres)',
  'Procedencia de libertad condicional',
  'Procedencia de prisión domiciliaria de mitad de pena',
  'Procedencia de pena cumplida',
  'Procedencia de acumulación de penas',
  'Con qué proceso(s) debe acumular penas (si aplica)',
  'Otras solicitudes a tramitar',
  'Resumen del análisis del caso',
  'Fecha de entrevista',
  'Decisión del usuario',
  'Actuación a adelantar',
  'Requiere pruebas',
  'Poder en caso de avanzar con la solicitud',
  'Fecha de entrevista psicosocial',
  'Cumple el requisito de marginalidad',
  'Cumple el requisito de jefatura de hogar',
  'Se requiere misión de trabajo',
  'Fecha de solicitud de misión de trabajo',
  'Fecha de asignación de investigador',
  'Fecha en la que se reciben todas las pruebas',
  'Fecha de recepción de pruebas aportadas por el usuario (Si aplica)',
  'Fecha de solicitud de documentos al INPEC (Si aplica)',
  'FECHA DE REVISIÓN DEL EXPEDIENTE Y ELEMENTOS MATERIALES PROBATORIOS',
  'CONFIRMACIÓN DE LA PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
  'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA',
  'FECHA DE REALIZACIÓN DE AUDIENCIA',
  'Fecha de presentación de la solicitud a la autoridad',
  'Fecha de decisión de la autoridad',
  'Fecha de radicación de solicitud de utilidad pública',
  'Sentido de la decisión',
  'Motivo de la decisión negativa',
  'Se presenta recurso',
  'Fecha de recurso en caso desfavorable',
  'Fecha de presentación del recurso',
  'Fecha de la decisión del recurso',
  'Sentido de la decisión que resuelve recurso',
  'Cierre del caso por imposibilidad de avanzar (si aplica)',
  'Sentido de la decisión que resuelve la solicitud',
  'Estado del caso',
  'Estado del trámite',
  'Fecha de asignación del PAG',
  'numero',
  'situacion',
  'ESTABLECIMIENTO',
  'Departamento',
  'Municipio',
  'autoridad',
  'Proceso',
  'Defensor',
  'Nombre usuario',
  'defensorAsignado',
  'posibleActuacionJudicial',
];

const DATE_FIELDS = new Set([
  'FECHA_NACIMIENTO',
  'FECHA_CAPTURA',
  'FECHA_CALIFICACION',
  'FECHA_ANALISIS',
  'FECHA_ENTREVISTA',
  'FECHA_ENTREVISTA_PSICOSOCIAL',
  'FECHA_SOLICITUD_MISION_TRABAJO',
  'FECHA_ASIGNACION_INVESTIGADOR',
  'FECHA_RECEPCION_TODAS_PRUEBAS',
  'FECHA_RECEPCION_PRUEBAS_USUARIO',
  'FECHA_SOLICITUD_DOCS_INPEC',
  'FECHA_REVISION_EXPEDIENTE',
  'FECHA_SOLICITUD_AUDIENCIA_CONTROL',
  'FECHA_REALIZACION_AUDIENCIA',
  'FECHA_PRESENTACION_SOLICITUD_AUTORIDAD',
  'FECHA_DECISION_AUTORIDAD',
  'FECHA_RECURSO_DESFAVORABLE',
  'FECHA_RADICACION_UTILIDAD',
  'FECHA_PRESENTACION_RECURSO',
  'FECHA_DECISION_RECURSO',
  'FECHA_CALIFICACION_1',
  'FECHA_INICIO_1',
  'FECHA_FIN_1',
  'FECHA_CALIFICACION_2',
  'FECHA_INICIO_2',
  'FECHA_FIN_2',
  'FECHA_CALIFICACION_3',
  'FECHA_INICIO_3',
  'FECHA_FIN_3',
  'FECHA_CALIFICACION_4',
  'FECHA_INICIO_4',
  'FECHA_FIN_4',
]);

const NUMERIC_FIELDS = new Set([
  'NUMERO',
  'EDAD',
  'PENA_DIAS',
  'PRIVACION',
  'REDENCION',
  'TIEMPO_EFECTIVO',
  'PORCENTAJE',
  'ACTIVO',
  'CEDULA_DEFENSOR',
  'CEDULA_PAG',
  'DIAS_PRISION',
  'DIAS_LIBERTAD',
]);

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeDocumento(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function parseLooseDate(value) {
  if (value instanceof Date) return value;
  const text = String(value ?? '').trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const slash = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = Number(slash[3]);
    let day = a;
    let month = b;
    if (a <= 12 && b > 12) {
      day = b;
      month = a;
    }
    if (a <= 12 && b <= 12 && /\d{1,2}:\d{2}/.test(text)) {
      day = b;
      month = a;
    }
    const d = new Date(y, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const generic = new Date(text);
  return Number.isNaN(generic.getTime()) ? null : generic;
}

function toIsoDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString().slice(0, 10);
  }
  const parsed = parseLooseDate(value);
  if (!parsed) return String(value ?? '').trim();
  return parsed.toISOString().slice(0, 10);
}

function calculateAgeAt(date, today = new Date()) {
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

function toBirthIsoDate(value, ageValue) {
  if (!value) return '';
  const rawText = String(value ?? '').trim();
  const twoDigitYear = rawText.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);

  let parsed = null;
  if (twoDigitYear) {
    const a = Number(twoDigitYear[1]);
    const b = Number(twoDigitYear[2]);
    const yy = Number(twoDigitYear[3]);
    let day = a;
    let month = b;
    if (a <= 12 && b > 12) {
      day = b;
      month = a;
    }
    const today = new Date();
    const reportedAge = Number.parseInt(String(ageValue ?? ''), 10);
    const candidates = [1900 + yy, 2000 + yy]
      .map((year) => new Date(year, month - 1, day))
      .filter((candidate) => !Number.isNaN(candidate.getTime()));

    if (Number.isFinite(reportedAge)) {
      parsed = candidates.reduce((best, candidate) => {
        if (!best) return candidate;
        const bestDelta = Math.abs(calculateAgeAt(best, today) - reportedAge);
        const candidateDelta = Math.abs(calculateAgeAt(candidate, today) - reportedAge);
        return candidateDelta < bestDelta ? candidate : best;
      }, null);
    } else {
      parsed = candidates.find((candidate) => candidate <= today) || candidates[0] || null;
    }
  } else {
    parsed = parseLooseDate(value);
  }

  if (!parsed || Number.isNaN(parsed.getTime())) return toIsoDate(value);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (parsed > today) {
    parsed = new Date(parsed.getFullYear() - 100, parsed.getMonth(), parsed.getDate());
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeFaseTratamientoValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const normalized = normalizeText(text);
  const map = new Map([
    ['obs', 'OBS'],
    ['observacion', 'OBS'],
    ['alt', 'ALT'],
    ['alta', 'ALT'],
    ['med', 'MED'],
    ['mediana', 'MED'],
    ['min', 'MIN'],
    ['minima', 'MIN'],
    ['con', 'CON'],
    ['confianza', 'CON'],
    ['sin', 'SIN'],
    ['no reporta', 'SIN'],
    ['sin registro', 'SIN'],
  ]);
  return map.get(normalized) || text;
}

function normalizeRequerimientosValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const normalized = normalizeText(text);
  if (normalized === 's' || normalized === 'si' || normalized === 'yes') return 'S';
  if (normalized === 'n' || normalized === 'no') return 'N';
  return text;
}

function buildCalificacionesConductaFromRaw(raw = {}) {
  return [1, 2, 3, 4].map((idx) => ({
    fechaUltimaCalificacion: toIsoDate(raw[`C_FECHA_CALIFICACION_${idx}`]),
    numeroActa: String(raw[`C_ACTA_${idx}`] ?? ''),
    evaluacionDesde: toIsoDate(raw[`C_FECHA_INICIO_${idx}`]),
    evaluacionHasta: toIsoDate(raw[`C_FECHA_FIN_${idx}`]),
    calificacionConducta: String(raw[`C_CALIFICACION_${idx}`] ?? ''),
  }));
}

function toTypedDbValue(column, value) {
  const col = String(column || '').toUpperCase();
  if (value == null) return null;

  if (DATE_FIELDS.has(col)) {
    const d = parseLooseDate(value);
    return d || null;
  }

  if (NUMERIC_FIELDS.has(col)) {
    const text = String(value).trim();
    if (!text) return null;
    const parsed = Number.parseFloat(text.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (col === 'FASE') {
    const normalized = normalizeFaseTratamientoValue(value);
    return normalized === '' ? null : normalized;
  }

  if (col === 'REQUERIMIENTOS') {
    const normalized = normalizeRequerimientosValue(value);
    return normalized === '' ? null : normalized;
  }

  const text = String(value).trim();
  return text === '' ? null : text;
}

function coalesce(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

const DEFENSOR_FIELD_ALIASES = [
  'defensorAsignado',
  'Defensor(a) Público(a) Asignado para tramitar la solicitud',
  'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
  'Defensor(a) P?blico(a) Asignado para tramitar la solicitud',
  'Defensor',
];

function isDefensorFieldKey(key) {
  const normalized = normalizeText(key)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (
    normalized === 'defensor a publico a asignado para tramitar la solicitud' ||
    normalized === 'defensor asignado' ||
    normalized === 'defensor'
  );
}

const UPDATE_BINDINGS = new Map();

function bind(aliases, table, column) {
  (aliases || []).forEach((alias) => {
    UPDATE_BINDINGS.set(normalizeText(alias), { table, column });
  });
}

bind(['Nombre', 'Nombre usuario'], 'PERSONA', 'NOMBRE');
bind(['Tipo de indentificación', 'Tipo de identificación'], 'PERSONA', 'TIPO_IDENTIFICACION');
bind(['Número de identificación', 'Numero de identificacion', 'numeroIdentificacion', 'numero'], 'PERSONA', 'NUMERO');
bind(['Género', 'Genero'], 'PERSONA', 'GENERO');
bind(['Nacionalidad'], 'PERSONA', 'NACIONALIDAD');
bind(['Fecha de nacimiento'], 'PERSONA', 'FECHA_NACIMIENTO');
bind(['Edad'], 'PERSONA', 'EDAD');

bind(['Situación Jurídica', 'Situacion Juridica', 'situacion'], 'SITUACION', 'SITUACION');
bind(
  [
    'Situación Jurídica actualizada (de conformidad con la rama judicial)',
    'Situacion Juridica actualizada (de conformidad con la rama judicial)',
    'Situación Jurídica actualizada',
  ],
  'SITUACION',
  'SITUACION_JURIDICA_ACTUALIZADA'
);
bind(['Delitos'], 'SITUACION', 'DELITOS');
bind(['Número de proceso', 'Numero de proceso', 'Proceso'], 'SITUACION', 'PROCESO');
bind(['Autoridad a cargo', 'autoridad'], 'SITUACION', 'AUTORIDAD');
bind(['Fecha de captura'], 'SITUACION', 'FECHA_CAPTURA');
bind(['Lugar de privación de la libertad', 'Lugar de privacion de la libertad'], 'SITUACION', 'LUGAR_PRIVACION');
bind(['Nombre del lugar de privación de la libertad', 'Nombre del lugar de privacion de la libertad', 'ESTABLECIMIENTO'], 'SITUACION', 'ESTABLECIMIENTO');
bind(['Departamento del lugar de privación de la libertad', 'Departamento del lugar de privacion de la libertad', 'Departamento'], 'SITUACION', 'DEPARTAMENTO');
bind(['Distrito/municipio del lugar de privación de la libertad', 'Distrito/municipio del lugar de privacion de la libertad', 'Municipio'], 'SITUACION', 'MUNICIPIO');
bind(['¿ La persona sigue en el CDT?', 'Sigue CDT'], 'SITUACION', 'SIGUE_CDT');
bind(['Pena (años, meses y días)', 'Pena'], 'SITUACION', 'PENA');
bind(['Pena total en días', 'Pena dias'], 'SITUACION', 'PENA_DIAS');
bind(['Tiempo que la persona lleva privada de la libertad (en días)', 'Privacion'], 'SITUACION', 'PRIVACION');
bind(['Redención total acumulada en días', 'Redencion'], 'SITUACION', 'REDENCION');
bind(['Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)', 'Tiempo efectivo'], 'SITUACION', 'TIEMPO_EFECTIVO');
bind(['Porcentaje de avance de pena cumplida', 'Porcentaje'], 'SITUACION', 'PORCENTAJE');
bind(['Fase de tramiento', 'Fase'], 'SITUACION', 'FASE');
bind(['Enfoque Étnico/Racial/Cultural', 'Enfoque'], 'SITUACION', 'ENFOQUE');
bind(['¿ Cuenta con requerimientos judiciales por otros procesos ?', 'Requerimientos'], 'SITUACION', 'REQUERIMIENTOS');
bind(['Categorización', 'Categorizacion'], 'SITUACION', 'CATEGORIZACION');
bind(['Dias_Prision', 'Días restantes para cumplir requisito temporal de prisión domiciliaria'], 'SITUACION', 'DIAS_PRISION');
bind(['Dias_libertad', 'Días restantes para cumplir requisito temporal de libertad condicional'], 'SITUACION', 'DIAS_LIBERTAD');

bind(['Acción a realizar', 'Accion a realizar'], 'GESTION', 'ACCION_REALIZAR');
bind(['Fecha de análisis jurídico del caso', 'Fecha de analisis juridico del caso', 'Fecha analisis'], 'GESTION', 'FECHA_ANALISIS');
bind(['Vencimiento de terminos'], 'GESTION', 'VENCIMIENTO_TERMINOS');
bind(['Procedencia de utilidad pública (solo para mujeres)', 'Utilidad publica'], 'GESTION', 'UTILIDAD_PUBLICA');
bind(['Procedencia de libertad condicional', 'Libertad condicional'], 'GESTION', 'LIBERTAD_CONDICIONAL');
bind(['Procedencia de prisión domiciliaria de mitad de pena', 'Prision domiciliaria de mitad de pena'], 'GESTION', 'PRISION_DOMICILIARIA_MITAD_PENA');
bind(['Procedencia de pena cumplida'], 'GESTION', 'PROCEDENCIA_PENA_CUMPLIDA');
bind(['Procedencia de acumulación de penas'], 'GESTION', 'PROCEDENCIA_ACUMULACION_PENAS');
bind(['Con qué proceso(s) debe acumular penas (si aplica)', 'Con que proceso(s) debe acumular penas (si aplica)'], 'GESTION', 'CON_QUE_PROCESOS_ACUMULAR');
bind(['Otras solicitudes a tramitar'], 'GESTION', 'OTRAS_SOLICITUDES_TRAMITAR');
bind(
  [
    'Resumen del análisis del caso',
    'Resumen del analisis del caso',
    'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO',
    'RESUMEN DEL ANALISIS JURIDICO DEL PRESENTE CASO',
  ],
  'GESTION',
  'RESUMEN_ANALISIS_CASO'
);
bind(['Fecha de entrevista'], 'GESTION', 'FECHA_ENTREVISTA');
bind(['Decisión del usuario', 'Decision del usuario'], 'GESTION', 'DECISION_USUARIO');
bind(
  [
    'Actuación a adelantar',
    'Actuacion a adelantar',
    'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
  ],
  'GESTION',
  'ACTUACION_ADELANTAR'
);
bind(['Requiere pruebas'], 'GESTION', 'REQUIERE_PRUEBAS');
bind(['Poder en caso de avanzar con la solicitud'], 'GESTION', 'PODER_AVANZAR_SOLICITUD');
bind(['Fecha de entrevista psicosocial'], 'GESTION', 'FECHA_ENTREVISTA_PSICOSOCIAL');
bind(['Cumple el requisito de marginalidad'], 'GESTION', 'CUMPLE_REQUISITO_MARGINALIDAD');
bind(['Cumple el requisito de jefatura de hogar'], 'GESTION', 'CUMPLE_REQUISITO_JEFATURA_HOGAR');
bind(['Se requiere misión de trabajo', 'Se requiere mision de trabajo'], 'GESTION', 'REQUIERE_MISION_TRABAJO');
bind(['Fecha de solicitud de misión de trabajo'], 'GESTION', 'FECHA_SOLICITUD_MISION_TRABAJO');
bind(['Fecha de asignación de investigador'], 'GESTION', 'FECHA_ASIGNACION_INVESTIGADOR');
bind(['Fecha en la que se reciben todas las pruebas'], 'GESTION', 'FECHA_RECEPCION_TODAS_PRUEBAS');
bind(['Fecha de recepción de pruebas aportadas por el usuario (Si aplica)'], 'GESTION', 'FECHA_RECEPCION_PRUEBAS_USUARIO');
bind(['Fecha de solicitud de documentos al INPEC (Si aplica)'], 'GESTION', 'FECHA_SOLICITUD_DOCS_INPEC');
bind(['FECHA DE REVISIÓN DEL EXPEDIENTE Y ELEMENTOS MATERIALES PROBATORIOS'], 'GESTION', 'FECHA_REVISION_EXPEDIENTE');
bind(['CONFIRMACIÓN DE LA PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS'], 'GESTION', 'CONFIRMACION_PROCEDENCIA_VENCIMIENTO');
bind(['FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA'], 'GESTION', 'FECHA_SOLICITUD_AUDIENCIA_CONTROL');
bind(['FECHA DE REALIZACIÓN DE AUDIENCIA'], 'GESTION', 'FECHA_REALIZACION_AUDIENCIA');
bind(['Fecha de presentación de la solicitud a la autoridad', 'Fecha de presentacion de la solicitud a la autoridad'], 'GESTION', 'FECHA_PRESENTACION_SOLICITUD_AUTORIDAD');
bind(['Fecha de decisión de la autoridad', 'Fecha de decision de la autoridad'], 'GESTION', 'FECHA_DECISION_AUTORIDAD');
bind(
  [
    'Fecha de radicación de solicitud de utilidad pública',
    'Fecha de radicacion de solicitud de utilidad publica',
    'Fecha de radicación de la solicitud de utilidad pública',
    'Fecha de radicacion de la solicitud de utilidad publica',
  ],
  'GESTION',
  'FECHA_RADICACION_UTILIDAD'
);
bind(['Sentido de la decisión', 'Sentido de la decision'], 'GESTION', 'SENTIDO_DECISION');
bind(['Motivo de la decisión negativa', 'Motivo de la decision negativa'], 'GESTION', 'MOTIVO_DECISION_NEGATIVA');
bind(
  [
    'Se presenta recurso',
    '¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?',
    '¿SE RECURRIO EN CASO DE DECISION NEGATIVA?',
  ],
  'GESTION',
  'SE_PRESENTA_RECURSO'
);
bind(['Fecha de recurso en caso desfavorable'], 'GESTION', 'FECHA_RECURSO_DESFAVORABLE');
bind(['Fecha de presentación del recurso', 'Fecha de presentacion del recurso'], 'GESTION', 'FECHA_PRESENTACION_RECURSO');
bind(['Fecha de la decisión del recurso', 'Fecha de la decision del recurso'], 'GESTION', 'FECHA_DECISION_RECURSO');
bind(
  [
    'Sentido de la decisión que resuelve recurso',
    'Sentido de la decision que resuelve recurso',
    'Sentido de la decisión que resuelve la solicitud',
    'Sentido de la decision que resuelve la solicitud',
    'SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO',
    'SENTIDO DE LA DECISION QUE RESUELVE RECURSO',
  ],
  'GESTION',
  'SENTIDO_DECISION_RESUELVE_RECURSO'
);
bind(
  [
    'Cierre del caso por imposibilidad de avanzar (si aplica)',
    'Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad pública',
    'Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad publica',
  ],
  'GESTION',
  'CIERRE_CASO'
);

function toLegacyRecord(raw = {}) {
  const numero = coalesce(raw.P_NUMERO, '');
  const numeroText = numero === '' ? '' : String(numero);

  const record = {
    Nombre: String(raw.P_NOMBRE ?? ''),
    'Nombre usuario': String(raw.P_NOMBRE ?? ''),
    'Tipo de indentificación': String(raw.P_TIPO_IDENTIFICACION ?? ''),
    'Número de identificación': numeroText,
    numero: numeroText,
    numeroIdentificacion: numeroText,
    'Situación Jurídica': String(raw.S_SITUACION ?? ''),
    situacion: String(raw.S_SITUACION ?? ''),
    'Género': String(raw.P_GENERO ?? ''),
    'Enfoque Étnico/Racial/Cultural': String(raw.S_ENFOQUE ?? ''),
    Nacionalidad: String(raw.P_NACIONALIDAD ?? ''),
    'Fecha de nacimiento': toBirthIsoDate(raw.P_FECHA_NACIMIENTO, raw.P_EDAD),
    Edad: String(raw.P_EDAD ?? ''),
    'Lugar de privación de la libertad': String(raw.S_LUGAR_PRIVACION ?? ''),
    'Nombre del lugar de privación de la libertad': String(raw.S_ESTABLECIMIENTO ?? ''),
    ESTABLECIMIENTO: String(raw.S_ESTABLECIMIENTO ?? ''),
    'Departamento del lugar de privación de la libertad': String(raw.S_DEPARTAMENTO ?? ''),
    Departamento: String(raw.S_DEPARTAMENTO ?? ''),
    'Distrito/municipio del lugar de privación de la libertad': String(raw.S_MUNICIPIO ?? ''),
    Municipio: String(raw.S_MUNICIPIO ?? ''),
    '¿ La persona sigue en el CDT?': String(raw.S_SIGUE_CDT ?? ''),
    'Autoridad a cargo': String(raw.S_AUTORIDAD ?? ''),
    autoridad: String(raw.S_AUTORIDAD ?? ''),
    'Número de proceso': String(raw.S_PROCESO ?? ''),
    Proceso: String(raw.S_PROCESO ?? ''),
    Delitos: String(raw.S_DELITOS ?? ''),
    'Situación Jurídica actualizada (de conformidad con la rama judicial)': String(raw.S_SITUACION_JURIDICA_ACTUALIZADA ?? ''),
    'Fecha de captura': toIsoDate(raw.S_FECHA_CAPTURA),
    'Pena (años, meses y días)': String(raw.S_PENA ?? ''),
    'Pena total en días': String(raw.S_PENA_DIAS ?? ''),
    'Tiempo que la persona lleva privada de la libertad (en días)': String(raw.S_PRIVACION ?? ''),
    'Redención total acumulada en días': String(raw.S_REDENCION ?? ''),
    'Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)': String(raw.S_TIEMPO_EFECTIVO ?? ''),
    'Porcentaje de avance de pena cumplida': String(raw.S_PORCENTAJE ?? ''),
    Categorizacion: String(raw.S_CATEGORIZACION ?? ''),
    'Días restantes para cumplir requisito temporal de prisión domiciliaria': String(raw.S_DIAS_PRISION ?? ''),
    'Días restantes para cumplir requisito temporal de libertad condicional': String(raw.S_DIAS_LIBERTAD ?? ''),
    Dias_Prision: String(raw.S_DIAS_PRISION ?? ''),
    Dias_libertad: String(raw.S_DIAS_LIBERTAD ?? ''),
    'Fase de tramiento': normalizeFaseTratamientoValue(raw.S_FASE),
    '¿ Cuenta con requerimientos judiciales por otros procesos ?': normalizeRequerimientosValue(raw.S_REQUERIMIENTOS),

    'Fecha última calificación': toIsoDate(raw.S_FECHA_CALIFICACION),
    'No.Acta de calificación de conducta': String(raw.C_ACTA_1 ?? ''),
    'Evaluación de conducta desde': toIsoDate(raw.C_FECHA_INICIO_1),
    'Evaluación de conducta hasta': toIsoDate(raw.C_FECHA_FIN_1),
    'Calificación de conducta': String(raw.S_CALIFICACION ?? ''),
    __calificacionesConducta: buildCalificacionesConductaFromRaw(raw),
    PAG: String(raw.G_PAG ?? ''),
    Cedula_PAG: String(raw.G_CEDULA_PAG ?? ''),
    'Fecha de asignación del PAG': toIsoDate(raw.G_FECHA_ASIGNACION),
    'Fecha de asignacion del PAG': toIsoDate(raw.G_FECHA_ASIGNACION),
    'Defensor(a) Público(a) Asignado para tramitar la solicitud': String(raw.G_DEFENSOR ?? ''),
    'Defensor(a) Publico(a) Asignado para tramitar la solicitud': String(raw.G_DEFENSOR ?? ''),
    Defensor: String(raw.G_DEFENSOR ?? ''),
    defensorAsignado: String(raw.G_DEFENSOR ?? ''),

    'Acción a realizar': String(raw.G_ACCION_REALIZAR ?? ''),
    'Fecha de análisis jurídico del caso': toIsoDate(raw.G_FECHA_ANALISIS),
    'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS': String(raw.G_ACTUACION_ADELANTAR ?? raw.G_VENCIMIENTO_TERMINOS ?? ''),
    'Procedencia de utilidad pública (solo para mujeres)': String(raw.G_UTILIDAD_PUBLICA ?? ''),
    'Procedencia de libertad condicional': String(raw.G_LIBERTAD_CONDICIONAL ?? ''),
    'Procedencia de prisión domiciliaria de mitad de pena': String(raw.G_PRISION_DOMICILIARIA_MITAD_PENA ?? ''),
    'Procedencia de pena cumplida': String(raw.G_PROCEDENCIA_PENA_CUMPLIDA ?? ''),
    'Procedencia de acumulación de penas': String(raw.G_PROCEDENCIA_ACUMULACION_PENAS ?? ''),
    'Con qué proceso(s) debe acumular penas (si aplica)': String(raw.G_CON_QUE_PROCESOS_ACUMULAR ?? ''),
    'Otras solicitudes a tramitar': String(raw.G_OTRAS_SOLICITUDES_TRAMITAR ?? ''),
    'Resumen del análisis del caso': String(raw.G_RESUMEN_ANALISIS_CASO ?? ''),
    'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO': String(raw.G_RESUMEN_ANALISIS_CASO ?? ''),
    'Fecha de entrevista': toIsoDate(raw.G_FECHA_ENTREVISTA),
    'Decisión del usuario': String(raw.G_DECISION_USUARIO ?? ''),
    'Actuación a adelantar': String(raw.G_ACTUACION_ADELANTAR ?? ''),
    'Requiere pruebas': String(raw.G_REQUIERE_PRUEBAS ?? ''),
    'Poder en caso de avanzar con la solicitud': String(raw.G_PODER_AVANZAR_SOLICITUD ?? ''),
    'Fecha de entrevista psicosocial': toIsoDate(raw.G_FECHA_ENTREVISTA_PSICOSOCIAL),
    'Cumple el requisito de marginalidad': String(raw.G_CUMPLE_REQUISITO_MARGINALIDAD ?? ''),
    'Cumple el requisito de jefatura de hogar': String(raw.G_CUMPLE_REQUISITO_JEFATURA_HOGAR ?? ''),
    'Se requiere misión de trabajo': String(raw.G_REQUIERE_MISION_TRABAJO ?? ''),
    'Fecha de solicitud de misión de trabajo': toIsoDate(raw.G_FECHA_SOLICITUD_MISION_TRABAJO),
    'Fecha de asignación de investigador': toIsoDate(raw.G_FECHA_ASIGNACION_INVESTIGADOR),
    'Fecha en la que se reciben todas las pruebas': toIsoDate(raw.G_FECHA_RECEPCION_TODAS_PRUEBAS),
    'Fecha de recepción de pruebas aportadas por el usuario (Si aplica)': toIsoDate(raw.G_FECHA_RECEPCION_PRUEBAS_USUARIO),
    'Fecha de solicitud de documentos al INPEC (Si aplica)': toIsoDate(raw.G_FECHA_SOLICITUD_DOCS_INPEC),
    'FECHA DE REVISIÓN DEL EXPEDIENTE Y ELEMENTOS MATERIALES PROBATORIOS': toIsoDate(raw.G_FECHA_REVISION_EXPEDIENTE),
    'CONFIRMACIÓN DE LA PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS': String(raw.G_CONFIRMACION_PROCEDENCIA_VENCIMIENTO ?? ''),
    'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA': toIsoDate(raw.G_FECHA_SOLICITUD_AUDIENCIA_CONTROL),
    'FECHA DE REALIZACIÓN DE AUDIENCIA': toIsoDate(raw.G_FECHA_REALIZACION_AUDIENCIA),
    'Fecha de presentación de la solicitud a la autoridad': toIsoDate(raw.G_FECHA_PRESENTACION_SOLICITUD_AUTORIDAD),
    'Fecha de radicación de solicitud de utilidad pública': toIsoDate(raw.G_FECHA_RADICACION_UTILIDAD),
    'Fecha de radicación de la solicitud de utilidad pública': toIsoDate(raw.G_FECHA_RADICACION_UTILIDAD),
    'Fecha de decisión de la autoridad': toIsoDate(raw.G_FECHA_DECISION_AUTORIDAD),
    'Sentido de la decisión': String(raw.G_SENTIDO_DECISION ?? ''),
    'Motivo de la decisión negativa': String(raw.G_MOTIVO_DECISION_NEGATIVA ?? ''),
    'Se presenta recurso': String(raw.G_SE_PRESENTA_RECURSO ?? ''),
    '¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?': String(raw.G_SE_PRESENTA_RECURSO ?? ''),
    'Fecha de recurso en caso desfavorable': toIsoDate(raw.G_FECHA_RECURSO_DESFAVORABLE),
    'Fecha de presentación del recurso': toIsoDate(raw.G_FECHA_PRESENTACION_RECURSO || raw.G_FECHA_RECURSO_DESFAVORABLE),
    'Fecha de la decisión del recurso': toIsoDate(raw.G_FECHA_DECISION_RECURSO),
    'Sentido de la decisión que resuelve recurso': String(raw.G_SENTIDO_DECISION_RESUELVE_RECURSO ?? ''),
    'SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO': String(raw.G_SENTIDO_DECISION_RESUELVE_RECURSO ?? ''),
    'Cierre del caso por imposibilidad de avanzar (si aplica)': String(raw.G_CIERRE_CASO ?? ''),
    'Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad pública': String(raw.G_CIERRE_CASO ?? ''),
    'Sentido de la decisión que resuelve la solicitud': String(raw.G_SENTIDO_DECISION_RESUELVE_RECURSO ?? ''),
    'Estado del caso': '',
    'Estado del trámite': '',
    posibleActuacionJudicial: String(raw.G_ACTUACION_ADELANTAR ?? ''),

    __oracleIdPersona: raw.P_ID_PERSONA == null ? null : Number(raw.P_ID_PERSONA),
    __oracleIdSituacion: raw.S_ID_SITUACION == null ? null : Number(raw.S_ID_SITUACION),
    __oracleIdGestion: raw.G_ID_GESTION == null ? null : Number(raw.G_ID_GESTION),
    __oracleCedulaDefensor: raw.G_CEDULA_DEFENSOR == null ? null : String(raw.G_CEDULA_DEFENSOR),
  };

  return record;
}

function computeTipo(record) {
  const updated = normalizeText(record?.['Situación Jurídica actualizada (de conformidad con la rama judicial)']);
  const base = normalizeText(record?.['Situación Jurídica']);
  if (updated.includes('condenad') || base.includes('condenad')) return 'condenado';
  return 'sindicado';
}

function extractDefensor(record) {
  const source = record && typeof record === 'object' ? record : {};
  const directValue = coalesce(...DEFENSOR_FIELD_ALIASES.map((key) => source?.[key]));
  if (directValue) return directValue;

  for (const [key, value] of Object.entries(source)) {
    if (!isDefensorFieldKey(key)) continue;
    const text = String(value ?? '').trim();
    if (text) return text;
  }

  return '';
}

function payloadHasDefensorField(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return Object.keys(source).some((key) => isDefensorFieldKey(key));
}

function hydrateDefensorAliases(record, fallback = '') {
  const defensor = coalesce(extractDefensor(record), fallback);
  return {
    ...(record || {}),
    defensorAsignado: defensor,
    'Defensor(a) Público(a) Asignado para tramitar la solicitud': defensor,
    'Defensor(a) Publico(a) Asignado para tramitar la solicitud': defensor,
    Defensor: defensor,
  };
}

function parseGestionIdFromActuacionId(actuacionId) {
  const text = String(actuacionId || '').trim();
  const match = text.match(/-(\d+)$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildActuacionId(documento, suffix) {
  return `${String(documento || '').trim()}-${Number(suffix)}`;
}
function normalizePayload(payload) {
  const incoming = payload && typeof payload === 'object' ? payload : {};
  const source = incoming.data && typeof incoming.data === 'object' ? incoming.data : incoming;
  return { ...source };
}

function stripControlKeys(source) {
  const out = { ...(source || {}) };
  ['caseId', 'casos', 'activeCaseId', 'tipo', 'tipoPpl', 'data', 'rowIndex', 'actuacionId', '__calificacionesConducta'].forEach((key) => {
    delete out[key];
  });
  return out;
}

function normalizeCalificacionesPayload(payload) {
  const clean = normalizePayload(payload);
  const rows = Array.isArray(clean.__calificacionesConducta) ? clean.__calificacionesConducta : [];
  if (!rows.length) return {};

  const out = {};
  rows.slice(0, 4).forEach((row, index) => {
    const idx = index + 1;
    const source = row && typeof row === 'object' ? row : {};
    out[`CALIFICACION_${idx}`] = toTypedDbValue(`CALIFICACION_${idx}`, source.calificacionConducta);
    out[`ACTA_${idx}`] = toTypedDbValue(`ACTA_${idx}`, source.numeroActa);
    out[`FECHA_INICIO_${idx}`] = toTypedDbValue(`FECHA_INICIO_${idx}`, source.evaluacionDesde);
    out[`FECHA_FIN_${idx}`] = toTypedDbValue(`FECHA_FIN_${idx}`, source.evaluacionHasta);
    out[`FECHA_CALIFICACION_${idx}`] = toTypedDbValue(`FECHA_CALIFICACION_${idx}`, source.fechaUltimaCalificacion);
  });

  return out;
}

function splitUpdatesByTable(payload, { allowBaseUpdates = false } = {}) {
  const clean = stripControlKeys(normalizePayload(payload));
  const grouped = { PERSONA: {}, SITUACION: {}, GESTION: {} };

  Object.entries(clean).forEach(([key, value]) => {
    const binding = UPDATE_BINDINGS.get(normalizeText(key));
    if (!binding) return;
    if (!allowBaseUpdates && (binding.table === 'PERSONA' || binding.table === 'SITUACION')) return;
    const dbValue = toTypedDbValue(binding.column, value);
    if (
      dbValue == null &&
      Object.prototype.hasOwnProperty.call(grouped[binding.table], binding.column) &&
      grouped[binding.table][binding.column] != null
    ) {
      return;
    }
    grouped[binding.table][binding.column] = dbValue;
  });

  return grouped;
}

function toRecordList(rows = []) {
  return rows.map((row) => toLegacyRecord(row));
}

function resolveFallbackDefensor(records = []) {
  let fallback = '';
  records.forEach((record) => {
    const defensor = extractDefensor(record);
    if (defensor) fallback = defensor;
  });
  return fallback;
}

async function getAll() {
  const rows = await personaRepo.listRowsWithActiveSituacionAndGestiones({
    scopeDepartamentos: SCOPE_DEPARTAMENTOS,
  });
  return toRecordList(rows);
}

function getColumns() {
  return [...LEGACY_COLUMNS];
}

async function getByDocumento(documento) {
  const doc = normalizeDocumento(documento);
  if (!doc) return null;

  const rows = await personaRepo.listRowsWithActiveSituacionAndGestiones({
    documento: doc,
    scopeDepartamentos: SCOPE_DEPARTAMENTOS,
  });

  if (!rows.length) return null;
  const records = toRecordList(rows);
  const last = records[records.length - 1];
  const fallbackDefensor = resolveFallbackDefensor(records);

  return hydrateDefensorAliases(last, fallbackDefensor);
}

async function getActuacionesByDocumento(documento) {
  const doc = normalizeDocumento(documento);
  if (!doc) return [];

  const rows = await personaRepo.listRowsWithActiveSituacionAndGestiones({
    documento: doc,
    scopeDepartamentos: SCOPE_DEPARTAMENTOS,
  });

  if (!rows.length) return [];
  const records = toRecordList(rows);

  let fallbackDefensor = '';
  return records.map((record, idx) => {
    const defensor = extractDefensor(record);
    if (defensor) fallbackDefensor = defensor;

    const gestionId = Number(record.__oracleIdGestion || 0);
    const rowIndex = gestionId > 0 ? gestionId : idx;

    return {
      id: buildActuacionId(doc, rowIndex),
      rowIndex,
      registro: hydrateDefensorAliases(record, fallbackDefensor),
    };
  });
}

function hasMeaningfulUpdates(grouped) {
  return Object.keys(grouped.PERSONA).length > 0 || Object.keys(grouped.SITUACION).length > 0 || Object.keys(grouped.GESTION).length > 0;
}
async function createActuacionByDocumento(documento, payload) {
  const doc = normalizeDocumento(documento);
  if (!doc) return null;

  const context = await personaRepo.findActiveContextByDocumento(doc, {
    scopeDepartamentos: SCOPE_DEPARTAMENTOS,
  });
  if (!context?.S_ID_SITUACION) return null;

  const updates = splitUpdatesByTable(payload);
  const calificacionUpdates = normalizeCalificacionesPayload(payload);
  const normalizedPayload = normalizePayload(payload);

  if (Object.keys(updates.PERSONA).length) {
    await personaRepo.updatePersonaById(context.P_ID_PERSONA, updates.PERSONA);
  }
  if (Object.keys(updates.SITUACION).length) {
    await situacionRepo.updateSituacionById(context.S_ID_SITUACION, updates.SITUACION);
  }
  if (Object.keys(calificacionUpdates).length) {
    await calificacionConductaRepo.upsertBySituacion(context.S_ID_SITUACION, calificacionUpdates);
  }

  const gestionId = await gestionRepo.insertGestion(context.S_ID_SITUACION, updates.GESTION, {
    sequenceName: getOptionalGestionSequence(),
  });

  if (payloadHasDefensorField(normalizedPayload)) {
    const nextDefensor = String(extractDefensor(normalizedPayload) || '').trim();
    const currentDefensor = String(context.G_DEFENSOR || '').trim();
    if (normalizeText(nextDefensor) !== normalizeText(currentDefensor)) {
      if (nextDefensor) {
        await asignacionRepo.replaceActiveAssignmentByPersona(context.P_ID_PERSONA, {
          defensorNombre: nextDefensor,
          pagNombre: coalesce(normalizedPayload.PAG, context.G_PAG),
          pagCedula: coalesce(normalizedPayload.Cedula_PAG, context.G_CEDULA_PAG),
        });
      }
    }
  }

  dataVersion += 1;

  const refreshed = await personaRepo.listRowsWithActiveSituacionAndGestiones({
    documento: doc,
    scopeDepartamentos: SCOPE_DEPARTAMENTOS,
  });

  const row = refreshed.find((item) => Number(item?.G_ID_GESTION || 0) === Number(gestionId)) || refreshed[refreshed.length - 1];
  const record = hydrateDefensorAliases(toLegacyRecord(row));

  return {
    id: buildActuacionId(doc, Number(gestionId || record.__oracleIdGestion || 0)),
    rowIndex: Number(gestionId || record.__oracleIdGestion || 0),
    registro: record,
  };
}

async function updateByDocumento(documento, payload) {
  const doc = normalizeDocumento(documento);
  if (!doc) return null;

  const context = await personaRepo.findActiveContextByDocumento(doc, {
    scopeDepartamentos: SCOPE_DEPARTAMENTOS,
  });
  if (!context?.S_ID_SITUACION) return null;

  const updates = splitUpdatesByTable(payload);
  const calificacionUpdates = normalizeCalificacionesPayload(payload);
  const incoming = payload && typeof payload === 'object' ? payload : {};
  const normalizedPayload = normalizePayload(payload);

  if (Object.keys(updates.PERSONA).length) {
    await personaRepo.updatePersonaById(context.P_ID_PERSONA, updates.PERSONA);
  }
  if (Object.keys(updates.SITUACION).length) {
    await situacionRepo.updateSituacionById(context.S_ID_SITUACION, updates.SITUACION);
  }
  if (Object.keys(calificacionUpdates).length) {
    await calificacionConductaRepo.upsertBySituacion(context.S_ID_SITUACION, calificacionUpdates);
  }

  let targetGestionId = null;
  if (Number.isInteger(incoming?.rowIndex) && incoming.rowIndex > 0) {
    targetGestionId = Number(incoming.rowIndex);
  }
  if (!targetGestionId) {
    targetGestionId = parseGestionIdFromActuacionId(incoming?.actuacionId);
  }
  if (!targetGestionId) {
    const latest = await gestionRepo.getLatestBySituacion(context.S_ID_SITUACION);
    targetGestionId = Number(latest?.ID_GESTION || 0) || null;
  }

  if (Object.keys(updates.GESTION).length) {
    if (targetGestionId) {
      const affected = await gestionRepo.updateGestionById(targetGestionId, updates.GESTION);
      if (!affected) {
        targetGestionId = await gestionRepo.insertGestion(context.S_ID_SITUACION, updates.GESTION, {
          sequenceName: getOptionalGestionSequence(),
        });
      }
    } else {
      targetGestionId = await gestionRepo.insertGestion(context.S_ID_SITUACION, updates.GESTION, {
        sequenceName: getOptionalGestionSequence(),
      });
    }
  }

  if (payloadHasDefensorField(normalizedPayload)) {
    const nextDefensor = String(extractDefensor(normalizedPayload) || '').trim();
    const currentDefensor = String(context.G_DEFENSOR || '').trim();
    if (normalizeText(nextDefensor) !== normalizeText(currentDefensor)) {
      if (nextDefensor) {
        await asignacionRepo.replaceActiveAssignmentByPersona(context.P_ID_PERSONA, {
          defensorNombre: nextDefensor,
          pagNombre: coalesce(normalizedPayload.PAG, context.G_PAG),
          pagCedula: coalesce(normalizedPayload.Cedula_PAG, context.G_CEDULA_PAG),
        });
        dataVersion += 1;
      }
    }
  }

  if (hasMeaningfulUpdates(updates) || Object.keys(calificacionUpdates).length) {
    dataVersion += 1;
  }

  const refreshed = await personaRepo.listRowsWithActiveSituacionAndGestiones({
    documento: doc,
    scopeDepartamentos: SCOPE_DEPARTAMENTOS,
  });

  if (!refreshed.length) return null;
  let row = refreshed[refreshed.length - 1];
  if (targetGestionId) {
    const hit = refreshed.find((item) => Number(item?.G_ID_GESTION || 0) === Number(targetGestionId));
    if (hit) row = hit;
  }

  return hydrateDefensorAliases(toLegacyRecord(row));
}

function isPlaceholderDefensor(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  const cleaned = raw.toUpperCase().replace(/\s+/g, ' ');
  return cleaned === 'DEFENSOR(A) - EJEMPLO' || /^DEFENSOR\s*\(A\)\s*\d+$/.test(cleaned);
}

async function assignDefensor(documentos, defensor, options = {}) {
  const docs = Array.from(new Set((documentos || []).map((item) => normalizeDocumento(item)).filter(Boolean)));
  if (!docs.length) return 0;

  let defensorNombre = String(defensor || '').trim();
  const pagAsignador = String(options?.pagAsignador || '').trim();
  const pagNombre = String(options?.pagNombre || pagAsignador || '').trim();
  const pagCedula = normalizeDocumento(options?.pagCedula || options?.cedulaPag || '');
  let defensorCedula = defensoresRepo.normalizeCedula(options?.defensorCedula || options?.defensorId || '');

  if (defensorCedula) {
    const defensorDb = await defensoresRepo.findByCedula(defensorCedula);
    if (!defensorDb) {
      defensorCedula = '';
    } else {
      const dbNombre = String(defensorDb.nombre || '').trim();
      if (dbNombre) defensorNombre = dbNombre;
    }
  }

  if (!defensorNombre) return 0;

  let updated = 0;
  for (const doc of docs) {
    const context = await personaRepo.findActiveContextByDocumento(doc, {
      scopeDepartamentos: SCOPE_DEPARTAMENTOS,
    });
    if (!context?.S_ID_SITUACION) continue;

    const affected = await asignacionRepo.replaceActiveAssignmentByPersona(context.P_ID_PERSONA, {
      defensorNombre,
      pagNombre,
      pagCedula,
      defensorCedula,
    });
    if (affected > 0) updated += affected;
  }

  if (updated > 0) dataVersion += 1;
  return updated;
}

async function getDefensoresDistinct({ tipo } = {}) {
  const rows = await personaRepo.listDistinctDefensores({
    tipo,
    scopeDepartamentos: SCOPE_DEPARTAMENTOS,
  });

  return Array.from(new Set(rows.filter((name) => !isPlaceholderDefensor(name)))).sort((a, b) => a.localeCompare(b));
}

function getDataVersion() {
  return dataVersion;
}

module.exports = {
  getAll,
  getColumns,
  getByDocumento,
  getActuacionesByDocumento,
  createActuacionByDocumento,
  updateByDocumento,
  assignDefensor,
  getDefensoresDistinct,
  computeTipo,
  getDataVersion,
  normalizeText,
  SCOPE_DEPARTAMENTOS,
};
