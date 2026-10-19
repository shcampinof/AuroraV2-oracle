const assert = require('assert/strict');
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env'), quiet: true });
const db = require('../db/oraclePool');
const { buildEventsSql } = require('../repositories/oracle/reporteAtencionesRepository');

// Solo SELECT con fixtures en CTE: no inserta ni modifica expedientes.
function literal(value, column) {
  if (value == null) return `CAST(NULL AS ${column.startsWith('FECHA') ? 'DATE' : column.startsWith('ID_') || column === 'ACTIVO' ? 'NUMBER' : 'VARCHAR2(4000)'})`;
  if (typeof value === 'number') return String(value);
  if (column.startsWith('FECHA')) return `TO_DATE('${value}', 'YYYY-MM-DD HH24:MI:SS')`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

function fixture(name, columns, rows) {
  return `${name} AS (${rows.map((row) => `SELECT ${columns.map((col) => `${literal(row[col], col)} AS ${col}`).join(', ')} FROM dual`).join('\nUNION ALL\n')})`;
}

async function run() {
  const gestiones = [
    // Autor explícito anterior al alta técnica; no se pierde tras reasignar.
    { ID_GESTION: 10, ID_SITUACION: 1, DEFENSOR_GESTION: 'Defensor Á', FECHA_ANALISIS: '2025-01-01 00:00:00' },
    // Importación sin autor antes de la primera asignación, ya finalizada.
    { ID_GESTION: 20, ID_SITUACION: 2, FECHA_ANALISIS: '2025-01-02 00:00:00' },
    // Sin autor: dos hitos a ambos lados de una reasignación.
    { ID_GESTION: 30, ID_SITUACION: 3, FECHA_ANALISIS: '2026-06-01 00:00:00', FECHA_ENTREVISTA: '2026-06-20 00:00:00' },
    // Sin hora del hito: las reasignaciones del mismo día deben dar un solo autor.
    { ID_GESTION: 40, ID_SITUACION: 4, FECHA_ANALISIS: '2026-06-15 00:00:00' },
    // Un defensor puede conservar actuaciones sin ninguna asignación vigente/histórica.
    { ID_GESTION: 50, ID_SITUACION: 5, DEFENSOR_GESTION: 'DEFENSOR A', FECHA_ANALISIS: '2026-01-01 00:00:00' },
    { ID_GESTION: 60, ID_SITUACION: 6, FECHA_ANALISIS: '2026-01-01 00:00:00' },
    { ID_GESTION: 70, ID_SITUACION: 7, DEFENSOR_GESTION: ' -- ', FECHA_ANALISIS: '2026-01-01 00:00:00' },
    // Dos solicitudes y dos insistencias en un día son cuatro actuaciones.
    { ID_GESTION: 80, ID_SITUACION: 8, DEFENSOR_GESTION: 'DEFENSOR A', FECHA_PRESENTACION_SOLICITUD_AUTORIDAD: '2026-01-01 00:00:00', FECHA_RADICACION_UTILIDAD: '2026-01-01 00:00:00', FECHA_INSISTENCIA_1: '2026-01-01 00:00:00', FECHA_INSISTENCIA_2: '2026-01-01 00:00:00' },
    // Texto de acción obsoleto: no basta para declarar cierre jurídico.
    { ID_GESTION: 90, ID_SITUACION: 9, DEFENSOR_GESTION: 'DEFENSOR A', ACCION_REALIZAR: 'Caso cerrado', CIERRE_CASO: ' -- ', FECHA_ANALISIS: '2026-01-01 00:00:00' },
    // Cierre por reglas del flujo, aunque no haya texto de cierre.
    { ID_GESTION: 100, ID_SITUACION: 10, DEFENSOR_GESTION: 'DEFENSOR A', SENTIDO_DECISION_RESUELVE_RECURSO: 'Confirma', FECHA_DECISION_RECURSO: '2026-01-02 00:00:00' },
    // Una situación inactiva no acredita por sí sola un cierre fechado.
    { ID_GESTION: 110, ID_SITUACION: 11, DEFENSOR_GESTION: 'DEFENSOR A', FECHA_ANALISIS: '2026-01-01 00:00:00' },
    { ID_GESTION: 120, ID_SITUACION: 12, DEFENSOR_GESTION: 'HOMONIMO', FECHA_ANALISIS: '2026-01-01 00:00:00' },
    // El autor guardado manda incluso cuando la fecha cae en la asignación de otro.
    { ID_GESTION: 130, ID_SITUACION: 3, DEFENSOR_GESTION: 'DEFENSOR B', FECHA_ANALISIS: '2025-01-03 00:00:00' },
    // Fechas fuera del periodo.
    { ID_GESTION: 140, ID_SITUACION: 5, DEFENSOR_GESTION: 'DEFENSOR A', FECHA_ANALISIS: '2024-12-31 23:59:59' },
    { ID_GESTION: 150, ID_SITUACION: 5, DEFENSOR_GESTION: 'DEFENSOR A', FECHA_ANALISIS: '2026-10-20 00:00:00' },
    { ID_GESTION: 160, ID_SITUACION: 5, DEFENSOR_GESTION: 'DEFENSOR A', FECHA_ANALISIS: '2026-10-19 23:59:59' },
    // La reasignación de una gestión abierta sustituyó su responsable. El
    // análisis anterior pertenece a A y la entrevista posterior pertenece a B.
    { ID_GESTION: 170, ID_SITUACION: 3, DEFENSOR_GESTION: 'DEFENSOR B', FECHA_REGISTRO: '2026-01-01 00:00:00', FECHA_ANALISIS: '2025-01-03 00:00:00', FECHA_ENTREVISTA: '2026-06-20 00:00:00' },
    // Una gestión nueva de B sí conserva su autor aun con un hito retroactivo.
    { ID_GESTION: 180, ID_SITUACION: 3, DEFENSOR_GESTION: 'DEFENSOR B', FECHA_REGISTRO: '2026-06-16 00:00:00', FECHA_ANALISIS: '2025-01-03 00:00:00' },
    // Volver a A no transfiere las actuaciones realizadas mientras estuvo B.
    { ID_GESTION: 190, ID_SITUACION: 13, DEFENSOR_GESTION: 'DEFENSOR A', FECHA_REGISTRO: '2026-01-01 00:00:00', FECHA_ANALISIS: '2026-06-20 00:00:00', FECHA_ENTREVISTA: '2026-07-02 00:00:00' },
  ];
  const personas = Array.from({ length: 13 }, (_, i) => ({ ID_PERSONA: i + 1, NOMBRE: `PERSONA ${i + 1}`, NUMERO: String(i + 1) }));
  const situaciones = personas.map((p) => ({ ID_SITUACION: p.ID_PERSONA, ID_PERSONA: p.ID_PERSONA, ACTIVO: p.ID_PERSONA === 11 ? 0 : 1, SITUACION: 'Condenado', ESTABLECIMIENTO: 'CENTRO PRUEBA' }));
  const asignaciones = [];
  function assignment(persona, id, defensor, inicio, fin = null) {
    asignaciones.push({ ID_PERSONA: persona, ID_ASIGNACION: id, NOMBRE_DEFENSOR: `DEFENSOR ${defensor}`, CEDULA_DEFENSOR: { A: '1', B: '2', C: '3' }[defensor], FECHA_ASIGNACION: inicio, FECHA_FIN: fin });
  }
  for (const id of [1, 2, 3, 4]) {
    assignment(id, id * 10, 'A', '2026-01-01 00:00:00', '2026-06-15 10:00:00');
    assignment(id, id * 10 + 1, 'B', '2026-06-15 10:00:00');
  }
  asignaciones.find((a) => a.ID_ASIGNACION === 41).FECHA_FIN = '2026-06-15 15:00:00';
  assignment(4, 42, 'C', '2026-06-15 15:00:00');
  assignment(7, 70, 'A', '2026-01-01 00:00:00');
  assignment(13, 130, 'A', '2026-01-01 00:00:00', '2026-06-15 10:00:00');
  assignment(13, 131, 'B', '2026-06-15 10:00:00', '2026-07-01 10:00:00');
  assignment(13, 132, 'A', '2026-07-01 10:00:00');
  const defensores = [{ CEDULA: '1', NOMBRE: 'DEFENSOR A' }, { CEDULA: '2', NOMBRE: 'DEFENSOR B' }, { CEDULA: '3', NOMBRE: 'DEFENSOR C' }, { CEDULA: '10', NOMBRE: 'HOMONIMO' }, { CEDULA: '11', NOMBRE: 'HOMONIMO' }];
  const sql = buildEventsSql({ tipo: 'condenado', lugar: 'CENTRO PRUEBA' });
  const columns = (alias) => [...new Set([...sql.matchAll(new RegExp(`\\b${alias}\\.([A-Z][A-Z_0-9]+)`, 'g'))].map((match) => match[1]))];
  const ctes = [
    fixture('gestion_fixture', columns('g'), gestiones),
    fixture('situacion_fixture', columns('s'), situaciones),
    fixture('persona_fixture', columns('p'), personas),
    fixture('asignacion_fixture', ['ID_PERSONA', 'ID_ASIGNACION', 'NOMBRE_DEFENSOR', 'CEDULA_DEFENSOR', 'FECHA_ASIGNACION', 'FECHA_FIN'], asignaciones),
    fixture('defensor_fixture', ['CEDULA', 'NOMBRE'], defensores),
  ];
  const syntheticSql = sql.replace(/WITH /, `WITH ${ctes.join(',\n')},\n`)
    .replaceAll('DNDP.GESTION_JURIDICA', 'gestion_fixture')
    .replaceAll('DNDP.SITUACION_CARCELARIA', 'situacion_fixture')
    .replaceAll('DNDP.PERSONA', 'persona_fixture')
    .replaceAll('DNDP.ASIGNACION', 'asignacion_fixture')
    .replaceAll('DNDP.DEFENSORES', 'defensor_fixture');
  const params = { fechaInicio: '2025-01-01', fechaFin: '2026-10-19', tipo: '%CONDENAD%', lugar: 'CENTRO PRUEBA' };
  const results = {};
  for (const [cedula, nombre] of [['1', 'DEFENSOR A'], ['2', 'DEFENSOR B'], ['3', 'DEFENSOR C'], ['10', 'HOMONIMO'], ['11', 'HOMONIMO']]) {
    results[cedula] = (await db.execute(syntheticSql, { ...params, defensorCedula: cedula, defensorNombre: nombre })).rows;
  }
  const keys = (rows) => rows.map((r) => `${r.ID_GESTION}:${r.TIPO}`).sort();
  assert.deepEqual(keys(results['1']), ['10:analisis', '100:cierre', '110:analisis', '160:analisis', '170:analisis', '190:entrevista', '20:analisis', '30:analisis', '50:analisis', '70:analisis', '80:reiteracion', '80:reiteracion', '80:solicitud', '80:solicitud', '90:analisis'].sort());
  assert.deepEqual(keys(results['2']), ['130:analisis', '170:entrevista', '180:analisis', '190:analisis', '30:entrevista'].sort());
  assert.deepEqual(keys(results['3']), ['40:analisis']);
  assert.deepEqual(results['10'], []);
  assert.deepEqual(results['11'], []);
  assert.equal(results['1'].find((r) => r.ID_GESTION === 10).FUENTE_AUTOR, 'DEFENSOR_GESTION');
  assert.equal(results['1'].find((r) => r.ID_GESTION === 20).FUENTE_AUTOR, 'ASIGNACION_HISTORICA');
  assert.equal(results['1'].find((r) => r.ID_GESTION === 170).FUENTE_AUTOR, 'ASIGNACION_HISTORICA');
  assert.equal(results['2'].find((r) => r.ID_GESTION === 180).FUENTE_AUTOR, 'DEFENSOR_GESTION');
  const uniqueEvents = new Set(Object.values(results).flat().map((r) => `${r.ID_GESTION}:${r.ORIGEN}`));
  assert.equal(uniqueEvents.size, Object.values(results).flat().length, 'ningún evento se acredita a dos defensores');
  console.log('OK Oracle: autor histórico, importación, reasignación, mismo día, solicitudes independientes, cierres derivados, inactividad y límites de fecha (solo SELECT).');
}

if (require.main === module) {
  if (process.env.RUN_ORACLE_INTEGRATION !== 'true') {
    console.log('Omitido: habilite RUN_ORACLE_INTEGRATION=true para ejecutar SELECT en Oracle.');
  } else {
    run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.closePool());
  }
}
module.exports = { run };
