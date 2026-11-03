const assert = require('node:assert/strict');
const path = require('node:path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '../../.env'), quiet: true });
const { execute, closePool } = require('../db/oraclePool');
const { buildPrioridadGestionSelect } = require('../repositories/oracle/prioridadGestionSql');

if (process.env.RUN_ORACLE_INTEGRATION !== 'true') {
  console.log('SKIP oracle-prioridad-gestion.integration (configure RUN_ORACLE_INTEGRATION=true)');
  process.exit(0);
}

// Solo SELECT sobre DUAL: verifica las reglas reales de Oracle sin modificar datos.
const cases = [
  { name: 'asignación reciente', assignment: 0, expected: 'verde', days: 0 },
  { name: 'límite verde', assignment: 15, expected: 'verde', days: 15 },
  { name: 'inicio amarillo', assignment: 16, expected: 'amarillo', days: 16 },
  { name: 'límite amarillo', assignment: 45, expected: 'amarillo', days: 45 },
  { name: 'inicio rojo', assignment: 46, expected: 'rojo', days: 46 },
  { name: 'asignación antigua sin atención', assignment: 60, expected: 'rojo', days: 60 },
  { name: 'atención nueva con asignación antigua', assignment: 60, attention: 0, expected: 'verde', days: 0 },
  { name: 'editar una atención antigua conserva antigüedad', assignment: 90, attention: 60, expected: 'rojo', days: 60 },
  { name: 'reasignación reciente', assignment: 2, attention: 60, expected: 'verde', days: 2 },
  { name: 'análisis reciente', state: 'ENTREVISTAR_USUARIO', assignment: 90, attention: 60, analysis: 5, expected: 'verde', days: 5 },
  { name: 'entrevista reciente', state: 'PRESENTAR_SOLICITUD', assignment: 90, attention: 60, interview: 16, expected: 'amarillo', days: 16 },
  { name: 'solo fecha del avance', state: 'PRESENTAR_SOLICITUD', interview: 5, expected: 'verde', days: 5 },
  { name: 'sin fechas', expected: 'sin_fecha', days: null },
  { name: 'sin defensor', state: 'SIN_ASIGNACION', assignment: 90, expected: 'gris', days: null },
  { name: 'cerrado', state: 'CASO_CERRADO', assignment: 90, expected: 'gris', days: null },
  { name: 'audiencia', state: 'PENDIENTE_AUDIENCIA', assignment: 90, expected: 'azul', days: null },
  { name: 'decisión de audiencia', state: 'PENDIENTE_DECISION_AUDIENCIA', expected: 'azul', days: null },
  { name: 'decisión', state: 'PENDIENTE_DECISION', expected: 'azul', days: null },
  { name: 'recurso', state: 'PRESENTAR_RECURSO', expected: 'rojo', days: null },
  { name: 'fecha futura sin antigüedad negativa', assignment: -1, expected: 'verde', days: 0 },
];

async function run() {
  const today = "TRUNC(CAST(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota' AS DATE))";
  const date = (days) => days == null ? 'CAST(NULL AS DATE)' : `${today} - ${Number(days)}`;
  for (const scenario of cases) {
    const base = `SELECT :state AS ESTADO_CODIGO,
      ${date(scenario.assignment)} AS "Fecha de asignacion del PAG",
      ${date(scenario.attention)} AS FECHA_INICIO_ATENCION,
      ${date(scenario.analysis)} AS "Fecha de analisis juridico del caso",
      ${date(scenario.interview)} AS "Fecha de entrevista"
      FROM dual`;
    const { rows } = await execute(buildPrioridadGestionSelect(base), { state: scenario.state || 'ANALIZAR_CASO' });
    assert.equal(rows[0].PRIORIDAD_GESTION, scenario.expected, scenario.name);
    assert.equal(rows[0].DIAS_PRIORIDAD_GESTION, scenario.days, scenario.name);
  }
  console.log(`OK oracle-prioridad-gestion.integration: ${cases.length} escenarios`);
}

run().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(closePool);
