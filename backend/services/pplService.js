
const { getOptionalGestionSequence } = require('../config/oracle');
const personaRepo = require('../repositories/oracle/personaRepository');
const situacionRepo = require('../repositories/oracle/situacionRepository');
const gestionRepo = require('../repositories/oracle/gestionRepository');
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
  'Sentido de la decisión',
  'Motivo de la decisión negativa',
  'Se presenta recurso',
  'Fecha de recurso en caso desfavorable',
  'Sentido de la decisión que resuelve recurso',
  'Sentido de la decisión que resuelve la solicitud',
  'Estado del caso',
  'Estado del trámite',
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

bind(['Fecha última calificación', 'Fecha ultima calificacion', 'Fecha calificacion'], 'SITUACION', 'FECHA_CALIFICACION');
bind(['Calificación de conducta', 'Calificacion de conducta', 'Calificacion'], 'SITUACION', 'CALIFICACION');
bind(['PAG'], 'GESTION', 'PAG');
bind(['Defensor(a) Público(a) Asignado para tramitar la solicitud', 'Defensor(a) Publico(a) Asignado para tramitar la solicitud', 'Defensor', 'defensorAsignado'], 'GESTION', 'DEFENSOR');
bind(['Cedula defensor', 'Cédula defensor', 'cedulaDefensor', 'defensorCedula'], 'GESTION', 'CEDULA_DEFENSOR');
bind(['Acción a realizar', 'Accion a realizar'], 'GESTION', 'ACCION_REALIZAR');
bind(['Fecha de análisis jurídico del caso', 'Fecha de analisis juridico del caso', 'Fecha analisis'], 'GESTION', 'FECHA_ANALISIS');
bind(['PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS', 'Vencimiento de terminos'], 'GESTION', 'VENCIMIENTO_TERMINOS');
bind(['Procedencia de utilidad pública (solo para mujeres)', 'Utilidad publica'], 'GESTION', 'UTILIDAD_PUBLICA');
bind(['Procedencia de libertad condicional', 'Libertad condicional'], 'GESTION', 'LIBERTAD_CONDICIONAL');
bind(['Procedencia de prisión domiciliaria de mitad de pena', 'Prision domiciliaria de mitad de pena'], 'GESTION', 'PRISION_DOMICILIARIA_MITAD_PENA');
bind(['Procedencia de pena cumplida'], 'GESTION', 'PROCEDENCIA_PENA_CUMPLIDA');
bind(['Procedencia de acumulación de penas'], 'GESTION', 'PROCEDENCIA_ACUMULACION_PENAS');
bind(['Con qué proceso(s) debe acumular penas (si aplica)', 'Con que proceso(s) debe acumular penas (si aplica)'], 'GESTION', 'CON_QUE_PROCESOS_ACUMULAR');
bind(['Otras solicitudes a tramitar'], 'GESTION', 'OTRAS_SOLICITUDES_TRAMITAR');
bind(['Resumen del análisis del caso', 'Resumen del analisis del caso'], 'GESTION', 'RESUMEN_ANALISIS_CASO');
bind(['Fecha de entrevista'], 'GESTION', 'FECHA_ENTREVISTA');
bind(['Decisión del usuario', 'Decision del usuario'], 'GESTION', 'DECISION_USUARIO');
bind(['Actuación a adelantar', 'Actuacion a adelantar'], 'GESTION', 'ACTUACION_ADELANTAR');
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
bind(['Sentido de la decisión', 'Sentido de la decision'], 'GESTION', 'SENTIDO_DECISION');
bind(['Motivo de la decisión negativa', 'Motivo de la decision negativa'], 'GESTION', 'MOTIVO_DECISION_NEGATIVA');
bind(['Se presenta recurso'], 'GESTION', 'SE_PRESENTA_RECURSO');
bind(['Fecha de recurso en caso desfavorable'], 'GESTION', 'FECHA_RECURSO_DESFAVORABLE');
bind(['Sentido de la decisión que resuelve recurso', 'Sentido de la decision que resuelve recurso'], 'GESTION', 'SENTIDO_DECISION_RESUELVE_RECURSO');

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
    'Fecha de nacimiento': toIsoDate(raw.P_FECHA_NACIMIENTO),
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
    'Fase de tramiento': String(raw.S_FASE ?? ''),
    '¿ Cuenta con requerimientos judiciales por otros procesos ?': String(raw.S_REQUERIMIENTOS ?? ''),

    'Fecha última calificación': toIsoDate(raw.S_FECHA_CALIFICACION),
    'Calificación de conducta': String(raw.S_CALIFICACION ?? ''),
    PAG: String(raw.G_PAG ?? ''),
    'Defensor(a) Público(a) Asignado para tramitar la solicitud': String(raw.G_DEFENSOR ?? ''),
    'Defensor(a) Publico(a) Asignado para tramitar la solicitud': String(raw.G_DEFENSOR ?? ''),
    Defensor: String(raw.G_DEFENSOR ?? ''),
    defensorAsignado: String(raw.G_DEFENSOR ?? ''),

    'Acción a realizar': String(raw.G_ACCION_REALIZAR ?? ''),
    'Fecha de análisis jurídico del caso': toIsoDate(raw.G_FECHA_ANALISIS),
    'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS': String(raw.G_VENCIMIENTO_TERMINOS ?? ''),
    'Procedencia de utilidad pública (solo para mujeres)': String(raw.G_UTILIDAD_PUBLICA ?? ''),
    'Procedencia de libertad condicional': String(raw.G_LIBERTAD_CONDICIONAL ?? ''),
    'Procedencia de prisión domiciliaria de mitad de pena': String(raw.G_PRISION_DOMICILIARIA_MITAD_PENA ?? ''),
    'Procedencia de pena cumplida': String(raw.G_PROCEDENCIA_PENA_CUMPLIDA ?? ''),
    'Procedencia de acumulación de penas': String(raw.G_PROCEDENCIA_ACUMULACION_PENAS ?? ''),
    'Con qué proceso(s) debe acumular penas (si aplica)': String(raw.G_CON_QUE_PROCESOS_ACUMULAR ?? ''),
    'Otras solicitudes a tramitar': String(raw.G_OTRAS_SOLICITUDES_TRAMITAR ?? ''),
    'Resumen del análisis del caso': String(raw.G_RESUMEN_ANALISIS_CASO ?? ''),
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
    'Fecha de decisión de la autoridad': toIsoDate(raw.G_FECHA_DECISION_AUTORIDAD),
    'Sentido de la decisión': String(raw.G_SENTIDO_DECISION ?? ''),
    'Motivo de la decisión negativa': String(raw.G_MOTIVO_DECISION_NEGATIVA ?? ''),
    'Se presenta recurso': String(raw.G_SE_PRESENTA_RECURSO ?? ''),
    'Fecha de recurso en caso desfavorable': toIsoDate(raw.G_FECHA_RECURSO_DESFAVORABLE),
    'Sentido de la decisión que resuelve recurso': String(raw.G_SENTIDO_DECISION_RESUELVE_RECURSO ?? ''),
    'Sentido de la decisión que resuelve la solicitud': '',
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
  return coalesce(
    record?.defensorAsignado,
    record?.['Defensor(a) Público(a) Asignado para tramitar la solicitud'],
    record?.['Defensor(a) Publico(a) Asignado para tramitar la solicitud'],
    record?.Defensor
  );
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
  ['caseId', 'casos', 'activeCaseId', 'tipo', 'tipoPpl', 'data', 'rowIndex', 'actuacionId'].forEach((key) => {
    delete out[key];
  });
  return out;
}

function splitUpdatesByTable(payload) {
  const clean = stripControlKeys(normalizePayload(payload));
  const grouped = { PERSONA: {}, SITUACION: {}, GESTION: {} };

  Object.entries(clean).forEach(([key, value]) => {
    const binding = UPDATE_BINDINGS.get(normalizeText(key));
    if (!binding) return;
    grouped[binding.table][binding.column] = toTypedDbValue(binding.column, value);
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

  if (Object.keys(updates.PERSONA).length) {
    await personaRepo.updatePersonaById(context.P_ID_PERSONA, updates.PERSONA);
  }
  if (Object.keys(updates.SITUACION).length) {
    await situacionRepo.updateSituacionById(context.S_ID_SITUACION, updates.SITUACION);
  }

  const latest = await gestionRepo.getLatestBySituacion(context.S_ID_SITUACION);
  if (!String(updates.GESTION.DEFENSOR || '').trim() && String(latest?.DEFENSOR || '').trim()) {
    updates.GESTION.DEFENSOR = latest.DEFENSOR;
  }

  const gestionId = await gestionRepo.insertGestion(context.S_ID_SITUACION, updates.GESTION, {
    sequenceName: getOptionalGestionSequence(),
  });

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
  const incoming = payload && typeof payload === 'object' ? payload : {};

  if (Object.keys(updates.PERSONA).length) {
    await personaRepo.updatePersonaById(context.P_ID_PERSONA, updates.PERSONA);
  }
  if (Object.keys(updates.SITUACION).length) {
    await situacionRepo.updateSituacionById(context.S_ID_SITUACION, updates.SITUACION);
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

  if (hasMeaningfulUpdates(updates)) {
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

    const affected = await gestionRepo.assignDefensorBySituacion(context.S_ID_SITUACION, defensorNombre, {
      pagAsignador,
      defensorCedula,
    });
    if (affected > 0) {
      updated += affected;
      continue;
    }

    const inserted = await gestionRepo.insertGestion(
      context.S_ID_SITUACION,
      {
        DEFENSOR: defensorNombre,
        ...(pagAsignador ? { PAG: pagAsignador } : {}),
        ...(defensorCedula ? { CEDULA_DEFENSOR: defensorCedula } : {}),
      },
      { sequenceName: getOptionalGestionSequence() }
    );
    if (inserted) updated += 1;
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
