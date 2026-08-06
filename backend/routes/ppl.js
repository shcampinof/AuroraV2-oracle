const express = require('express');
const consolidado = require('../db/oracleConsolidado.repo');
const pagRepo = require('../repositories/oracle/pagRepository');
const defensoresRepo = require('../repositories/oracle/defensoresRepository');
const personaRepo = require('../repositories/oracle/personaRepository');
const { ESTADOS_CASO, getEstadoEtiqueta, resolveEstadoCodigo } = require('../domain/estadoCaso');
const {
  catalogVersions,
  listAcciones,
  resolveAccionPendiente,
  resolveCentro,
} = require('../domain/catalogosHomologacion');
const { normalizeComparisonText } = require('../utils/textNormalization');
const { buildHomologationAudit } = require('../services/homologationAuditService');

const router = express.Router();
const { requirePag } = require('../middleware/roles');

const DEFAULT_LIST_LIMIT = 5000;
const MAX_LIST_LIMIT = 10000;
const DEFAULT_CONDENADOS_LIMIT = 1000;
const DEFAULT_CONDENADOS_FILTERED_LIMIT = 200;
const MAX_CONDENADOS_FILTERED_LIMIT = 200;
const ACCION_FUERA_PRISION = 'Caso cerrado - Fuera de prisión';
const CONDENADOS_COLUMNS = [
  'numeroIdentificacion',
  'nombreUsuario',
  'lugarReclusion',
  'departamentoLugarReclusion',
  'municipioLugarReclusion',
  'autoridadCargo',
  'numeroProceso',
  'situacionJuridica',
  'defensorAsignado',
  'accionImpulsar',
  'fuenteInformacion',
  'fechaCorte',
];
const MAX_ROUTE_CACHE_VARIANTS = 12;
const FILTER_OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const pplListCache = new Map();
const condenadosListCache = new Map();
const condenadosListInFlight = new Map();
const condenadosFilterOptionsCache = new Map();
const homologationAuditCache = new Map();

function boundedCacheSet(map, key, value, maxEntries = MAX_ROUTE_CACHE_VARIANTS) {
  if (map.size >= maxEntries && !map.has(key)) {
    map.clear();
  }
  map.set(key, value);
}

function getTimedCache(map, key) {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - Number(hit.createdAt || 0) > FILTER_OPTIONS_CACHE_TTL_MS) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

function parseLimit(rawLimit, fallback = DEFAULT_LIST_LIMIT) {
  const parsed = Number.parseInt(String(rawLimit || `${fallback}`), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_LIST_LIMIT);
}

function parseFilteredLimit(rawLimit, fallback = DEFAULT_CONDENADOS_FILTERED_LIMIT) {
  const parsed = Number.parseInt(String(rawLimit || `${fallback}`), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_CONDENADOS_FILTERED_LIMIT);
}

const normalizeText = normalizeComparisonText;

function normalizeDocumento(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

const POTENCIAL_SUBROGADO_CATEGORY = {
  BENEFICIARIO: 'potenciales_beneficiarios',
  MUJER_UTILIDAD_PUBLICA: 'mujeres_potenciales_utilidad_publica',
  PROXIMO: 'proximos_requisito_temporal',
  NO_REUNE: 'no_reunen_requisitos',
};

function parsePotencialSubrogadoFilter(value) {
  const key = normalizeText(value);
  if (!key) return '';

  // Compatibilidad con filtro booleano legado.
  if (key === '1' || key === 'true' || key === 'si' || key === 'yes') return 'potenciales_candidatos';
  if (key === '0' || key === 'false' || key === 'no') return POTENCIAL_SUBROGADO_CATEGORY.NO_REUNE;

  if (key.includes('todas las personas condenadas') || key === 'todas' || key === 'all') return '';
  if (key === POTENCIAL_SUBROGADO_CATEGORY.BENEFICIARIO || key.includes('potenciales beneficiarios')) {
    return POTENCIAL_SUBROGADO_CATEGORY.BENEFICIARIO;
  }
  if (
    key === POTENCIAL_SUBROGADO_CATEGORY.MUJER_UTILIDAD_PUBLICA ||
    key.includes('mujeres potenciales beneficiarias unicamente de utilidad publica')
  ) {
    return POTENCIAL_SUBROGADO_CATEGORY.MUJER_UTILIDAD_PUBLICA;
  }
  if (key === POTENCIAL_SUBROGADO_CATEGORY.PROXIMO || key.includes('proximas a cumplir requisito temporal')) {
    return POTENCIAL_SUBROGADO_CATEGORY.PROXIMO;
  }
  if (key === POTENCIAL_SUBROGADO_CATEGORY.NO_REUNE || key.includes('no reunen los requisitos')) {
    return POTENCIAL_SUBROGADO_CATEGORY.NO_REUNE;
  }

  return '';
}

function computeCategoriaPotencialSubrogado(row) {
  const categorizacion = normalizeText(getValueWithFallback(row, 'Categorizacion', 'CATEGORIZACION', ''));
  const criteriosBeneficiarios = [
    normalizeText('Prisión Domiciliaria y Libertad condicional'),
    normalizeText('Prisión Domiciliaria'),
    normalizeText('Revisar por pena'),
    normalizeText('Libertad condicional'),
  ];
  if (categorizacion.startsWith('preliminar ')) {
    return POTENCIAL_SUBROGADO_CATEGORY.PROXIMO;
  }
  if (categorizacion === normalizeText('Utilidad Pública')) {
    return POTENCIAL_SUBROGADO_CATEGORY.MUJER_UTILIDAD_PUBLICA;
  }
  if (criteriosBeneficiarios.some((criterio) => categorizacion.includes(criterio))) {
    return POTENCIAL_SUBROGADO_CATEGORY.BENEFICIARIO;
  }
  return POTENCIAL_SUBROGADO_CATEGORY.NO_REUNE;
}

function firstFilled(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function toIsoDate(value) {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value ?? '').trim();
  return parsed.toISOString().slice(0, 10);
}

function getValueWithFallback(row, primary, secondary = '', fallback = '') {
  return consolidado.getValue(row, primary, consolidado.getValue(row, secondary, fallback));
}

function canonicalEstadoLabel(value) {
  const key = normalizeText(value);
  if (!key) return '';
  if (key.includes('analizar el caso')) return 'Analizar el caso';
  if (key.includes('entrevistar al usuario')) return 'Entrevistar al usuario';
  if (key.includes('pendiente decision de audiencia')) return 'Pendiente decisión de audiencia';
  if (key.includes('pendiente audiencia')) return 'Pendiente audiencia';
  if (key.includes('presentar solicitud')) return 'Presentar solicitud';
  if (key.includes('presentar recurso')) return 'Presentar recurso';
  if (key.includes('pendiente decision')) return 'Pendiente decisión';
  if (key.includes('caso cerrado') || key === 'cerrado') return 'Caso cerrado';
  return '';
}

function resolveEstadoLabelFromRawRow(row) {
  const estadoCaso = getValueWithFallback(row, 'Estado del caso', '', '');
  const estadoTramite = getValueWithFallback(row, 'Estado del trámite', 'Estado del tramite', '');
  const accionImpulsar = getValueWithFallback(row, 'Acción a impulsar', 'Accion a impulsar', '');
  const accion = getValueWithFallback(row, 'Acción a realizar', 'Accion a realizar', '');
  const actuacion = getValueWithFallback(row, 'Actuación a adelantar', 'Actuacion a adelantar', '');
  const posible = getValueWithFallback(row, 'posibleActuacionJudicial', '', '');
  return firstFilled(
    canonicalEstadoLabel(estadoCaso),
    canonicalEstadoLabel(estadoTramite),
    canonicalEstadoLabel(accionImpulsar),
    canonicalEstadoLabel(accion),
    canonicalEstadoLabel(actuacion),
    canonicalEstadoLabel(posible)
  );
}

function buildEstadoSource(row) {
  return {
    'Situación Jurídica': getValueWithFallback(row, 'Situacion Juridica', 'situacion', ''),
    'Defensor(a) Público(a) Asignado para tramitar la solicitud': getValueWithFallback(
      row,
      'Defensor(a) Público(a) Asignado para tramitar la solicitud',
      'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
      ''
    ),
    'Fecha de análisis jurídico del caso': getValueWithFallback(
      row,
      'Fecha de análisis jurídico del caso',
      'Fecha de analisis juridico del caso',
      ''
    ),
    'Resumen del análisis del caso': firstFilled(
      getValueWithFallback(row, 'Resumen del análisis del caso', 'Resumen del analisis del caso', ''),
      getValueWithFallback(
        row,
        'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO',
        'RESUMEN DEL ANALISIS JURIDICO DEL PRESENTE CASO',
        ''
      )
    ),
    'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO': firstFilled(
      getValueWithFallback(
        row,
        'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO',
        'RESUMEN DEL ANALISIS JURIDICO DEL PRESENTE CASO',
        ''
      ),
      getValueWithFallback(row, 'Resumen del análisis del caso', 'Resumen del analisis del caso', '')
    ),
    'Fecha de entrevista': getValueWithFallback(row, 'Fecha de entrevista', '', ''),
    'Actuación a adelantar': firstFilled(
      getValueWithFallback(row, 'Actuación a adelantar', 'Actuacion a adelantar', ''),
      getValueWithFallback(row, 'Tipo de solicitud a tramitar', '', '')
    ),
    'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS': firstFilled(
      getValueWithFallback(
        row,
        'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
        'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TERMINOS',
        ''
      ),
      getValueWithFallback(row, 'Actuación a adelantar', 'Actuacion a adelantar', '')
    ),
    'Procedencia de libertad condicional': getValueWithFallback(
      row,
      'Procedencia de libertad condicional',
      '',
      ''
    ),
    'Procedencia de prisión domiciliaria de mitad de pena': getValueWithFallback(
      row,
      'Procedencia de prisión domiciliaria de mitad de pena',
      'Procedencia de prision domiciliaria de mitad de pena',
      ''
    ),
    'Procedencia de utilidad pública (solo para mujeres)': getValueWithFallback(
      row,
      'Procedencia de utilidad pública (solo para mujeres)',
      'Procedencia de utilidad publica (solo para mujeres)',
      ''
    ),
    'Procedencia de pena cumplida': getValueWithFallback(row, 'Procedencia de pena cumplida', '', ''),
    'Procedencia de acumulación de penas': getValueWithFallback(
      row,
      'Procedencia de acumulación de penas',
      'Procedencia de acumulacion de penas',
      ''
    ),
    'Con qué proceso(s) debe acumular penas (si aplica)': getValueWithFallback(
      row,
      'Con qué proceso(s) debe acumular penas (si aplica)',
      'Con que procesos debe acumular penas (si aplica)',
      ''
    ),
    'Otras solicitudes a tramitar': getValueWithFallback(row, 'Otras solicitudes a tramitar', '', ''),
    'Decisión del usuario': getValueWithFallback(row, 'Decisión del usuario', 'Decision del usuario', ''),
    'Requiere pruebas': getValueWithFallback(row, 'Requiere pruebas', '', ''),
    'Poder en caso de avanzar con la solicitud': getValueWithFallback(
      row,
      'Poder en caso de avanzar con la solicitud',
      '',
      ''
    ),
    'Fecha de entrevista psicosocial': getValueWithFallback(row, 'Fecha de entrevista psicosocial', '', ''),
    'Cumple el requisito de marginalidad': getValueWithFallback(
      row,
      'Cumple el requisito de marginalidad',
      '',
      ''
    ),
    'Cumple el requisito de jefatura de hogar': getValueWithFallback(
      row,
      'Cumple el requisito de jefatura de hogar',
      '',
      ''
    ),
    'Se requiere misión de trabajo': getValueWithFallback(
      row,
      'Se requiere misión de trabajo',
      'Se requiere mision de trabajo',
      ''
    ),
    'Fecha de solicitud de misión de trabajo': getValueWithFallback(
      row,
      'Fecha de solicitud de misión de trabajo',
      'Fecha de solicitud de mision de trabajo',
      ''
    ),
    'Fecha de asignación de investigador': getValueWithFallback(
      row,
      'Fecha de asignación de investigador',
      'Fecha de asignacion de investigador',
      ''
    ),
    'Fecha en la que se reciben todas las pruebas': getValueWithFallback(
      row,
      'Fecha en la que se reciben todas las pruebas',
      '',
      ''
    ),
    'Fecha de recepción de pruebas aportadas por el usuario (Si aplica)': getValueWithFallback(
      row,
      'Fecha de recepción de pruebas aportadas por el usuario (Si aplica)',
      'Fecha de recepcion de pruebas aportadas por el usuario (Si aplica)',
      ''
    ),
    'Fecha de solicitud de documentos al INPEC (Si aplica)': getValueWithFallback(
      row,
      'Fecha de solicitud de documentos al INPEC (Si aplica)',
      '',
      ''
    ),
    'FECHA DE REVISIÓN DEL EXPEDIENTE Y ELEMENTOS MATERIALES PROBATORIOS': getValueWithFallback(
      row,
      'FECHA DE REVISIÓN DEL EXPEDIENTE Y ELEMENTOS MATERIALES PROBATORIOS',
      'FECHA DE REVISION DEL EXPEDIENTE Y ELEMENTOS MATERIALES PROBATORIOS',
      ''
    ),
    'CONFIRMACIÓN DE LA PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS': getValueWithFallback(
      row,
      'CONFIRMACIÓN DE LA PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
      'CONFIRMACION DE LA PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TERMINOS',
      ''
    ),
    'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA': getValueWithFallback(
      row,
      'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA',
      'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTIAS PARA SUSTENTAR REVOCATORIA',
      ''
    ),
    'FECHA DE REALIZACIÓN DE AUDIENCIA': getValueWithFallback(
      row,
      'FECHA DE REALIZACIÓN DE AUDIENCIA',
      'FECHA DE REALIZACION DE AUDIENCIA',
      ''
    ),
    'Se presenta recurso': getValueWithFallback(row, 'Se presenta recurso', '', ''),
    '¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?': getValueWithFallback(
      row,
      '¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?',
      'SE RECURRIO EN CASO DE DECISION NEGATIVA',
      ''
    ),
    'Sentido de la decisión': getValueWithFallback(row, 'Sentido de la decisión', 'Sentido de la decision', ''),
    'SENTIDO DE LA DECISIÓN': getValueWithFallback(
      row,
      'SENTIDO DE LA DECISIÓN',
      'SENTIDO DE LA DECISION',
      ''
    ),
    'Motivo de la decisión negativa': getValueWithFallback(
      row,
      'Motivo de la decisión negativa',
      'Motivo de la decision negativa',
      ''
    ),
    'Fecha de recurso en caso desfavorable': getValueWithFallback(
      row,
      'Fecha de recurso en caso desfavorable',
      '',
      ''
    ),
    'Fecha de presentación del recurso': getValueWithFallback(
      row,
      'Fecha de presentación del recurso',
      'Fecha de presentacion del recurso',
      ''
    ),
    'Sentido de la decisión que resuelve recurso': getValueWithFallback(
      row,
      'Sentido de la decisión que resuelve recurso',
      'Sentido de la decision que resuelve recurso',
      ''
    ),
    'SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO': getValueWithFallback(
      row,
      'SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO',
      'SENTIDO DE LA DECISION QUE RESUELVE RECURSO',
      ''
    ),
    'Fecha de la decisión del recurso': getValueWithFallback(
      row,
      'Fecha de la decisión del recurso',
      'Fecha de la decision del recurso',
      ''
    ),
    'Sentido de la decisión que resuelve la solicitud': getValueWithFallback(
      row,
      'Sentido de la decisión que resuelve la solicitud',
      'Sentido de la decision que resuelve la solicitud',
      ''
    ),
    'Cierre del caso por imposibilidad de avanzar (si aplica)': getValueWithFallback(
      row,
      'Cierre del caso por imposibilidad de avanzar (si aplica)',
      '',
      ''
    ),
    'Fecha de presentación de la solicitud a la autoridad': firstFilled(
      getValueWithFallback(
        row,
        'Fecha de presentación de la solicitud a la autoridad',
        'Fecha de presentacion de la solicitud a la autoridad',
        ''
      ),
      getValueWithFallback(
        row,
        'Fecha de presentación de solicitud a la autoridad',
        'Fecha de presentacion de solicitud a la autoridad',
        ''
      ),
      getValueWithFallback(
        row,
        'Fecha de presentación de la solicitud a la autoridad judicial',
        'Fecha de presentacion de la solicitud a la autoridad judicial',
        ''
      ),
      getValueWithFallback(
        row,
        'Fecha de presentación de solicitud a la autoridad judicial',
        'Fecha de presentacion de solicitud a la autoridad judicial',
        ''
      )
    ),
    'Fecha de radicación de solicitud de utilidad pública': firstFilled(
      getValueWithFallback(
        row,
        'Fecha de radicación de solicitud de utilidad pública',
        'Fecha de radicacion de solicitud de utilidad publica',
        ''
      ),
      getValueWithFallback(
        row,
        'Fecha de radicación de la solicitud de utilidad pública',
        'Fecha de radicacion de la solicitud de utilidad publica',
        ''
      )
    ),
    'Fecha de decisión de la autoridad': firstFilled(
      getValueWithFallback(row, 'Fecha de decisión de la autoridad', 'Fecha de decision de la autoridad', ''),
      getValueWithFallback(
        row,
        'Fecha de decisión de la autoridad judicial',
        'Fecha de decision de la autoridad judicial',
        ''
      )
    ),
    'Fecha de asignación del PAG': getValueWithFallback(
      row,
      'Fecha de asignación del PAG',
      'Fecha de asignacion del PAG',
      ''
    ),
    'Estado del caso': getValueWithFallback(row, 'Estado del caso', '', ''),
    'Estado del trámite': getValueWithFallback(row, 'Estado del trámite', 'Estado del tramite', ''),
    'Acción a impulsar': getValueWithFallback(row, 'Acción a impulsar', 'Accion a impulsar', ''),
    'Acción a realizar': getValueWithFallback(row, 'Acción a realizar', 'Accion a realizar', ''),
    'posibleActuacionJudicial': getValueWithFallback(row, 'posibleActuacionJudicial', '', ''),
  };
}

function compactFilledFields(source) {
  return Object.fromEntries(
    Object.entries(source || {}).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      return typeof value !== 'string' || value.trim() !== '';
    })
  );
}

function mapCondenadoRow(row) {
  const situacionActiva = Number(row?.S_ACTIVO) === 1;
  const estadoCodigoCalculado = situacionActiva
    ? resolveEstadoCodigo(row?.ESTADO_CODIGO || resolveEstadoLabelFromRawRow(row)) || 'ANALIZAR_CASO'
    : 'CASO_CERRADO';
  const estadoEtiquetaCalculada = situacionActiva
    ? getEstadoEtiqueta(estadoCodigoCalculado) || 'Analizar el caso'
    : ACCION_FUERA_PRISION;
  const lugarOriginal = getValueWithFallback(
    row,
    'Nombre del lugar de privacion de la libertad',
    'ESTABLECIMIENTO',
    ''
  );
  const centroReclusion = resolveCentro(lugarOriginal);
  const accionOriginal = situacionActiva
    ? firstFilled(
        getValueWithFallback(row, 'Acción a impulsar', 'Accion a impulsar', ''),
        getValueWithFallback(row, 'Acción a realizar', 'Accion a realizar', '')
      )
    : '';
  const accionPendienteBase = resolveAccionPendiente({
    estadoCodigo: estadoCodigoCalculado,
    valorOriginal: accionOriginal,
  });
  const accionPendiente = situacionActiva
    ? accionPendienteBase
    : {
        ...(accionPendienteBase || {}),
        etiqueta: ACCION_FUERA_PRISION,
        homologada: true,
        fuente: 'situacion_inactiva',
      };
  const categoriaPotencialSubrogado =
    String(row?.CATEGORIA_POTENCIAL_SUBROGADO || '').trim() || computeCategoriaPotencialSubrogado(row);
  const esPotencialSubrogado = categoriaPotencialSubrogado !== POTENCIAL_SUBROGADO_CATEGORY.NO_REUNE;
  return {
    situacionActiva,
    numeroIdentificacion: getValueWithFallback(row, 'Numero de identificacion', 'numero', ''),
    nombreUsuario: getValueWithFallback(row, 'Nombre', 'Nombre usuario', ''),
    lugarReclusion: centroReclusion?.label || lugarOriginal,
    lugarReclusionOriginal: lugarOriginal,
    centroId: centroReclusion?.id || '',
    centroHomologado: centroReclusion?.homologado === true,
    centroReclusion,
    departamentoLugarReclusion: getValueWithFallback(
      row,
      'Departamento del lugar de privacion de la libertad',
      'Departamento',
      ''
    ),
    municipioLugarReclusion: getValueWithFallback(
      row,
      'Distrito/municipio del lugar de privacion de la libertad',
      'Municipio',
      ''
    ),
    autoridadCargo: getValueWithFallback(row, 'Autoridad a cargo', 'autoridad', ''),
    numeroProceso: getValueWithFallback(row, 'Numero de proceso', 'Proceso', ''),
    situacionJuridica:
      getValueWithFallback(row, 'Situacion Juridica', 'situacion', '') ||
      getValueWithFallback(
        row,
        'Situacion Juridica actualizada (de conformidad con la rama judicial)',
        'Situacion Juridica actualizada',
        ''
      ),
    defensorAsignado: getValueWithFallback(
      row,
      'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
      'Defensor',
      ''
    ),
    defensorId: String(row?.DEFENSOR_ID || '').trim(),
    fuenteInformacion: String(row?.FUENTE_SITUACION || '').trim(),
    fechaCorte: toIsoDate(row?.FECHA_CORTE_SITUACION),
    totalSituaciones: Number(row?.TOTAL_SITUACIONES || 0),
    tieneHistorialActivoInactivo:
      Number(row?.MIN_ACTIVO_HISTORICO) === 0 && Number(row?.MAX_ACTIVO_HISTORICO) === 1,
    estadoCodigo: estadoCodigoCalculado,
    estadoEtiqueta: estadoEtiquetaCalculada,
    accionImpulsar: accionPendiente?.etiqueta || accionOriginal,
    'Acción a impulsar': accionPendiente?.etiqueta || accionOriginal,
    accionPendiente,
    categoriaPotencialSubrogado,
    esPotencialSubrogado,
    // Los campos vacios no aportan a las reglas de estado y aumentaban
    // considerablemente el JSON enviado por cada fila.
    estadoSource: compactFilledFields({
      ...buildEstadoSource(row),
      'Estado del caso': estadoEtiquetaCalculada,
      ...(situacionActiva
        ? {}
        : {
            'Estado del trámite': ACCION_FUERA_PRISION,
            'Acción a impulsar': ACCION_FUERA_PRISION,
            'Acción a realizar': ACCION_FUERA_PRISION,
          }),
    }),
    'Estado del caso': estadoEtiquetaCalculada,
  };
}

function getCondenadosFiltersFromQuery(query) {
  return {
    defensor: String(query?.defensor ?? '').trim(),
    defensorId: String(query?.defensorId ?? '').trim(),
    nombre: String(query?.nombre ?? '').trim(),
    documento: String(query?.documento ?? '').trim(),
    lugar: String(query?.lugar ?? '').trim(),
    centroId: String(query?.centroId ?? '').trim(),
    departamento: String(query?.departamento ?? '').trim(),
    municipio: String(query?.municipio ?? '').trim(),
    estadoAccion: String(query?.estadoAccion ?? '').trim(),
    estadoCodigo: String(query?.estadoCodigo ?? '').trim(),
    estado: String(query?.estado ?? '').trim(),
    accionCodigo: String(query?.accionCodigo ?? '').trim(),
    accion: String(query?.accion ?? '').trim(),
    potencialSubrogado: String(query?.potencialSubrogado ?? '').trim(),
  };
}

function hasCondenadosFilters(filters) {
  return Object.values(filters || {}).some((value) => String(value || '').trim() !== '');
}

function matchesPrefix(value, filterValue) {
  const needle = normalizeText(filterValue);
  if (!needle) return true;
  const haystack = normalizeText(value);
  if (!haystack) return false;
  return haystack.startsWith(needle);
}

function matchesContains(value, filterValue) {
  const needle = normalizeText(filterValue);
  if (!needle) return true;
  const haystack = normalizeText(value);
  if (!haystack) return false;
  return haystack.includes(needle);
}

function getEstadoAccionText(row) {
  const candidates = [
    // Prioriza etiquetas canónicas de estado.
    canonicalEstadoLabel(row?.['Estado del caso']),
    canonicalEstadoLabel(row?.estadoSource?.['Estado del trámite']),
    canonicalEstadoLabel(row?.estadoSource?.['Estado del tramite']),
    canonicalEstadoLabel(row?.estadoSource?.['Acción a realizar']),
    canonicalEstadoLabel(row?.estadoSource?.['Accion a realizar']),
    canonicalEstadoLabel(row?.estadoSource?.['Actuación a adelantar']),
    canonicalEstadoLabel(row?.estadoSource?.['Actuacion a adelantar']),
    canonicalEstadoLabel(row?.estadoSource?.posibleActuacionJudicial),

    // También indexa texto libre de acción/estado para búsqueda parcial.
    row?.estadoSource?.['Acción a realizar'],
    row?.estadoSource?.['Accion a realizar'],
    row?.estadoSource?.['Actuación a adelantar'],
    row?.estadoSource?.['Actuacion a adelantar'],
    row?.estadoSource?.posibleActuacionJudicial,
    row?.estadoSource?.['Estado del trámite'],
    row?.estadoSource?.['Estado del tramite'],
    row?.estadoSource?.['Estado del caso'],
    row?.['Estado del caso'],
  ];

  const unique = [];
  const seen = new Set();
  for (const raw of candidates) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const key = normalizeText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }

  return unique.join(' | ');
}

function matchesCondenadoFilters(row, filters) {
  const documentoFiltro = normalizeDocumento(filters?.documento);
  if (documentoFiltro) {
    const documentoRow = normalizeDocumento(row?.numeroIdentificacion);
    if (!documentoRow || !documentoRow.startsWith(documentoFiltro)) return false;
  }

  if (!matchesContains(row?.nombreUsuario, filters?.nombre)) return false;
  if (!matchesPrefix(row?.defensorAsignado, filters?.defensor)) return false;
  if (!matchesPrefix(row?.lugarReclusion, filters?.lugar)) return false;
  if (!matchesPrefix(row?.departamentoLugarReclusion, filters?.departamento)) return false;
  if (!matchesPrefix(row?.municipioLugarReclusion, filters?.municipio)) return false;
  if (!matchesContains(getEstadoAccionText(row), filters?.estadoAccion)) return false;

  const estadoFiltro = canonicalEstadoLabel(filters?.estado);
  if (estadoFiltro) {
    const estadoRow = firstFilled(
      canonicalEstadoLabel(row?.['Estado del caso']),
      canonicalEstadoLabel(row?.estadoSource?.['Estado del trámite']),
      canonicalEstadoLabel(row?.estadoSource?.['Estado del tramite']),
      canonicalEstadoLabel(row?.estadoSource?.['Acción a realizar']),
      canonicalEstadoLabel(row?.estadoSource?.['Accion a realizar']),
      canonicalEstadoLabel(row?.estadoSource?.['Actuación a adelantar']),
      canonicalEstadoLabel(row?.estadoSource?.['Actuacion a adelantar']),
      canonicalEstadoLabel(row?.estadoSource?.posibleActuacionJudicial)
    );
    if (!estadoRow || estadoRow !== estadoFiltro) return false;
  }

  const potencialFiltro = parsePotencialSubrogadoFilter(filters?.potencialSubrogado);
  if (potencialFiltro) {
    const categoria = String(row?.categoriaPotencialSubrogado || '');
    if (potencialFiltro === 'potenciales_candidatos') {
      if (categoria === POTENCIAL_SUBROGADO_CATEGORY.NO_REUNE) return false;
    } else if (categoria !== potencialFiltro) {
      return false;
    }
  }

  return true;
}

function keepLatestByDocumento(rows) {
  const byDoc = new Map();
  for (const row of rows || []) {
    const docKey = normalizeDocumento(row?.numeroIdentificacion);
    if (!docKey) continue;
    // La ultima aparicion corresponde a la actuacion mas reciente.
    byDoc.set(docKey, row);
  }
  return Array.from(byDoc.values());
}

function resolveDefensorFromRegistro(registro) {
  const source = registro && typeof registro === 'object' ? registro : {};
  const directKeys = [
    'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
    'Defensor(a) Público(a) Asignado para tramitar la solicitud',
    'Defensor(a) P?blico(a) Asignado para tramitar la solicitud',
    'Defensor',
    'defensorAsignado',
  ];

  for (const key of directKeys) {
    const value = String(source?.[key] ?? '').trim();
    if (value) return value;
  }

  for (const [key, rawValue] of Object.entries(source)) {
    const normalized = normalizeText(key).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    const isDefensorField =
      normalized === 'defensor a publico a asignado para tramitar la solicitud' ||
      normalized === 'defensor asignado' ||
      normalized === 'defensor';
    if (!isDefensorField) continue;
    const value = String(rawValue ?? '').trim();
    if (value) return value;
  }

  return '';
}

function hydrateRegistroDefensor(registro, fallbackDefensor = '') {
  const base = registro && typeof registro === 'object' ? registro : {};
  const defensor = resolveDefensorFromRegistro(base) || String(fallbackDefensor || '').trim();
  if (!defensor) return { ...base, defensorAsignado: '' };
  return {
    ...base,
    defensorAsignado: defensor,
    'Defensor(a) Publico(a) Asignado para tramitar la solicitud': defensor,
    'Defensor(a) Público(a) Asignado para tramitar la solicitud': defensor,
    Defensor: defensor,
  };
}

async function resolveDefensorByDocumento(documento) {
  const doc = String(documento || '').trim();
  if (!doc) return '';

  const actuaciones = await consolidado.getActuacionesByDocumento(doc);
  let fallback = '';
  for (const item of actuaciones) {
    const row = item?.registro;
    const defensor = resolveDefensorFromRegistro(row);
    if (!defensor) continue;
    fallback = defensor;
  }
  return fallback;
}

// Listado por tipo: /api/ppl?tipo=condenado | sindicado
router.get('/', async (req, res) => {
  const tipo = String(req.query.tipo || 'all').trim().toLowerCase();
  const limit = parseLimit(req.query.limit, DEFAULT_LIST_LIMIT);
  const version = Number(consolidado.getDataVersion?.() || 0);
  const cacheKey = `${version}|${tipo}|${limit}`;
  if (pplListCache.has(cacheKey)) {
    return res.json(pplListCache.get(cacheKey));
  }

  try {
    const allRows = await consolidado.getAll();
    const rows =
      tipo === 'condenado' || tipo === 'sindicado'
        ? allRows.filter((r) => consolidado.computeTipo(r) === tipo)
        : allRows;
    const payload = { tipo, columns: consolidado.getColumns(), rows: rows.slice(0, limit) };
    boundedCacheSet(pplListCache, cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error('[ppl:listado] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error consultando PPL.' });
  }
});

// Listado de condenados (mapeado para tabla de asignacion)
router.get('/condenados/filter-options', async (req, res) => {
  const requestedTipo = String(req.query.tipo || 'all').trim().toLowerCase();
  const tipo =
    requestedTipo === 'all' || requestedTipo === 'condenado' || requestedTipo === 'sindicado'
      ? requestedTipo
      : 'all';
  const filters = getCondenadosFiltersFromQuery(req.query);
  const version = Number(consolidado.getDataVersion?.() || 0);
  const cacheKey = `${version}|${tipo}|${JSON.stringify({
    departamento: filters.departamento,
    municipio: filters.municipio,
    defensor: filters.defensor,
    defensorId: filters.defensorId,
    centroId: filters.centroId,
  })}`;
  const cached = getTimedCache(condenadosFilterOptionsCache, cacheKey);
  if (cached) return res.json(cached);

  try {
    const options = await personaRepo.listDistinctCondenadosFilterOptions({
      tipo,
      filters,
      maxPerField: 2000,
    });
    const centrosById = new Map();
    for (const rawValue of options.lugares || []) {
      const centro = resolveCentro(rawValue);
      if (!centro) continue;
      const previous = centrosById.get(centro.id);
      if (previous) {
        previous.valoresOriginales.push(centro.valorOriginal);
        continue;
      }
      centrosById.set(centro.id, {
        id: centro.id,
        label: centro.label,
        homologado: centro.homologado,
        valoresOriginales: [centro.valorOriginal],
      });
    }
    const centros = Array.from(centrosById.values()).sort((a, b) => a.label.localeCompare(b.label));
    const centrosHomologados = centros.filter((item) => item.homologado).length;
    const centrosNoHomologados = centros.length - centrosHomologados;
    const payload = {
      ...options,
      estados: ESTADOS_CASO,
      acciones: listAcciones(),
      centros,
      meta: {
        tipo,
        cacheTtlMs: FILTER_OPTIONS_CACHE_TTL_MS,
        catalogVersions,
        homologacionCentros: {
          total: centros.length,
          homologados: centrosHomologados,
          noHomologados: centrosNoHomologados,
        },
      },
    };
    boundedCacheSet(condenadosFilterOptionsCache, cacheKey, {
      createdAt: Date.now(),
      value: payload,
    });
    return res.json(payload);
  } catch (err) {
    console.error('[ppl:condenados:filter-options] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error consultando opciones de filtros.' });
  }
});

router.get('/condenados/homologation-audit', requirePag, async (req, res) => {
  const requestedTipo = String(req.query.tipo || 'all').trim().toLowerCase();
  const tipo = ['all', 'condenado', 'sindicado'].includes(requestedTipo) ? requestedTipo : 'all';
  const pendingLimit = Math.max(1, Math.min(1000, Number.parseInt(String(req.query.limit || '100'), 10) || 100));
  const version = Number(consolidado.getDataVersion?.() || 0);
  const cacheKey = `${version}|${tipo}|${pendingLimit}|${JSON.stringify(catalogVersions)}`;
  const cached = getTimedCache(homologationAuditCache, cacheKey);
  if (cached) {
    res.setHeader('X-Aurora-Cache', 'HIT');
    return res.json(cached);
  }

  try {
    const values = await personaRepo.listCondenadosHomologationValues({ tipo, maxPerField: 5000 });
    const report = buildHomologationAudit({
      centerRows: values.centros,
      actionRows: values.acciones,
      pendingLimit,
    });
    boundedCacheSet(homologationAuditCache, cacheKey, {
      createdAt: Date.now(),
      value: report,
    });
    res.setHeader('X-Aurora-Cache', 'MISS');
    return res.json(report);
  } catch (err) {
    console.error('[ppl:condenados:homologation-audit] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error generando auditoría de homologación.' });
  }
});

router.get('/condenados', async (req, res) => {
  const requestedTipo = String(req.query.tipo || 'condenado').trim().toLowerCase();
  const tipo =
    requestedTipo === 'all' || requestedTipo === 'condenado' || requestedTipo === 'sindicado'
      ? requestedTipo
      : 'condenado';
  const filters = getCondenadosFiltersFromQuery(req.query);
  const hasFilters = hasCondenadosFilters(filters);
  if (tipo === 'all' && !hasFilters) {
    return res.status(400).json({
      message: 'Debe indicar al menos un filtro para consultar usuarios asignados.',
    });
  }
  const limit = parseLimit(req.query.limit, DEFAULT_CONDENADOS_LIMIT);
  const filteredLimit = parseFilteredLimit(req.query.filteredLimit, DEFAULT_CONDENADOS_FILTERED_LIMIT);
  const effectiveLimit = hasFilters ? filteredLimit : limit;
  const version = Number(consolidado.getDataVersion?.() || 0);
  const filtersKey = hasFilters ? JSON.stringify(filters) : 'nofilter';
  const cacheKey = `${version}|${tipo}|${limit}|${filteredLimit}|${filtersKey}`;
  if (condenadosListCache.has(cacheKey)) {
    res.setHeader('Server-Timing', 'condenados;dur=0;desc="cache-hit"');
    res.setHeader('X-Aurora-Cache', 'HIT');
    return res.json(condenadosListCache.get(cacheKey));
  }

  const startedAt = Date.now();
  const existingRequest = condenadosListInFlight.get(cacheKey);
  try {
    const request =
      existingRequest ||
      (async () => {
        const summary = await personaRepo.listCondenadosSummary({
          tipo,
          filters,
          limit: effectiveLimit,
          // Para la tabla basta saber si hay mas resultados. Evita COUNT(*)
          // sobre todo el conjunto, que era la parte mas costosa del primer ingreso.
          includeExactCounts: false,
        });
        const rows = (Array.isArray(summary?.rows) ? summary.rows : []).map((row) => mapCondenadoRow(row));
        const payload = {
          columns: CONDENADOS_COLUMNS,
          rows,
          meta: {
            tipo,
            filtered: hasFilters,
            totalAvailable: Number(summary?.totalAvailable || 0),
            totalMatched: Number(summary?.totalMatched || 0),
            totalMatchedExact: summary?.totalMatchedExact !== false,
            returned: rows.length,
            homologacion: {
              centrosNoHomologados: rows.filter((row) => row?.centroReclusion?.homologado === false).length,
              accionesNoHomologadas: rows.filter((row) => row?.accionPendiente?.homologada === false).length,
              catalogVersions,
            },
            limitApplied: effectiveLimit,
            truncated:
              typeof summary?.truncated === 'boolean'
                ? summary.truncated
                : Number(summary?.totalMatched || 0) > effectiveLimit,
          },
        };
        boundedCacheSet(condenadosListCache, cacheKey, payload);
        return payload;
      })();

    if (!existingRequest) condenadosListInFlight.set(cacheKey, request);
    const payload = await request;
    const elapsedMs = Date.now() - startedAt;
    res.setHeader('Server-Timing', `condenados;dur=${elapsedMs};desc="${existingRequest ? 'coalesced' : 'oracle'}"`);
    res.setHeader('X-Aurora-Cache', existingRequest ? 'COALESCED' : 'MISS');
    return res.json(payload);
  } catch (err) {
    console.error('[ppl:condenados] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error consultando condenados.' });
  } finally {
    if (!existingRequest) condenadosListInFlight.delete(cacheKey);
  }
});

// Validar cedula PAG contra catalogo Oracle
// GET /api/ppl/pag/:cedula/validar
router.get('/pag/:cedula/validar', requirePag, async (req, res) => {
  const cedula = String(req.params?.cedula || '').trim();
  if (!cedula) {
    return res.status(400).json({ message: 'Debe indicar la cedula del PAG.' });
  }

  try {
    const pag = await pagRepo.findByCedula(cedula);
    if (!pag) {
      return res.status(404).json({ message: 'Cedula PAG no encontrada en el listado.' });
    }

    return res.json({ ok: true, pag });
  } catch (err) {
    console.error('[ppl:pag:validar] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error consultando PAG.' });
  }
});

// Asignacion masiva de defensor por documento(s)
// POST /api/ppl/asignar-defensor
// body: { documentos: string[] | string, defensor: string, pagCedula: string, defensorCedula?: string }
router.post('/asignar-defensor', requirePag, async (req, res) => {
  const body = req.body || {};
  const defensor = String(body?.defensor || '').trim();
  const defensorCedula = defensoresRepo.normalizeCedula(body?.defensorCedula || body?.defensorId || '');
  const pagCedula = String(body?.pagCedula || '').trim();
  const rawDocs = Array.isArray(body?.documentos) ? body.documentos : [body?.documentos];
  const documentos = rawDocs.map((d) => String(d || '').trim()).filter(Boolean);

  if (!defensor && !defensorCedula) {
    return res.status(400).json({ message: 'Debe indicar un defensor.' });
  }
  if (!pagCedula) {
    return res.status(400).json({ message: 'Debe indicar la cedula del PAG que asigna.' });
  }
  if (!documentos.length) {
    return res.status(400).json({ message: 'Debe indicar al menos un documento.' });
  }

  try {
    const pag = await pagRepo.findByCedula(pagCedula);
    if (!pag) {
      return res.status(400).json({ message: 'Cedula PAG no valida para asignar.' });
    }

    let defensorNombre = defensor;
    if (defensorCedula) {
      const defensorDb = await defensoresRepo.findByCedula(defensorCedula);
      if (!defensorDb) {
        return res.status(404).json({ message: 'Cedula de defensor no encontrada.' });
      }
      defensorNombre = String(defensorDb.nombre || '').trim() || defensorNombre;
    }

    const pagAsignador = pag?.nombre ? `${pag.nombre} (${pag.cedula})` : String(pag.cedula || '').trim();
    const updated = await consolidado.assignDefensor(documentos, defensorNombre, {
      pagAsignador,
      pagNombre: String(pag?.nombre || '').trim(),
      pagCedula: pag.cedula,
      defensorCedula,
    });
    return res.json({
      ok: true,
      updated,
      documentos: Array.from(new Set(documentos)),
      defensor: defensorNombre,
      defensorCedula,
      pag,
    });
  } catch (err) {
    console.error('[ppl:asignar-defensor] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error guardando la asignación de defensor.' });
  }
});

// Historial de actuaciones por documento
router.get('/:documento/actuaciones', async (req, res) => {
  const doc = req.params.documento;
  try {
    const base = await consolidado.getByDocumento(doc);
    if (!base) return res.status(404).json({ message: 'No encontrado' });

    const defensorBase = resolveDefensorFromRegistro(base) || (await resolveDefensorByDocumento(doc));
    const actuaciones = (await consolidado.getActuacionesByDocumento(doc)).map((actuacion) => ({
      ...actuacion,
      registro: hydrateRegistroDefensor(actuacion?.registro, defensorBase),
    }));
    return res.json({ documento: doc, actuaciones });
  } catch (err) {
    console.error('[ppl:actuaciones:get] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error consultando historial de actuaciones.' });
  }
});

// Crear actuacion persistente por documento
router.post('/:documento/actuaciones', async (req, res) => {
  const doc = req.params.documento;
  const body = req.body || {};

  try {
    if (!(await consolidado.getByDocumento(doc))) {
      return res.status(404).json({ message: 'No encontrado' });
    }

    const actuacion = await consolidado.createActuacionByDocumento(doc, body);
    if (!actuacion) {
      return res.status(400).json({ message: 'No fue posible crear la actuacion' });
    }

    const defensorBase = resolveDefensorFromRegistro(actuacion?.registro) || (await resolveDefensorByDocumento(doc));
    const hydratedRegistro = hydrateRegistroDefensor(actuacion?.registro, defensorBase);

    return res.status(201).json({
      documento: doc,
      actuacion: {
        ...actuacion,
        registro: hydratedRegistro,
      },
      registro: hydratedRegistro,
    });
  } catch (err) {
    console.error('[ppl:actuaciones:create] Error Oracle:', err?.message || err);
    if (err?.code === 'PPL_SITUACION_INACTIVA') {
      return res.status(409).json({ code: err.code, message: err.message });
    }
    return res.status(500).json({ message: 'Error creando actuación.' });
  }
});

// Busqueda unificada por documento: devuelve tipo + registro
router.get('/:documento', async (req, res) => {
  const doc = req.params.documento;

  try {
    const r = await consolidado.getByDocumento(doc);
    if (r) {
      const fallbackDefensor = await resolveDefensorByDocumento(doc);
      return res.json({
        tipo: consolidado.computeTipo(r),
        registro: hydrateRegistroDefensor(r, fallbackDefensor),
      });
    }
    return res.status(404).json({ message: 'No encontrado' });
  } catch (err) {
    console.error('[ppl:getByDocumento] Error Oracle:', err?.message || err);
    return res.status(500).json({ message: 'Error consultando documento.' });
  }
});

// Update unificado
router.put('/:documento', async (req, res) => {
  const doc = req.params.documento;
  const body = req.body || {};

  try {
    if (await consolidado.getByDocumento(doc)) {
      const upd = await consolidado.updateByDocumento(doc, body);
      if (!upd) return res.status(404).json({ message: 'No encontrado' });
      return res.json({ tipo: consolidado.computeTipo(upd), registro: hydrateRegistroDefensor(upd) });
    }
    return res.status(404).json({ message: 'No encontrado' });
  } catch (err) {
    console.error('[ppl:update] Error Oracle:', err?.message || err);
    if (err?.code === 'PPL_SITUACION_INACTIVA') {
      return res.status(409).json({ code: err.code, message: err.message });
    }
    return res.status(500).json({ message: 'Error actualizando registro.' });
  }
});

async function warmupCondenadosIndex() {
  const version = Number(consolidado.getDataVersion?.() || 0);
  try {
    const tipo = 'all';
    const options = await personaRepo.listDistinctCondenadosFilterOptions({
      tipo,
      filters: {},
      maxPerField: 2000,
    });
    const payload = {
      ...options,
      meta: {
        tipo,
        cacheTtlMs: FILTER_OPTIONS_CACHE_TTL_MS,
      },
    };
    const cacheKey = `${version}|${tipo}|${JSON.stringify({
      departamento: '',
      municipio: '',
      defensor: '',
    })}`;
    boundedCacheSet(condenadosFilterOptionsCache, cacheKey, {
      createdAt: Date.now(),
      value: payload,
    });
  } catch (_e) {
    // Warmup best-effort: omite opciones de filtros si Oracle tarda o falla.
  }
}

router.warmupCondenadosIndex = warmupCondenadosIndex;
router.condenadosContract = Object.freeze({
  columns: [...CONDENADOS_COLUMNS],
  hasFilters: hasCondenadosFilters,
  mapRow: mapCondenadoRow,
  matchesFilters: matchesCondenadoFilters,
  parseFilters: getCondenadosFiltersFromQuery,
});

module.exports = router;
