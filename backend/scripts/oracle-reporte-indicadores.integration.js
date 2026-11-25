const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env'), quiet: true });
const db = require('../db/oraclePool');
const repo = require('../repositories/oracle/reporteAtencionesRepository');
const { buildReport } = require('../services/reporteAtencionesService');
const { fixture } = require('./oracle-reporte-gestion.integration');

const base = {
  DEFENSOR_GESTION: 'DEFENSOR PRUEBA', FECHA_ANALISIS: '2026-11-01 00:00:00',
  LIBERTAD_CONDICIONAL: 'Si procede solicitud de libertad condicional',
  PRISION_DOMICILIARIA_MITAD_PENA: 'No', PROCEDENCIA_PENA_CUMPLIDA: 'No',
  PROCEDENCIA_ACUMULACION_PENAS: 'No', OTRAS_SOLICITUDES_TRAMITAR: 'Ninguna',
  RESUMEN_ANALISIS_CASO: 'Análisis completo',
};
const interview = {
  FECHA_ENTREVISTA: '2026-11-02 00:00:00', DECISION_USUARIO: 'Si',
  ACTUACION_ADELANTAR: 'Libertad condicional', REQUIERE_PRUEBAS: 'No', PODER_AVANZAR_SOLICITUD: 'Si',
};
const request = { ...interview, FECHA_PRESENTACION_SOLICITUD_AUTORIDAD: '2026-11-03 00:00:00' };
const unfavorable = { ...request, FECHA_DECISION_AUTORIDAD: '2026-11-04 00:00:00', SENTIDO_DECISION: 'No concede la solicitud' };

async function testRules() {
  const cases = [
    [{ RESUMEN_ANALISIS_CASO: null }, []],
    [{ LIBERTAD_CONDICIONAL: 'No' }, ['analisis', 'cierre']],
    [interview, ['analisis', 'entrevista']],
    [{ FECHA_ENTREVISTA: '2026-11-02 00:00:00', DECISION_USUARIO: 'No desea tramitar la solicitud' }, ['analisis', 'entrevista', 'cierre']],
    [{ ...request, FECHA_SOLICITUD_AUDIENCIA_CONTROL: '2026-11-02 00:00:00', FECHA_RADICACION_UTILIDAD: '2026-11-04 00:00:00' }, ['analisis', 'entrevista', 'solicitud']],
    [{ ...interview, FECHA_RADICACION_UTILIDAD: '2026-11-03 00:00:00' }, ['analisis', 'entrevista', 'solicitud']],
    [{ ...request, FECHA_DECISION_AUTORIDAD: '2026-11-04 00:00:00', SENTIDO_DECISION: 'Concede la solicitud' }, ['analisis', 'entrevista', 'solicitud', 'cierre']],
    [{ ...unfavorable, SE_PRESENTA_RECURSO: 'Si' }, ['analisis', 'entrevista', 'solicitud', 'cierre']],
    [{ ...unfavorable, SE_PRESENTA_RECURSO: 'Sí', FECHA_PRESENTACION_RECURSO: '2026-11-05 00:00:00' }, ['analisis', 'entrevista', 'solicitud', 'recurso']],
    [{ ...unfavorable, SE_PRESENTA_RECURSO: 'Si', FECHA_PRESENTACION_RECURSO: '2026-11-05 00:00:00', SENTIDO_DECISION_RESUELVE_RECURSO: 'Confirma', FECHA_DECISION_RECURSO: '2026-11-06 00:00:00' }, ['analisis', 'entrevista', 'solicitud', 'recurso', 'cierre']],
    [{ ...unfavorable, SE_PRESENTA_RECURSO: 'No' }, ['analisis', 'entrevista', 'solicitud', 'cierre']],
    [{ RESUMEN_ANALISIS_CASO: null, CIERRE_CASO: 'Otro motivo.', FECHA_REGISTRO: '2026-11-07 00:00:00' }, ['cierre']],
    [{ RESUMEN_ANALISIS_CASO: ' \u00a0--  ' }, []],
    [{ RESUMEN_ANALISIS_CASO: null, FECHA_INSISTENCIA_1: '2026-11-01 00:00:00', FECHA_INSISTENCIA_2: '2026-11-01 00:00:00', FECHA_INSISTENCIA_3: '2026-11-02 00:00:00', FECHA_INSISTENCIA_4: '2026-11-03 00:00:00', FECHA_INSISTENCIA_5: '2026-11-04 00:00:00' }, Array(5).fill('reiteracion')],
    [{ ...request, RESUMEN_ANALISIS_CASO: null }, []],
    [{ ...base, FECHA_ANALISIS: '2026-11-09 23:59:59' }, ['analisis']],
    [{ ...base, FECHA_ANALISIS: '2026-11-10 00:00:00' }, []],
    [{ ...base, FECHA_ANALISIS: '2026-10-31 23:59:59' }, []],
    [{ ...request, FECHA_PRESENTACION_SOLICITUD_AUTORIDAD: '2026-11-10 00:00:00' }, ['analisis', 'entrevista']],
    [{ ...request, FECHA_DECISION_AUTORIDAD: '2026-11-04 00:00:00', SENTIDO_DECISION: 'Otorga utilidad pública' }, ['analisis', 'entrevista', 'solicitud', 'cierre']],
    [{ ...unfavorable, SENTIDO_DECISION: 'Niega utilidad pública', SE_PRESENTA_RECURSO: 'S?', FECHA_PRESENTACION_RECURSO: '2026-11-05 00:00:00' }, ['analisis', 'entrevista', 'solicitud', 'recurso']],
    [{ FECHA_ENTREVISTA: '2026-11-02 00:00:00' }, ['analisis']],
    [{ ...request, SE_PRESENTA_RECURSO: 'Si', FECHA_PRESENTACION_RECURSO: '2026-11-05 00:00:00' }, ['analisis', 'entrevista', 'solicitud']],
    [{ LIBERTAD_CONDICIONAL: 'No', FECHA_ANALISIS: '2026-10-31 00:00:00' }, []],
    [{ LIBERTAD_CONDICIONAL: 'No', FECHA_ANALISIS: '2026-11-10 00:00:00' }, []],
    [{ LIBERTAD_CONDICIONAL: 'No' }, ['analisis', 'cierre']],
    [{ RESUMEN_ANALISIS_CASO: null, CIERRE_CASO: 'Otro motivo.', ID_ASIGNACION_GESTION: 270 }, ['cierre']],
    [{ RESUMEN_ANALISIS_CASO: null, CIERRE_CASO: 'Otro motivo.', DEFENSOR_GESTION: 'OTRO DEFENSOR' }, []],
    [{ LIBERTAD_CONDICIONAL: 'No', FECHA_ANALISIS: '2026-10-31 00:00:00' }, []],
  ];
  const sql = repo.buildEventsSql();
  const derived = /^(T_|ACTUACION_N$|DECISION_N$|RECURSO_N$|USUARIO_N$|OTRAS_N$|ES_UTILIDAD$|CIERRE_EXPLICITO$|DECISION_NEGATIVA$|CERRADA$)/;
  const columns = (alias) => [...new Set([...sql.matchAll(new RegExp(`\\b${alias}\\.([A-Z][A-Z_0-9]+)`, 'gi'))].map(m => m[1].toUpperCase()))].filter(c => !derived.test(c));
  const gestiones = cases.map(([overrides], i) => ({ ...base, ...overrides, ID_GESTION: i + 1, ID_SITUACION: i + 1 }));
  const personId = (gestion) => [26, 29].includes(gestion.ID_GESTION) ? 2 : gestion.ID_SITUACION;
  const ctes = [
    fixture('gestion_fixture', columns('(?:g|t)'), gestiones),
    fixture('situacion_fixture', [...new Set([...columns('s'), 'ID_PERSONA'])], gestiones.map(g => ({ ID_SITUACION: g.ID_SITUACION, ID_PERSONA: personId(g), SITUACION: 'Condenado' }))),
    fixture('persona_fixture', columns('p'), [...new Set(gestiones.map(personId))].map(id => ({ ID_PERSONA: id, NOMBRE: 'Usuario de prueba', NUMERO: String(id) }))),
    fixture('asignacion_fixture', ['ID_PERSONA', 'ID_ASIGNACION', 'CEDULA_DEFENSOR', 'NOMBRE_DEFENSOR', 'FECHA_ASIGNACION', 'FECHA_FIN'], [
      { ID_PERSONA: 27, ID_ASIGNACION: 270, CEDULA_DEFENSOR: '1', NOMBRE_DEFENSOR: 'DEFENSOR PRUEBA', FECHA_ASIGNACION: '2026-01-01 00:00:00', FECHA_FIN: '2026-11-04 00:00:00' },
      { ID_PERSONA: 27, ID_ASIGNACION: 271, CEDULA_DEFENSOR: '2', NOMBRE_DEFENSOR: 'OTRO DEFENSOR', FECHA_ASIGNACION: '2026-11-05 00:00:00' },
    ]),
    fixture('defensor_fixture', ['CEDULA', 'NOMBRE'], [{ CEDULA: '1', NOMBRE: 'DEFENSOR PRUEBA' }]),
  ];
  function withFixtures(source) {
    let query = source.replace(/WITH /, `WITH ${ctes.join(',\n')},\n`);
    for (const [table, name] of [['GESTION_JURIDICA', 'gestion'], ['SITUACION_CARCELARIA', 'situacion'], ['PERSONA', 'persona'], ['ASIGNACION', 'asignacion'], ['DEFENSORES', 'defensor']]) query = query.replaceAll(`DNDP.${table}`, `${name}_fixture`);
    return query;
  }
  const query = withFixtures(sql);
  const rows = (await db.execute(query, { fechaInicio: '2026-11-01', fechaFin: '2026-11-09', defensorCedula: '1', defensorNombre: 'DEFENSOR PRUEBA' })).rows;
  cases.forEach(([, expected], i) => assert.deepEqual(rows.filter(r => r.ID_GESTION === i + 1).map(r => r.TIPO).sort(), [...expected].sort(), `Regla ${i + 1}`));
  assert.equal(rows.find(r => r.ID_GESTION === 10 && r.TIPO === 'cierre').FECHA, '2026-11-06');
  assert.equal(rows.find(r => r.ID_GESTION === 5 && r.TIPO === 'solicitud').FECHA, '2026-11-03');
  assert.equal(rows.find(r => r.ID_GESTION === 2 && r.TIPO === 'cierre').FECHA, '2026-11-01');
  const totalBinds = { defensorCedula: '1', defensorNombre: 'DEFENSOR PRUEBA' };
  assert.equal(new Set(rows.filter(r => r.TIPO === 'cierre').map(r => r.ID_PERSONA)).size, 9);
  const allRows = (await db.execute(query, { ...totalBinds, fechaInicio: '2026-01-01', fechaFin: '2026-12-31' })).rows;
  assert.equal(new Set(allRows.filter(r => r.TIPO === 'cierre').map(r => r.ID_PERSONA)).size, 11);
  assert(!allRows.some(r => r.ID_GESTION === 28), 'los cierres de otro defensor no entran en el total');
  const emptyRows = (await db.execute(query, { ...totalBinds, fechaInicio: '2027-01-01', fechaFin: '2027-01-31' })).rows;
  assert.equal(emptyRows.length, 0);
  console.log(`OK Oracle: ${cases.length} escenarios de indicadores, fechas y requisitos; solo SELECT.`);
}

async function compareReference(params) {
  const reference = fs.readFileSync(path.join(__dirname, 'fixtures', 'reporte-atenciones-referencia.sql'), 'utf8');
  const binds = { ...params, lugar: params.lugar || null, incluirFueraPrision: params.incluirFueraPrision ? 1 : 0 };
  const expected = (await db.execute(reference, binds)).rows[0];
  const eventRows = await repo.listEvents(params);
  const assignedRows = await repo.listAssignedCases(params);
  const actual = buildReport({ eventRows, assignedRows }).resumen;
  const mapping = { CASOS_ANALIZADOS: 'casosAnalizados', ENTREVISTAS_REALIZADAS: 'entrevistasRealizadas', SOLICITUDES_PRESENTADAS: 'solicitudesPresentadas', REITERACIONES_PRESENTADAS: 'reiteracionesPresentadas', RECURSOS_PRESENTADOS: 'recursosPresentados', CASOS_CERRADOS: 'casosCerrados', TOTAL_ACTUACIONES: 'totalActuaciones', PERSONAS_ASIGNADAS: 'personasAsignadas' };
  for (const [sqlKey, field] of Object.entries(mapping)) assert.equal(actual[field], expected[sqlKey], `${field}: ${params.tipo}, ${params.fechaInicio} a ${params.fechaFin}`);
  return { tipo: params.tipo, periodo: [params.fechaInicio, params.fechaFin], indicadores: expected, coincide: true };
}

async function run() { await testRules(); }
if (require.main === module) {
  if (process.env.RUN_ORACLE_INTEGRATION !== 'true') console.log('Omitido: habilite RUN_ORACLE_INTEGRATION=true.');
  else run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.closePool());
}
module.exports = { testRules, compareReference };
