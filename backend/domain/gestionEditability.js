const { normalizeComparisonText } = require('../utils/textNormalization');

function normalize(value) {
  return normalizeComparisonText(value).toLowerCase();
}

function filled(value) {
  return !['', '-', '--', 'null', 'undefined', 'seleccione', 'todos'].includes(normalize(value));
}

const PROCEDENCIAS = [
  'LIBERTAD_CONDICIONAL', 'PRISION_DOMICILIARIA_MITAD_PENA', 'UTILIDAD_PUBLICA',
  'PROCEDENCIA_PENA_CUMPLIDA', 'PROCEDENCIA_ACUMULACION_PENAS',
];
const BLOQUE_5_AURORA = [
  'FECHA_ENTREVISTA_PSICOSOCIAL', 'CUMPLE_REQUISITO_MARGINALIDAD',
  'CUMPLE_REQUISITO_JEFATURA_HOGAR', 'REQUIERE_MISION_TRABAJO',
  'FECHA_SOLICITUD_MISION_TRABAJO', 'FECHA_ASIGNACION_INVESTIGADOR',
  'FECHA_RECEPCION_TODAS_PRUEBAS', 'FECHA_RECEPCION_PRUEBAS_USUARIO',
  'FECHA_SOLICITUD_DOCS_INPEC', 'FECHA_RADICACION_UTILIDAD',
  'FECHA_PRESENTACION_SOLICITUD_AUTORIDAD', 'FECHA_DECISION_AUTORIDAD',
  'SENTIDO_DECISION', 'MOTIVO_DECISION_NEGATIVA', 'SE_PRESENTA_RECURSO',
  'FECHA_RECURSO_DESFAVORABLE', 'FECHA_PRESENTACION_RECURSO', 'FECHA_DECISION_RECURSO',
  'SENTIDO_DECISION_RESUELVE_RECURSO',
  ...Array.from({ length: 5 }, (_, i) => `FECHA_INSISTENCIA_${i + 1}`),
];
const BLOQUE_5_CELESTE = [
  'FECHA_SOLICITUD_AUDIENCIA_CONTROL', 'FECHA_REALIZACION_AUDIENCIA',
  'SENTIDO_DECISION', 'SE_PRESENTA_RECURSO', 'FECHA_RECURSO_DESFAVORABLE',
  'FECHA_PRESENTACION_RECURSO', 'FECHA_DECISION_RECURSO',
  'SENTIDO_DECISION_RESUELVE_RECURSO',
];

function otrasSolicitudes(value) {
  let values = value;
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try { values = JSON.parse(value); } catch { /* Formato histórico delimitado. */ }
  }
  return (Array.isArray(values) ? values : String(values ?? '').split(/\r?\n|[|;,]/))
    .map(normalize)
    .filter((item) => filled(item) && !(item.includes('opci') && (
      item.includes('mas de una') || item.includes('resumen')
    )));
}

// Recibe exclusivamente la gestión persistida, nunca el cuerpo de una edición.
// También acepta las filas del repositorio de persona, que usan el prefijo G_.
function hasReachedBlock5(row = {}, tipo = 'condenado') {
  const get = (column) => row[`G_${column}`] ?? row[column];
  if (!(Number(get('ID_GESTION')) > 0)) return false;

  const analysisComplete = ['FECHA_ANALISIS', 'RESUMEN_ANALISIS_CASO']
    .every((column) => filled(get(column)));
  if (!analysisComplete) return false;
  const actuacion = normalize(get('ACTUACION_ADELANTAR'));
  const decisionUtilidad = ['niega utilidad publica', 'otorga utilidad publica']
    .includes(normalize(get('SENTIDO_DECISION')));

  // Como en la visibilidad del formulario, los hitos históricos necesitan
  // análisis completo y una actuación identificable. Así no se habilitan
  // gestiones por respuestas residuales de campos ocultos del bloque 5.
  // Un estado calculado o INSISTENCIAS=0 tampoco demuestra avance.
  const block5Fields = tipo === 'sindicado' ? BLOQUE_5_CELESTE : BLOQUE_5_AURORA;
  const hasMilestone = block5Fields.some((column) => filled(get(column))) ||
    (tipo !== 'sindicado' && Number(get('INSISTENCIAS')) > 0);
  if (hasMilestone && (filled(actuacion) || (tipo !== 'sindicado' && decisionUtilidad))) return true;

  const defensor = get('DEFENSOR_GESTION');
  if (!filled(defensor)) return false;

  if (tipo === 'sindicado') {
    return filled(actuacion) && !actuacion.startsWith('no se avanzara') && filled(get('FECHA_ENTREVISTA'));
  }

  const solicitudes = otrasSolicitudes(get('OTRAS_SOLICITUDES_TRAMITAR'));
  const analysisAnswersComplete = PROCEDENCIAS
    .filter((column) => column !== 'UTILIDAD_PUBLICA')
    .every((column) => filled(get(column))) && solicitudes.length > 0;
  const positiveAnalysis = PROCEDENCIAS.some((column) =>
    normalize(get(column)).replace(/^\d+\s*[.)-]?\s*/, '').startsWith('si')
  ) || solicitudes.some((item) => item !== 'ninguna');
  const interviewComplete = ['FECHA_ENTREVISTA', 'DECISION_USUARIO', 'ACTUACION_ADELANTAR',
    'REQUIERE_PRUEBAS', 'PODER_AVANZAR_SOLICITUD'].every((column) => filled(get(column)));
  return analysisAnswersComplete && positiveAnalysis && interviewComplete &&
    normalize(get('DECISION_USUARIO')).startsWith('si') &&
    !actuacion.includes('ninguna') && !actuacion.includes('no procede nada');
}

module.exports = { hasReachedBlock5 };
