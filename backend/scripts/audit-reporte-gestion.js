const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env'), quiet: true });
const db = require('../db/oraclePool');
const { normalizedMojibakeSqlExpr } = require('../repositories/oracle/sqlFragments');
const { normalizeSearchText } = require('../utils/textNormalization');
const { getOracleConfig } = require('../config/oracle');

// Diagnóstico de solo lectura. --output-dir guarda SQL, binds y conjuntos de IDs
// para reconciliar; nunca escribe datos en Oracle.
function argument(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function legacyEventsSql(eventUnions) {
  const closure = `(TRIM(TO_CHAR(g.CIERRE_CASO)) NOT IN ('-', '--')
    OR UPPER(NVL(TO_CHAR(g.ACCION_REALIZAR), '')) LIKE '%CASO CERRADO%'
    OR UPPER(NVL(TO_CHAR(g.ACTUACION_ADELANTAR), '')) LIKE '%CASO CERRADO%')`;
  return `WITH eventos AS (
    ${eventUnions.map(([tipo, fecha]) => `SELECT '${tipo}' TIPO, g.ID_GESTION, s.ID_SITUACION, s.ID_PERSONA, ${fecha} FECHA
      FROM DNDP.GESTION_JURIDICA g JOIN DNDP.SITUACION_CARCELARIA s ON s.ID_SITUACION=g.ID_SITUACION
      JOIN DNDP.PERSONA p ON p.ID_PERSONA=s.ID_PERSONA
      WHERE ${fecha} IS NOT NULL ${tipo === 'cierre' ? `AND ${closure}` : ''}`).join('\nUNION ALL\n')}
  ) SELECT e.* FROM eventos e
  WHERE e.FECHA >= TO_DATE(:fechaInicio, 'YYYY-MM-DD') AND e.FECHA < TO_DATE(:fechaFin, 'YYYY-MM-DD') + 1
    AND EXISTS (SELECT 1 FROM DNDP.ASIGNACION a WHERE a.ID_PERSONA=e.ID_PERSONA
      AND (TO_CHAR(a.CEDULA_DEFENSOR)=:defensorCedula OR (a.CEDULA_DEFENSOR IS NULL AND ${normalizedMojibakeSqlExpr('a.NOMBRE_DEFENSOR')}=:defensorNombre))
      AND (a.FECHA_FIN IS NULL OR (e.FECHA >= TRUNC(a.FECHA_ASIGNACION) AND e.FECHA < TRUNC(a.FECHA_FIN)+1)))`;
}

function assignedMetrics(rows) {
  return {
    personas: new Set(rows.map((r) => r.ID_PERSONA)).size,
    cerradas: new Set(rows.filter((r) => r.ESTADO_CODIGO === 'CASO_CERRADO').map((r) => r.ID_PERSONA)).size,
    fueraPrision: rows.filter((r) => Number(r.SITUACION_ACTIVA) === 0).length,
  };
}
function eventMetrics(rows) {
  const result = {};
  rows.forEach((r) => { result[r.TIPO] = (result[r.TIPO] || 0) + 1; });
  result.casosCerradosUnicos = new Set(rows.filter((r) => r.TIPO === 'cierre').map((r) => r.ID_SITUACION)).size;
  return result;
}

function assignedCountSql(sql) {
  const finalSelect = sql.lastIndexOf('    SELECT\n      assigned_rows.*');
  assert(finalSelect >= 0, 'La consulta de personas debe conservar el CTE assigned_rows.');
  return sql.slice(0, finalSelect) + `
    SELECT COUNT(DISTINCT ID_PERSONA) AS PERSONAS_ASIGNADAS,
      COUNT(DISTINCT CASE WHEN ESTADO_CODIGO <> 'CASO_CERRADO' THEN ID_PERSONA END) AS PERSONAS_ACTIVAS,
      COUNT(DISTINCT CASE WHEN ESTADO_CODIGO = 'CASO_CERRADO' THEN ID_PERSONA END) AS PERSONAS_CON_CASO_CERRADO,
      COUNT(DISTINCT CASE WHEN SITUACION_ACTIVA = 0 THEN ID_PERSONA END) AS PERSONAS_FUERA_PRISION
    FROM assigned_rows`;
}

async function run() {
  const outputDir = argument('output-dir');
  const captured = [];
  const realExecute = db.execute;
  db.execute = async (sql, binds, options) => {
    // Captura exactamente el SQL que ejecutan los repositorios de la aplicación.
    captured.push({ sql, binds, operation: options?.operation || 'diagnostico' });
    const started = Date.now();
    const response = await realExecute(sql, binds, options);
    if (process.env.REPORT_AUDIT_VERBOSE === 'true') {
      console.log(`${options?.operation || 'diagnostico'}: ${Date.now() - started} ms`);
    }
    return response;
  };
  const reportRepo = require('../repositories/oracle/reporteAtencionesRepository');
  const personaRepo = require('../repositories/oracle/personaRepository');
  const fechaFin = argument('fecha-fin', new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date()));
  const fechaInicio = argument('fecha-inicio', '2025-01-01');
  const targets = argument('defensor')
    ? [{ nombre: argument('defensor'), cedula: argument('cedula') }]
    : [
      { nombre: 'JORGE OVIDIO SUAREZ MERCHAN', cedula: '' },
      { nombre: 'GERMAN ARTURO PUENTES CUELLAR', cedula: '' },
      { nombre: 'ABRAHAN ALBERTO CLEVES MONJE', cedula: '11322472' },
    ];
  const result = { servicio: getOracleConfig().serviceName, esquema: getOracleConfig().schema, fechaInicio, fechaFin, generadoEn: new Date().toISOString(), soloLectura: true, defensores: [] };
  for (const defensor of targets) {
    const params = { defensorNombre: defensor.nombre, defensorCedula: defensor.cedula, fechaInicio, fechaFin };
    const oldRows = await reportRepo.listAssignedCases({ ...params, incluirFueraPrision: true });
    const legacyBinds = { ...params, defensorNombre: normalizeSearchText(defensor.nombre) };
    const legacyEvents = (await db.execute(legacyEventsSql(reportRepo.EVENT_UNIONS), legacyBinds, { operation: 'diagnostico.eventosAntes' })).rows;
    const newEvents = await reportRepo.listEvents(params);
    const item = { defensor: defensor.nombre, antes: assignedMetrics(oldRows), actuacionesAntes: eventMetrics(legacyEvents), actuacionesAhora: eventMetrics(newEvents), comparaciones: [] };
    for (const scope of [
      { tipo: 'all', lugar: '', incluirFueraPrision: false },
      { tipo: 'condenado', lugar: '', incluirFueraPrision: false },
      { tipo: 'condenado', lugar: 'CPMS GIRARDOT', incluirFueraPrision: false },
      { tipo: 'all', lugar: '', incluirFueraPrision: true },
    ]) {
      const rows = await reportRepo.listAssignedCases({ ...params, ...scope });
      const filters = { defensor: defensor.nombre, defensorId: defensor.cedula, lugar: scope.lugar, lugarExacto: true, incluirFueraPrision: scope.incluirFueraPrision };
      const listed = await personaRepo.listCondenadosSummary({ tipo: scope.tipo, filters, limit: 100000, includeExactCounts: true });
      assert.equal(listed.truncated, false, 'La auditoría requiere la totalidad del listado.');
      const reportIds = [...new Set(rows.map((r) => r.ID_PERSONA))].sort((a, b) => a - b);
      const listIds = [...new Set(listed.rows.map((r) => r.ID_PERSONA))].sort((a, b) => a - b);
      assert.deepEqual(reportIds, listIds, `Diferencia de IDs para ${defensor.nombre}, ${JSON.stringify(scope)}`);
      const closedIds = rows.filter((r) => r.ESTADO_CODIGO === 'CASO_CERRADO').map((r) => r.ID_PERSONA).sort((a, b) => a - b);
      const listedClosedIds = listed.rows.filter((r) => r.ESTADO_CODIGO === 'CASO_CERRADO').map((r) => r.ID_PERSONA).sort((a, b) => a - b);
      assert.deepEqual(closedIds, listedClosedIds, 'Los estados del reporte y del listado deben coincidir por persona.');
      item.comparaciones.push({ ...scope, ...assignedMetrics(rows), listado: listIds.length, mismosIdsYEstados: true, ...(outputDir ? { ids: reportIds, idsCerrados: closedIds, idsExcluidosDelUniversoAnterior: oldRows.filter((r) => !reportIds.includes(r.ID_PERSONA)).map((r) => r.ID_PERSONA) } : {}) });
    }
    result.defensores.push(item);
    console.log(JSON.stringify({ ...item, comparaciones: item.comparaciones.map(({ ids, idsCerrados, idsExcluidosDelUniversoAnterior, ...counts }) => counts) }, null, 2));
  }
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'resultado.json'), `${JSON.stringify(result, null, 2)}\n`);
    captured.forEach((query, index) => {
      const stem = `${String(index + 1).padStart(2, '0')}-${query.operation.replace(/[^a-z0-9.-]/gi, '-')}`;
      fs.writeFileSync(path.join(outputDir, `${stem}.sql`), `${query.sql.trim()};\n`);
      fs.writeFileSync(path.join(outputDir, `${stem}.binds.json`), `${JSON.stringify(query.binds, null, 2)}\n`);
      if (query.operation === 'reportes.atenciones.listAssignedCases') {
        fs.writeFileSync(path.join(outputDir, `${stem}.conteo.sql`), `${assignedCountSql(query.sql).trim()};\n`);
      }
    });
    console.log(`SQL exacto, binds y resultados: ${path.resolve(outputDir)}`);
  }
  console.log(`OK: solo SELECT; servicio ${result.servicio}; periodo ${fechaInicio} a ${fechaFin}.`);
}
if (require.main === module) {
  run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.closePool());
}
module.exports = { legacyEventsSql, assignedMetrics, eventMetrics, assignedCountSql };
