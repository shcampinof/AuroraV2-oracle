const assert = require('assert/strict');
const { randomInt } = require('crypto');
const path = require('path');

require('dotenv').config({
  path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '..', '.env'),
  quiet: true,
});

const db = require('../db/oraclePool');
const { getOracleConfig, getOracleSchema } = require('../config/oracle');

function normalizeRegional(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function regionalChanged(previous, next) {
  const oldRegional = normalizeRegional(previous);
  const newRegional = normalizeRegional(next);
  return Boolean(oldRegional && newRegional && oldRegional !== newRegional);
}

async function run() {
  const driver = db.getOracleDriver();
  const config = getOracleConfig();
  const schema = getOracleSchema();
  const connection = await driver.getConnection({
    user: config.user,
    password: config.password,
    connectString: config.connectString,
  });
  const execute = (sql, binds = {}) => connection.execute(
    sql.replace(/\bDNDP\./g, `${schema}.`),
    binds,
    { outFormat: driver.OUT_FORMAT_OBJECT, autoCommit: false }
  );
  const idPersona = -randomInt(1, 2_000_000_000);
  const insertedSituations = [];

  async function firstRow(sql) {
    const result = await execute(sql);
    assert(result.rows?.[0], 'El catálogo no contiene un caso necesario para la prueba.');
    return result.rows[0];
  }

  async function resolveCurrentRegional(idSituacion) {
    const result = await execute(`
      SELECT MAX(TO_CHAR(REGIONAL)) AS REGIONAL
        FROM DNDP.VW_SITUACION_REGIONAL
       WHERE ID_SITUACION = :idSituacion`, { idSituacion });
    return result.rows?.[0]?.REGIONAL || null;
  }

  async function resolveIncomingRegional(row) {
    const result = await execute(`
      SELECT NVL(
               (SELECT MAX(TO_CHAR(c.REGIONAL))
                  FROM DNDP.CAT_ERON_REGIONAL c
                 WHERE c.ESTABLECIMIENTO = :establecimiento),
               (SELECT MAX(TO_CHAR(c.REGIONAL))
                  FROM DNDP.CAT_ERON_REGIONAL c
                 WHERE c.DEPARTAMENTO = :departamento
                   AND c.MUNICIPIO_SISIPEC = :municipio)
             ) AS REGIONAL
        FROM dual`, {
      establecimiento: row.ESTABLECIMIENTO,
      departamento: row.DEPARTAMENTO,
      municipio: row.MUNICIPIO_SISIPEC,
    });
    return result.rows?.[0]?.REGIONAL || null;
  }

  async function insertSituation(row) {
    const idSituacion = idPersona - insertedSituations.length - 1;
    await execute(`
      INSERT INTO DNDP.SITUACION_CARCELARIA (
        ID_SITUACION, ID_PERSONA, SITUACION, ESTABLECIMIENTO,
        DEPARTAMENTO, MUNICIPIO, ACTIVO, FUENTE
      ) VALUES (
        :idSituacion, :idPersona, 'Condenado', :establecimiento,
        :departamento, :municipio, 0, 'PRUEBA_REGIONAL_ROLLBACK'
      )`, {
      idSituacion,
      idPersona,
      establecimiento: row.ESTABLECIMIENTO,
      departamento: row.DEPARTAMENTO,
      municipio: row.MUNICIPIO_SISIPEC,
    });
    insertedSituations.push(idSituacion);
    return idSituacion;
  }

  try {
    const object = await execute(`
      SELECT STATUS
        FROM ALL_OBJECTS
       WHERE OWNER = '${schema}'
         AND OBJECT_NAME = 'PRC_CARGA_SISIPEC'
         AND OBJECT_TYPE = 'PROCEDURE'`);
    assert.equal(object.rows?.[0]?.STATUS, 'VALID', 'PRC_CARGA_SISIPEC debe estar válido.');

    const errors = await execute(`
      SELECT LINE, POSITION, TEXT
        FROM ALL_ERRORS
       WHERE OWNER = '${schema}'
         AND NAME = 'PRC_CARGA_SISIPEC'
         AND TYPE = 'PROCEDURE'`);
    assert.equal(errors.rows.length, 0, 'El procedimiento no debe tener errores de compilación.');

    const sourceRows = await execute(`
      SELECT TEXT
        FROM ALL_SOURCE
       WHERE OWNER = '${schema}'
         AND NAME = 'PRC_CARGA_SISIPEC'
         AND TYPE = 'PROCEDURE'
       ORDER BY LINE`);
    const source = sourceRows.rows.map((row) => row.TEXT || '').join('');
    const comparisonStart = source.indexOf('SELECT MAX(TO_CHAR(REGIONAL))');
    const comparisonEnd = source.indexOf('INTO v_cambio_bloque_2', comparisonStart);
    const comparison = source.slice(comparisonStart, comparisonEnd);
    assert(comparisonStart >= 0 && comparisonEnd > comparisonStart, 'No se encontró el bloque regional instalado.');
    assert(source.includes('AURORA_REASIGNACION_SISIPEC_V3'));
    assert(comparison.includes('DNDP.VW_SITUACION_REGIONAL'));
    assert(comparison.includes('DNDP.CAT_ERON_REGIONAL'));
    assert(!comparison.includes('TO_CHAR(actual.DEPARTAMENTO)'), 'DEPARTAMENTO no puede compararse como regional.');
    assert(source.includes("v_motivo_cierre := 'Cierre automático por cambio de regional.'"));
    assert(source.includes("'EQUIPO PPL DNDP'"), 'La regla independiente de cambios del bloque 2 debe mantenerse.');

    const sameRegionalDifferentEron = await firstRow(`
      SELECT * FROM (
        SELECT c1.ESTABLECIMIENTO AS OLD_ERON,
               c1.DEPARTAMENTO AS OLD_DEPARTAMENTO,
               c1.MUNICIPIO_SISIPEC AS OLD_MUNICIPIO,
               c1.REGIONAL AS OLD_REGIONAL,
               c2.ESTABLECIMIENTO AS NEW_ERON,
               c2.DEPARTAMENTO AS NEW_DEPARTAMENTO,
               c2.MUNICIPIO_SISIPEC AS NEW_MUNICIPIO,
               c2.REGIONAL AS NEW_REGIONAL
          FROM DNDP.CAT_ERON_REGIONAL c1
          JOIN DNDP.CAT_ERON_REGIONAL c2
            ON UPPER(TRIM(c2.REGIONAL)) = UPPER(TRIM(c1.REGIONAL))
           AND c2.ESTABLECIMIENTO > c1.ESTABLECIMIENTO
         WHERE TRIM(c1.REGIONAL) IS NOT NULL
           AND TRIM(c2.REGIONAL) IS NOT NULL
         ORDER BY c1.REGIONAL, c1.ESTABLECIMIENTO, c2.ESTABLECIMIENTO
      ) WHERE ROWNUM = 1`);

    const sameRegionalDifferentDepartment = await firstRow(`
      SELECT * FROM (
        SELECT c1.ESTABLECIMIENTO AS OLD_ERON,
               c1.DEPARTAMENTO AS OLD_DEPARTAMENTO,
               c1.MUNICIPIO_SISIPEC AS OLD_MUNICIPIO,
               c1.REGIONAL AS OLD_REGIONAL,
               c2.ESTABLECIMIENTO AS NEW_ERON,
               c2.DEPARTAMENTO AS NEW_DEPARTAMENTO,
               c2.MUNICIPIO_SISIPEC AS NEW_MUNICIPIO,
               c2.REGIONAL AS NEW_REGIONAL
          FROM DNDP.CAT_ERON_REGIONAL c1
          JOIN DNDP.CAT_ERON_REGIONAL c2
            ON UPPER(TRIM(c2.REGIONAL)) = UPPER(TRIM(c1.REGIONAL))
           AND UPPER(TRIM(c2.DEPARTAMENTO)) <> UPPER(TRIM(c1.DEPARTAMENTO))
         WHERE TRIM(c1.REGIONAL) IS NOT NULL
           AND TRIM(c2.REGIONAL) IS NOT NULL
         ORDER BY c1.REGIONAL, c1.ESTABLECIMIENTO, c2.ESTABLECIMIENTO
      ) WHERE ROWNUM = 1`);

    const differentRegionalSameDepartment = await firstRow(`
      SELECT * FROM (
        SELECT c1.ESTABLECIMIENTO AS OLD_ERON,
               c1.DEPARTAMENTO AS OLD_DEPARTAMENTO,
               c1.MUNICIPIO_SISIPEC AS OLD_MUNICIPIO,
               c1.REGIONAL AS OLD_REGIONAL,
               c2.ESTABLECIMIENTO AS NEW_ERON,
               c2.DEPARTAMENTO AS NEW_DEPARTAMENTO,
               c2.MUNICIPIO_SISIPEC AS NEW_MUNICIPIO,
               c2.REGIONAL AS NEW_REGIONAL
          FROM DNDP.CAT_ERON_REGIONAL c1
          JOIN DNDP.CAT_ERON_REGIONAL c2
            ON UPPER(TRIM(c2.DEPARTAMENTO)) = UPPER(TRIM(c1.DEPARTAMENTO))
           AND UPPER(TRIM(c2.REGIONAL)) <> UPPER(TRIM(c1.REGIONAL))
         WHERE TRIM(c1.REGIONAL) IS NOT NULL
           AND TRIM(c2.REGIONAL) IS NOT NULL
         ORDER BY c1.DEPARTAMENTO, c1.ESTABLECIMIENTO, c2.ESTABLECIMIENTO
      ) WHERE ROWNUM = 1`);

    await execute(
      'INSERT INTO DNDP.PERSONA (ID_PERSONA, NOMBRE) VALUES (:idPersona, :nombre)',
      { idPersona, nombre: 'PRUEBA REGIONAL CON ROLLBACK' }
    );

    async function evaluatePair(pair, expectedChange, label) {
      const oldRow = {
        ESTABLECIMIENTO: pair.OLD_ERON,
        DEPARTAMENTO: pair.OLD_DEPARTAMENTO,
        MUNICIPIO_SISIPEC: pair.OLD_MUNICIPIO,
      };
      const newRow = {
        ESTABLECIMIENTO: pair.NEW_ERON,
        DEPARTAMENTO: pair.NEW_DEPARTAMENTO,
        MUNICIPIO_SISIPEC: pair.NEW_MUNICIPIO,
      };
      const idSituacion = await insertSituation(oldRow);
      const previous = await resolveCurrentRegional(idSituacion);
      const next = await resolveIncomingRegional(newRow);
      assert.equal(normalizeRegional(previous), normalizeRegional(pair.OLD_REGIONAL), `${label}: regional anterior`);
      assert.equal(normalizeRegional(next), normalizeRegional(pair.NEW_REGIONAL), `${label}: regional nueva`);
      assert.equal(regionalChanged(previous, next), expectedChange, label);
      return {
        label,
        oldEron: pair.OLD_ERON,
        newEron: pair.NEW_ERON,
        oldDepartment: pair.OLD_DEPARTAMENTO,
        newDepartment: pair.NEW_DEPARTAMENTO,
        oldRegional: previous,
        newRegional: next,
        closes: expectedChange,
      };
    }

    const scenarios = [];
    scenarios.push(await evaluatePair(
      sameRegionalDifferentEron,
      false,
      'ERON distinto dentro de la misma regional no cierra'
    ));
    scenarios.push(await evaluatePair(
      sameRegionalDifferentDepartment,
      false,
      'Departamento distinto dentro de la misma regional no cierra'
    ));
    scenarios.push(await evaluatePair(
      differentRegionalSameDepartment,
      true,
      'Regional distinta dentro del mismo departamento sí cierra'
    ));

    const unresolved = await resolveIncomingRegional({
      ESTABLECIMIENTO: `ERON SIN CATALOGO ${idPersona}`,
      DEPARTAMENTO: `DEP SIN CATALOGO ${idPersona}`,
      MUNICIPIO_SISIPEC: `MUN SIN CATALOGO ${idPersona}`,
    });
    assert.equal(unresolved, null, 'El destino inexistente debe quedar sin regional resuelta.');
    assert.equal(regionalChanged(scenarios[0].oldRegional, unresolved), false,
      'Una regional no resuelta no debe producir un cierre inferido.');
    scenarios.push({
      label: 'Regional nueva sin resolver no cierra por inferencia',
      oldRegional: scenarios[0].oldRegional,
      newRegional: unresolved,
      closes: false,
    });

    await connection.rollback();
    const residue = await execute(
      'SELECT COUNT(*) AS TOTAL FROM DNDP.PERSONA WHERE ID_PERSONA = :idPersona',
      { idPersona }
    );
    assert.equal(residue.rows[0].TOTAL, 0, 'El rollback debe retirar todos los datos sintéticos.');

    const result = {
      ok: true,
      schema,
      procedureStatus: 'VALID',
      compilationErrors: 0,
      sourceChecks: {
        markerV3: true,
        usesRegionalView: true,
        usesRegionalCatalog: true,
        comparesDepartmentAsRegional: false,
        keepsBlock2Rule: true,
      },
      scenarios,
      rollbackVerified: true,
    };
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    try {
      await connection.rollback();
    } finally {
      await connection.close();
    }
  }
}

if (require.main === module) {
  if (String(process.env.RUN_ORACLE_INTEGRATION).toLowerCase() === 'true') {
    run().catch((error) => {
      console.error(error.stack || error.message || error);
      process.exitCode = 1;
    });
  } else {
    console.log('SKIP oracle-sisipec-regional.integration (configure RUN_ORACLE_INTEGRATION=true)');
  }
}

module.exports = { run, normalizeRegional, regionalChanged };
