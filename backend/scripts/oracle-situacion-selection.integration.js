const assert = require('node:assert/strict');
const path = require('node:path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env'), quiet: true });
const db = require('../db/oraclePool');
const { getOracleSchema } = require('../config/oracle');
const { buildStrictActiveSituacionCte } = require('../repositories/oracle/sqlFragments');

const DOCUMENTO = '9000000001';
const TABLES = ['PERSONA', 'SITUACION_CARCELARIA', 'GESTION_JURIDICA', 'ASIGNACION', 'DEFENSORES', 'CALIFICACION_CONDUCTA'];
const inactive = {
  ID_PERSONA: 8662, ID_SITUACION: 708489, ACTIVO: 0,
  ESTABLECIMIENTO: 'CPMS IPIALES', DEPARTAMENTO: 'NARIÑO', MUNICIPIO: 'IPIALES',
  SITUACION: 'Condenado', FUENTE: 'SISIPEC', PROCESO: 'PROCESO-123',
  FECHA_CORTE: null, FECHA_REGISTRO: '2026-09-07 19:19:59', FECHA_CAPTURA: null,
};
const active = {
  ...inactive, ID_SITUACION: 724017, ACTIVO: 1,
  ESTABLECIMIENTO: 'CPAMS POPAYAN (ERE)', DEPARTAMENTO: 'CAUCA', MUNICIPIO: 'POPAYAN',
  FECHA_CORTE: '2026-09-07 00:00:00', FECHA_REGISTRO: '2026-09-16 09:36:39',
  FECHA_CAPTURA: '2026-02-18 00:00:00',
};
const historicalGestion = {
  ID_GESTION: 34581, ID_SITUACION: inactive.ID_SITUACION,
  DEFENSOR_GESTION: 'DEFENSOR DIAGNOSTICO', FECHA_ANALISIS: '2026-02-19 00:00:00',
  LIBERTAD_CONDICIONAL: 'No aplica porque ya se concedió libertad condicional',
  PRISION_DOMICILIARIA_MITAD_PENA: 'No aplica porque ya se concedió libertad condicional',
  PROCEDENCIA_PENA_CUMPLIDA: 'No', PROCEDENCIA_ACUMULACION_PENAS: 'No',
  RESUMEN_ANALISIS_CASO: 'Resumen histórico de prueba',
};
function dataset(situations, gestiones = [historicalGestion]) {
  return {
    PERSONA: [{ ID_PERSONA: 8662, NUMERO: DOCUMENTO, NOMBRE: 'USUARIO DE PRUEBA', GENERO: 'Masculino' }],
    SITUACION_CARCELARIA: situations,
    GESTION_JURIDICA: gestiones,
    ASIGNACION: [{ ID_ASIGNACION: 1, ID_PERSONA: 8662, NOMBRE_DEFENSOR: 'DEFENSOR DIAGNOSTICO', FECHA_ASIGNACION: '2026-02-19 00:00:00' }],
    DEFENSORES: [], CALIFICACION_CONDUCTA: [],
  };
}
function fixtureType(column) {
  if (/^(NUMBER|FLOAT)/.test(column.DATA_TYPE)) return 'NUMBER';
  if (column.DATA_TYPE === 'DATE' || column.DATA_TYPE.startsWith('TIMESTAMP')) return column.DATA_TYPE;
  if (/^(NCHAR|NVARCHAR)/.test(column.DATA_TYPE)) return 'NVARCHAR2(2000)';
  return 'VARCHAR2(4000)';
}
function fixtures(metadata, data) {
  const binds = {};
  let index = 0;
  const ctes = TABLES.map(table => {
    const rows = data[table];
    const selects = (rows.length ? rows : [{}]).map(row => 'SELECT ' + metadata.get(table).map(column => {
      const type = fixtureType(column), value = row[column.COLUMN_NAME];
      let expression = `CAST(NULL AS ${type})`;
      if (value != null) {
        const key = `fixture_${index++}`;
        binds[key] = value;
        expression = type === 'DATE' ? `TO_DATE(:${key}, 'YYYY-MM-DD HH24:MI:SS')`
          : type.startsWith('TIMESTAMP') ? `CAST(TO_TIMESTAMP(:${key}, 'YYYY-MM-DD HH24:MI:SS') AS ${type})`
            : `CAST(:${key} AS ${type})`;
      }
      return `${expression} AS ${column.COLUMN_NAME}`;
    }).join(', ') + ' FROM dual' + (rows.length ? '' : ' WHERE 1=0'));
    return `fixture_${table} AS (${selects.join('\nUNION ALL\n')})`;
  });
  return { ctes, binds };
}

// Solo SELECT con fixtures en CTE; no modifica expedientes ni ejecuta cargues.
async function run() {
  const originalExecute = db.execute;
  let server;
  let data;
  const results = [], httpResults = [];
  try {
    const rows = (await originalExecute(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS
      WHERE OWNER = :owner AND TABLE_NAME IN (${TABLES.map(t => `'${t}'`).join(',')})
      ORDER BY TABLE_NAME, COLUMN_ID`, { owner: getOracleSchema() })).rows;
    const metadata = new Map(TABLES.map(table => [table, rows.filter(r => r.TABLE_NAME === table)]));
    for (const table of TABLES) assert(metadata.get(table).length, `Falta estructura de ${table}`);
    db.execute = async (sql, binds = {}, options = {}) => {
      assert(/^\s*(WITH|SELECT)\b/i.test(sql), 'Solo se permiten consultas SELECT');
      assert.notEqual(options.autoCommit, true);
      const fixture = fixtures(metadata, data);
      let query = sql;
      for (const table of TABLES) query = query.replaceAll(`DNDP.${table}`, `fixture_${table}`);
      query = query.replace(/^\s*WITH\s+/i, `WITH ${fixture.ctes.join(',\n')},\n`);
      assert(!/\bDNDP\./.test(query), 'Las consultas de prueba no deben leer tablas de expedientes');
      return originalExecute(query, { ...binds, ...fixture.binds }, { ...options, autoCommit: false });
    };
    // Cargar después de interceptar execute para ejecutar el SQL real contra las CTE.
    const service = require('../services/pplService');
    const repo = require('../repositories/oracle/personaRepository');
    const scenarios = [
      ['histórica con hora posterior al corte diario', dataset([inactive, active]), 724017, 'ANALIZAR_CASO'],
      ['sin respuestas del formulario', dataset([inactive, active], []), 724017, 'ANALIZAR_CASO'],
      ['solo situación activa', dataset([active], []), 724017, 'ANALIZAR_CASO'],
      ['mismo corte en ambas situaciones', dataset([{ ...inactive, FECHA_CORTE: active.FECHA_CORTE }, active]), 724017, 'ANALIZAR_CASO'],
      ['corte activo de un día posterior', dataset([inactive, { ...active, FECHA_CORTE: '2026-09-08 00:00:00' }]), 724017, 'ANALIZAR_CASO'],
      ['corte activo con hora 23:59', dataset([inactive, { ...active, FECHA_CORTE: '2026-09-07 23:59:59' }]), 724017, 'ANALIZAR_CASO'],
      ['situación inactiva de un día posterior', dataset([{ ...inactive, FECHA_CORTE: '2026-09-20 00:00:00' }, active]), 708489, 'CASO_CERRADO'],
      ['inactivación posterior sin fecha de corte', dataset([{ ...inactive, FECHA_REGISTRO: '2026-09-20 23:59:59' }, active]), 708489, 'CASO_CERRADO'],
      ['solo situación inactiva', dataset([inactive]), 708489, 'CASO_CERRADO'],
      ['sin cortes, ordenar por día de registro', dataset([inactive, { ...active, FECHA_CORTE: null }]), 724017, 'ANALIZAR_CASO'],
      ['sin corte ni registro, usar captura', dataset([{ ...inactive, FECHA_REGISTRO: null, FECHA_CAPTURA: '2026-09-06 19:00:00' }, { ...active, FECHA_CORTE: null, FECHA_REGISTRO: null, FECHA_CAPTURA: '2026-09-07 00:00:00' }]), 724017, 'ANALIZAR_CASO'],
      ['cierre jurídico de una situación activa se conserva', dataset([inactive, active], [{ ID_GESTION: 34582, ID_SITUACION: 724017, DEFENSOR_GESTION: 'DEFENSOR DIAGNOSTICO', CIERRE_CASO: 'Otro motivo.', RAZON_CIERRE_CASO: 'Cierre de prueba' }]), 724017, 'CASO_CERRADO'],
    ];
    for (const [name, source, expectedId, expectedState] of scenarios) {
      data = source;
      const record = await service.getByDocumento(DOCUMENTO);
      assert(record, name);
      assert.equal(record.__oracleIdSituacion, expectedId, name);
      assert.equal(record.estadoCodigo, expectedState, name);
      const selected = source.SITUACION_CARCELARIA.find(s => s.ID_SITUACION === expectedId);
      assert.equal(record.__activoSituacion, selected.ACTIVO, name);
      if (expectedId === 724017 && expectedState === 'ANALIZAR_CASO') {
        assert.equal(record.__oracleIdGestion, null, 'No heredar gestiones de la situación histórica');
      }
      const strict = (await db.execute(buildStrictActiveSituacionCte() + ' SELECT ID_SITUACION FROM ranked_situacion')).rows;
      assert.deepEqual(strict.map(r => r.ID_SITUACION), selected.ACTIVO === 1 ? [expectedId] : [], `Catálogos: ${name}`);
      const assigned = await repo.listAssignedCasesForReport({ defensorNombre: 'DEFENSOR DIAGNOSTICO', tipo: 'all', incluirFueraPrision: true });
      assert.deepEqual(assigned.map(r => r.ID_SITUACION), [expectedId], `Reporte: ${name}`);
      results.push({ escenario: name, idSituacion: expectedId, activo: selected.ACTIVO, estado: expectedState });
    }
    const express = require('express');
    const app = express();
    app.use('/api/ppl', require('../routes/ppl'));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    for (const index of [0, 1, 6, 11]) {
      const [name, source, expectedId, expectedState] = scenarios[index];
      data = source;
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ppl/${DOCUMENTO}?fresh=regresion`);
      assert.equal(response.status, 200, name);
      const { registro } = await response.json();
      assert.equal(registro.__oracleIdSituacion, expectedId, name);
      assert.equal(registro.estadoCodigo, expectedState, name);
      httpResults.push({ escenario: name, idSituacion: expectedId, estado: expectedState, http: 200 });
    }
    console.log(`OK Oracle: ${scenarios.length} escenarios de selección, estado, catálogos y reporte; ${httpResults.length} comprobaciones HTTP; solo SELECT.`);
    return { resultados: results, resultadosHttp: httpResults };
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    db.execute = originalExecute;
  }
}

if (require.main === module) {
  if (process.env.RUN_ORACLE_INTEGRATION !== 'true') console.log('Omitido: habilite RUN_ORACLE_INTEGRATION=true para ejecutar SELECT en Oracle.');
  else run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.closePool());
}
module.exports = { run };
