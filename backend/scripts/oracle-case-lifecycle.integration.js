const assert = require('assert/strict');
const { randomInt, createHash } = require('crypto');
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '..', '.env'), quiet: true });
const db = require('../db/oraclePool');
const { getOracleConfig, getOracleSchema } = require('../config/oracle');
const { transformSisipecProcedure } = require('./install-sisipec-reassignment');
const { closures } = require('../domain/auroraCaseClosures');

// Ejecuta el procedimiento transformado como bloque anónimo, con ambos cursores
// limitados a una persona sintética y sin COMMIT ni DDL. Todo se revierte al salir.
async function run() {
  const driver = db.getOracleDriver();
  const config = getOracleConfig();
  const owner = getOracleSchema();
  const connection = await driver.getConnection({ user: config.user, password: config.password, connectString: config.connectString });
  const execute = (sql, binds = {}) => connection.execute(sql.replace(/\bDNDP\./g, `${owner}.`), binds,
    { outFormat: driver.OUT_FORMAT_OBJECT, autoCommit: false });
  const readSource = async () => (await execute(`SELECT TEXT FROM ALL_SOURCE
    WHERE OWNER = :owner AND NAME = 'PRC_CARGA_SISIPEC' AND TYPE = 'PROCEDURE' ORDER BY LINE`, { owner })).rows.map((r) => r.TEXT).join('');
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  let originalHash;
  const checks = [];
  const idPersona = -randomInt(1, 1_000_000_000);
  const documento = String(9_000_000_000_000 + Math.abs(idPersona));
  try {
    const original = await readSource();
    originalHash = hash(original);
    const transformed = transformSisipecProcedure(original);
    assert.equal(transformSisipecProcedure(transformed.source).changed, false, 'La migración es idempotente');
    let anonymous = transformed.source.replace(/^\s*PROCEDURE\s+"?PRC_CARGA_SISIPEC"?\s+AS/i, 'DECLARE');
    assert(anonymous.startsWith('DECLARE'));
    assert(anonymous.includes('WHERE NUMERO IS NOT NULL;'));
    anonymous = anonymous.replace('WHERE NUMERO IS NOT NULL;', "WHERE NUMERO IS NOT NULL AND REGEXP_REPLACE(TO_CHAR(NUMERO), '[^0-9]', '') = :documento;");
    assert(/SC\.ACTIVO\s*=\s*1/.test(anonymous));
    anonymous = anonymous.replace(/SC\.ACTIVO\s*=\s*1/, 'SC.ACTIVO = 1 AND SC.ID_PERSONA = :idPersona');
    anonymous = anonymous.replace(/\bCOMMIT\s*;/gi, 'NULL;');
    anonymous = anonymous.replace(/\bROLLBACK\s*;/gi, 'NULL;');
    assert(!/\bCOMMIT\s*;/i.test(anonymous));

    const catalog = (await execute(`SELECT DISTINCT ESTABLECIMIENTO, DEPARTAMENTO, MUNICIPIO_SISIPEC, TO_CHAR(REGIONAL) AS REGIONAL
      FROM DNDP.CAT_ERON_REGIONAL WHERE REGIONAL IS NOT NULL AND ESTABLECIMIENTO IS NOT NULL ORDER BY REGIONAL, ESTABLECIMIENTO`)).rows;
    const origin = catalog.find((row) => catalog.some((other) =>
      other.REGIONAL === row.REGIONAL && other.ESTABLECIMIENTO !== row.ESTABLECIMIENTO));
    assert(origin, 'Se necesitan dos ERON de una misma regional');
    const destination = catalog.find((r) => r.REGIONAL !== origin.REGIONAL);
    const sameRegional = catalog.find((r) => r.REGIONAL === origin.REGIONAL && r.ESTABLECIMIENTO !== origin.ESTABLECIMIENTO);
    assert(origin && destination && sameRegional, 'Se necesitan dos regionales y dos ERON de una misma regional');

    const scenarios = [
      { name: 'cerrado asignado pasa a beneficiario', closed: true, assigned: true, expected: true },
      { name: 'cerrado inactivo sin asignación pasa a beneficiario', closed: true, inactive: true, expected: true },
      { name: 'preliminar pasa a beneficiario', closed: true, previous: 'Preliminar libertad condicional', expected: true },
      { name: 'pasa a utilidad pública', closed: true, next: 'Utilidad Pública', expected: true },
      { name: 'cierre derivado de bloque 3 pasa a beneficiario', negativeClosure: true, expected: true },
      { name: 'caso abierto cambia de categoría', expected: false },
      { name: 'categoría sin variación', closed: true, next: 'No reúne requisitos', expected: false },
      { name: 'pasa a preliminar', closed: true, next: 'Preliminar libertad condicional', expected: false },
      { name: 'ya era beneficiario', closed: true, previous: 'Libertad condicional', expected: false },
      { name: 'traslado regional sin asignación ni requisitos', regional: true, next: 'No reúne requisitos', expected: true },
      { name: 'traslado regional de caso abierto asignado', regional: true, assigned: true, expected: true },
      { name: 'traslado confirmado después de cierre en formulario', regional: true, transferClosure: true, expected: true },
      { name: 'traslado y elegibilidad simultáneos', regional: true, closed: true, assigned: true, expected: true },
      { name: 'traslado dentro de la misma regional', sameRegional: true, next: 'No reúne requisitos', expected: false },
    ];

    for (const scenario of scenarios) {
      await execute('SAVEPOINT lifecycle_fixture');
      try {
        const location = scenario.regional ? destination : scenario.sameRegional ? sameRegional : origin;
        await execute(`INSERT INTO DNDP.PERSONA (ID_PERSONA, NUMERO, NOMBRE, GENERO)
          VALUES (:id, :documento, 'PRUEBA CICLO CASOS ROLLBACK', 'FEMENINO')`, { id: idPersona, documento: Number(documento) });
        await execute(`INSERT INTO DNDP.SITUACION_CARCELARIA
          (ID_SITUACION, ID_PERSONA, SITUACION, ACTIVO, FUENTE, FECHA_CAPTURA, FASE,
           AUTORIDAD, PROCESO, DELITOS, PENA_DIAS, CATEGORIZACION, FECHA_REGISTRO,
           ESTABLECIMIENTO, DEPARTAMENTO, MUNICIPIO, ENFOQUE)
          VALUES (:id, :id, 'CONDENADO', :activo, 'SISIPEC', DATE '2025-01-01', 'ALTA',
           'JUZGADO PRUEBA', '123456', 'HURTO', 3000, :categoria, DATE '2026-01-01',
           :eron, :departamento, :municipio, 'ENFOQUE CONSERVADO')`, {
          id: idPersona, activo: scenario.inactive ? 0 : 1, categoria: scenario.previous || 'No reúne requisitos',
          eron: origin.ESTABLECIMIENTO, departamento: origin.DEPARTAMENTO, municipio: origin.MUNICIPIO_SISIPEC,
        });
        const negative = scenario.negativeClosure || scenario.transferClosure;
        await execute(`INSERT INTO DNDP.GESTION_JURIDICA
          (ID_GESTION, ID_SITUACION, DEFENSOR_GESTION, CIERRE_CASO, FECHA_REGISTRO,
           FECHA_ANALISIS, RESUMEN_ANALISIS_CASO, LIBERTAD_CONDICIONAL,
           PRISION_DOMICILIARIA_MITAD_PENA, PROCEDENCIA_PENA_CUMPLIDA,
           PROCEDENCIA_ACUMULACION_PENAS, OTRAS_SOLICITUDES_TRAMITAR)
          VALUES (:id, :id, 'DEFENSORA HISTORICA QA', :motivo, TIMESTAMP '2026-01-01 00:00:00',
           DATE '2026-01-02', 'ANALISIS HISTORICO CONSERVADO', :q30, :q31, :q33, :q34, :q36)`, {
          id: idPersona, motivo: scenario.closed ? 'Otro motivo.' : scenario.transferClosure ? closures.traslado.motivo : null,
          q30: scenario.transferClosure ? closures.traslado.respuesta : negative ? 'No aplica' : null,
          q31: scenario.transferClosure ? closures.traslado.respuesta : negative ? 'No aplica' : null,
          q33: negative ? 'No' : null, q34: negative ? 'No' : null, q36: negative ? 'Ninguna' : null,
        });
        if (scenario.assigned) await execute(`INSERT INTO DNDP.ASIGNACION
          (ID_ASIGNACION, ID_PERSONA, NOMBRE_DEFENSOR, FECHA_ASIGNACION)
          VALUES (:id, :id, 'DEFENSORA HISTORICA QA', DATE '2026-01-01')`, { id: idPersona });
        await execute(`INSERT INTO DNDP.SISIPEC (NUMERO, NOMBRE, GENERO, SITUACION, FASE,
          FECHA_CAPTURA, FECHA_CORTE, AUTORIDAD, PROCESO, DELITOS, PENA_DIAS, CATEGORIZACION,
          ESTABLECIMIENTO, DEPARTAMENTO, MUNICIPIO)
          VALUES (:documento, 'PRUEBA CICLO CASOS ROLLBACK', 'FEMENINO', 'CONDENADO', 'ALTA',
          DATE '2025-01-01', DATE '2026-11-20', 'JUZGADO PRUEBA', '123456', 'HURTO', 3000, :categoria,
          :eron, :departamento, :municipio)`, {
          documento, categoria: scenario.next || 'Libertad condicional', eron: location.ESTABLECIMIENTO,
          departamento: location.DEPARTAMENTO, municipio: location.MUNICIPIO_SISIPEC,
        });
        const before = (await execute('SELECT * FROM DNDP.GESTION_JURIDICA WHERE ID_GESTION = :id', { id: idPersona })).rows[0];
        await execute(anonymous, { documento, idPersona });
        const situations = (await execute('SELECT * FROM DNDP.SITUACION_CARCELARIA WHERE ID_PERSONA = :id', { id: idPersona })).rows;
        const gestiones = (await execute(`SELECT g.* FROM DNDP.GESTION_JURIDICA g JOIN DNDP.SITUACION_CARCELARIA s
          ON s.ID_SITUACION = g.ID_SITUACION WHERE s.ID_PERSONA = :id`, { id: idPersona })).rows;
        assert.equal(gestiones.length, scenario.expected ? 2 : 1, scenario.name);
        if (scenario.expected) {
          const current = situations.filter((s) => s.ACTIVO === 1);
          assert.equal(current.length, 1, scenario.name);
          assert.notEqual(current[0].ID_SITUACION, idPersona);
          assert.equal(current[0].ESTABLECIMIENTO, location.ESTABLECIMIENTO);
          assert.equal(current[0].ENFOQUE, 'ENFOQUE CONSERVADO');
          assert.equal(situations.find((s) => s.ID_SITUACION === idPersona).ESTABLECIMIENTO, origin.ESTABLECIMIENTO);
          const fresh = gestiones.find((g) => g.ID_GESTION !== idPersona);
          assert.equal(fresh.ID_SITUACION, current[0].ID_SITUACION);
          for (const [column, value] of Object.entries(fresh)) {
            if (!['ID_GESTION', 'ID_SITUACION', 'FECHA_REGISTRO'].includes(column)) assert.equal(value, null, `${scenario.name}: ${column} debe quedar vacío`);
          }
          const previous = gestiones.find((g) => g.ID_GESTION === idPersona);
          if (scenario.regional && !scenario.closed && !scenario.transferClosure) {
            assert.equal(previous.CIERRE_CASO, 'Cierre automático por cambio de regional.');
            assert.equal(previous.RESUMEN_ANALISIS_CASO, before.RESUMEN_ANALISIS_CASO);
            assert.equal(previous.DEFENSOR_GESTION, before.DEFENSOR_GESTION);
          } else assert.deepEqual(previous, before, `${scenario.name}: el histórico se conserva íntegro`);
          assert.equal((await execute('SELECT COUNT(*) TOTAL FROM DNDP.ASIGNACION WHERE ID_PERSONA = :id AND FECHA_FIN IS NULL', { id: idPersona })).rows[0].TOTAL, 0);
          // Una segunda carga del mismo corte debe conservar el caso nuevo y el anterior.
          await execute(anonymous, { documento, idPersona });
          const repeated = (await execute(`SELECT g.* FROM DNDP.GESTION_JURIDICA g JOIN DNDP.SITUACION_CARCELARIA s
            ON s.ID_SITUACION = g.ID_SITUACION WHERE s.ID_PERSONA = :id ORDER BY g.ID_GESTION`, { id: idPersona })).rows;
          assert.equal(repeated.length, 2, `${scenario.name}: sin duplicados al repetir el corte`);
          assert.equal(repeated.find((g) => g.ID_GESTION !== idPersona).ID_SITUACION, current[0].ID_SITUACION);
          assert.deepEqual(repeated.find((g) => g.ID_GESTION === idPersona), previous);
        }
        checks.push(scenario.name);
      } finally {
        await execute('ROLLBACK TO lifecycle_fixture');
      }
    }
    console.log(JSON.stringify({ ok: true, rollback: true, procedureUnchanged: hash(await readSource()) === originalHash, checks }, null, 2));
  } finally {
    await connection.rollback();
    assert.equal((await execute('SELECT COUNT(*) TOTAL FROM DNDP.PERSONA WHERE ID_PERSONA = :id', { id: idPersona })).rows[0].TOTAL, 0);
    if (originalHash) assert.equal(hash(await readSource()), originalHash, 'La prueba no instala ni modifica el procedimiento');
    await connection.close();
  }
}

if (require.main === module) {
  if (process.env.RUN_ORACLE_INTEGRATION === 'true') run().catch((error) => { console.error(error); process.exitCode = 1; });
  else console.log('SKIP: configure RUN_ORACLE_INTEGRATION=true.');
}
module.exports = { run };
