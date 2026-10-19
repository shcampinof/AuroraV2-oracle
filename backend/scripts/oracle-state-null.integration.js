const assert = require('assert/strict');
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env'), quiet: true });

const db = require('../db/oraclePool');
const contract = require('../../shared/estado-caso-scenarios.v1.json');

// Ejecuta la expresión real del repositorio con datos sintéticos en SELECT dual.
// No inserta situaciones ni gestiones y no ejecuta actualizaciones.
async function captureStateExpression() {
  const repositoryPath = require.resolve('../repositories/oracle/personaRepository');
  const originalExecute = db.execute;
  let captured;
  db.execute = async (sql) => { captured = sql; return { rows: [] }; };
  delete require.cache[repositoryPath];
  try {
    await require(repositoryPath).listRowsWithActiveSituacionAndGestiones({ documento: '0' });
  } finally {
    db.execute = originalExecute;
    delete require.cache[repositoryPath];
  }
  const marker = ' AS G_FECHA_REGISTRO,';
  const start = captured.indexOf(marker);
  const end = captured.indexOf(' AS ESTADO_CODIGO', start);
  assert(start >= 0 && end > start, 'No se encontró el estado calculado del repositorio');
  return captured.slice(start + marker.length, end).trim();
}

const FIELD_COLUMNS = {
  'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'g.DEFENSOR_GESTION',
  'Fecha de análisis jurídico del caso': 'g.FECHA_ANALISIS',
  'Resumen del análisis del caso': 'g.RESUMEN_ANALISIS_CASO',
  'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO': 'g.RESUMEN_ANALISIS_CASO',
  'Procedencia de libertad condicional': 'g.LIBERTAD_CONDICIONAL',
  'Procedencia de prisión domiciliaria de mitad de pena': 'g.PRISION_DOMICILIARIA_MITAD_PENA',
  'Procedencia de utilidad pública (solo para mujeres)': 'g.UTILIDAD_PUBLICA',
  'Procedencia de pena cumplida': 'g.PROCEDENCIA_PENA_CUMPLIDA',
  'Procedencia de acumulación de penas': 'g.PROCEDENCIA_ACUMULACION_PENAS',
  'Otras solicitudes a tramitar': 'g.OTRAS_SOLICITUDES_TRAMITAR',
  'Fecha de entrevista': 'g.FECHA_ENTREVISTA',
  'Decisión del usuario': 'g.DECISION_USUARIO',
  'Actuación a adelantar': 'g.ACTUACION_ADELANTAR',
  'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS': 'g.ACTUACION_ADELANTAR',
  'Requiere pruebas': 'g.REQUIERE_PRUEBAS',
  'Poder en caso de avanzar con la solicitud': 'g.PODER_AVANZAR_SOLICITUD',
  'Fecha de entrevista psicosocial': 'g.FECHA_ENTREVISTA_PSICOSOCIAL',
  'Fecha en la que se reciben todas las pruebas': 'g.FECHA_RECEPCION_TODAS_PRUEBAS',
  'Cumple el requisito de marginalidad': 'g.CUMPLE_REQUISITO_MARGINALIDAD',
  'Cumple el requisito de jefatura de hogar': 'g.CUMPLE_REQUISITO_JEFATURA_HOGAR',
  'Fecha de radicación de solicitud de utilidad pública': 'g.FECHA_RADICACION_UTILIDAD',
  'Fecha de presentación de la solicitud a la autoridad': 'g.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD',
  'Fecha de decisión de la autoridad': 'g.FECHA_DECISION_AUTORIDAD',
  'Sentido de la decisión': 'g.SENTIDO_DECISION',
  'SENTIDO DE LA DECISIÓN': 'g.SENTIDO_DECISION',
  'Se presenta recurso': 'g.SE_PRESENTA_RECURSO',
  '¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?': 'g.SE_PRESENTA_RECURSO',
  'Fecha de recurso en caso desfavorable': 'g.FECHA_RECURSO_DESFAVORABLE',
  'Fecha de presentación del recurso': 'g.FECHA_PRESENTACION_RECURSO',
  'Fecha de la decisión del recurso': 'g.FECHA_DECISION_RECURSO',
  'Sentido de la decisión que resuelve la solicitud': 'g.SENTIDO_DECISION_RESUELVE_RECURSO',
  'Cierre del caso por imposibilidad de avanzar (si aplica)': 'g.CIERRE_CASO',
  'SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO': 'g.SENTIDO_DECISION_RESUELVE_RECURSO',
  'Cierre del caso por imposibilidad de avanzar (si aplica)': 'g.CIERRE_CASO',
  'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA': 'g.FECHA_SOLICITUD_AUDIENCIA_CONTROL',
  'FECHA DE REALIZACIÓN DE AUDIENCIA': 'g.FECHA_REALIZACION_AUDIENCIA',
};

function syntheticQuery(expression, scenario, emptyValue) {
  const values = {
    's.ACTIVO': 1,
    's.SITUACION': scenario.flow === 'celeste' ? 'Sindicado' : 'Condenado',
    's.SITUACION_JURIDICA_ACTUALIZADA': null,
  };
  Object.entries(scenario.answers).forEach(([field, value]) => {
    assert(FIELD_COLUMNS[field], `Falta mapear la pregunta ${field}`);
    values[FIELD_COLUMNS[field]] = value;
  });
  const binds = {};
  const sqlExpression = expression.replace(/\b([gsad])\.([A-Z_0-9]+)/g, (ref, alias, column) => {
    const key = `${alias}_${column}`;
    const isDate = column.startsWith('FECHA_');
    binds[key] = Object.hasOwn(values, ref) ? values[ref] : isDate || ref === 's.ACTIVO' ? null : emptyValue;
    if (isDate) return `TO_DATE(:${key}, 'YYYY-MM-DD')`;
    return `CAST(:${key} AS ${ref === 's.ACTIVO' ? 'NUMBER' : 'VARCHAR2(4000)'})`;
  });
  return { sql: `SELECT (${sqlExpression}) AS ESTADO_CODIGO FROM dual`, binds };
}

async function run() {
  const expression = await captureStateExpression();
  const emptyValues = [null, '', '   ', '\t\r\n', '\u00a0', '-', '--'];
  let checks = 0;
  const failures = [];
  try {
    for (const scenario of contract.scenarios) {
      for (const emptyValue of emptyValues) {
        const { sql, binds } = syntheticQuery(expression, scenario, emptyValue);
        const result = await db.execute(sql, binds, { operation: 'state-null.read-only' });
        checks += 1;
        const actual = result.rows[0].ESTADO_CODIGO;
        if (actual !== scenario.expectedCode) failures.push({ id: scenario.id, emptyValue, expected: scenario.expectedCode, actual });
      }
    }
    console.log(JSON.stringify({ readOnly: true, scenarios: contract.scenarios.length, checks, failures }, null, 2));
    assert.equal(failures.length, 0, 'Oracle debe coincidir con el contrato para todas las variantes de campos vacíos');
  } finally {
    await db.closePool();
  }
}

if (require.main === module) {
  if (String(process.env.RUN_ORACLE_INTEGRATION).toLowerCase() === 'true') {
    run().catch((error) => { console.error(error.message); process.exitCode = 1; });
  } else {
    console.log('SKIP oracle-state-null.integration (configure RUN_ORACLE_INTEGRATION=true)');
  }
}

module.exports = { captureStateExpression, syntheticQuery };
