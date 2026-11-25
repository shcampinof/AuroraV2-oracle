const assert = require('assert/strict');
const { randomInt } = require('crypto');
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '..', '.env'), quiet: true });
const db = require('../db/oraclePool');
const { getOracleConfig, getOracleSchema } = require('../config/oracle');

// Solo utiliza una persona sintética. Todo el DML se revierte, incluidas las
// actuaciones creadas por el proceso automático; no procesa casos de usuarios.
async function run() {
  const driver = db.getOracleDriver();
  const config = getOracleConfig();
  const schema = getOracleSchema();
  const connection = await driver.getConnection({ user: config.user, password: config.password, connectString: config.connectString });
  const originalExecute = db.execute;
  const id = -randomInt(1, 1_000_000_000);
  const execute = (sql, binds = {}) => connection.execute(sql.replace(/\bDNDP\./g, `${schema}.`), binds,
    { outFormat: driver.OUT_FORMAT_OBJECT, autoCommit: false });
  const checks = [];
  try {
    await execute("INSERT INTO DNDP.PERSONA (ID_PERSONA, NOMBRE) VALUES (:id, 'PRUEBA REVISION ROLLBACK')", { id });
    await execute(`INSERT INTO DNDP.SITUACION_CARCELARIA (ID_SITUACION, ID_PERSONA, ACTIVO, FUENTE, SITUACION)
      VALUES (:id, :id, 1, 'PRUEBA', 'CONDENADO')`, { id });
    await execute(`INSERT INTO DNDP.ASIGNACION (ID_ASIGNACION, ID_PERSONA, NOMBRE_DEFENSOR, FECHA_ASIGNACION)
      VALUES (:id, :id, 'DEFENSORA REVISION', SYSDATE)`, { id });
    await execute(`INSERT INTO DNDP.GESTION_JURIDICA
      (ID_GESTION, ID_SITUACION, DEFENSOR_GESTION, ID_ASIGNACION_GESTION, FECHA_ANALISIS, NUEVA_FECHA_ANALISIS,
       LIBERTAD_CONDICIONAL, PRISION_DOMICILIARIA_MITAD_PENA, PROCEDENCIA_PENA_CUMPLIDA,
       PROCEDENCIA_ACUMULACION_PENAS, OTRAS_SOLICITUDES_TRAMITAR, RESUMEN_ANALISIS_CASO, FECHA_REGISTRO)
      VALUES (:id, :id, 'DEFENSORA REVISION', :id, DATE '2026-05-20', DATE '2026-11-20',
        'No cumple requisitos objetivos', 'No aplica', 'No', 'No', 'Ninguna', 'ANALISIS ORIGINAL', TIMESTAMP '2026-05-20 10:00:00')`, { id });
    await execute('SAVEPOINT review_fixture');
    db.execute = (sql, binds, options) => {
      if (options.operation === 'asignacion.replaceActiveAssignmentByPersona') return execute(sql, binds);
      assert.equal(options.operation, 'analysisReview.createDueReviews');
      assert(sql.includes('ORDER BY g.NUEVA_FECHA_ANALISIS'));
      const scoped = sql.replace('ORDER BY g.NUEVA_FECHA_ANALISIS', 'AND g.ID_SITUACION = :fixtureSituacion ORDER BY g.NUEVA_FECHA_ANALISIS');
      return execute(scoped, { ...binds, fixtureSituacion: id });
    };
    const repository = require('../repositories/oracle/analysisReviewRepository');
    const assignments = require('../repositories/oracle/asignacionRepository');
    await assignments.replaceActiveAssignmentByPersona(id, { defensorNombre: 'DEFENSORA REVISION', idSituacion: id });
    const beforeDate = (await execute('SELECT COUNT(*) AS TOTAL FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION = :id', { id })).rows[0];
    assert.equal(beforeDate.TOTAL, 1, 'Repetir la asignación al mismo defensor no abre la revisión antes de tiempo');
    checks.push('asignación repetida respeta la fecha programada');
    assert.equal(await repository.createDueReviews('2026-11-19'), 0, 'No abre antes de la fecha');
    assert.equal(await repository.createDueReviews('2026-11-20'), 1, 'Abre en la fecha exacta');
    assert.equal(await repository.createDueReviews('2026-11-20'), 0, 'Reintentar no duplica');
    const children = (await execute('SELECT * FROM DNDP.GESTION_JURIDICA WHERE ID_GESTION_ORIGEN = :id', { id })).rows;
    assert.equal(children.length, 1);
    assert.equal(children[0].DEFENSOR_GESTION, 'DEFENSORA REVISION');
    assert.equal(children[0].ID_ASIGNACION_GESTION, id);
    for (const column of ['FECHA_ANALISIS', 'NUEVA_FECHA_ANALISIS', 'LIBERTAD_CONDICIONAL', 'RESUMEN_ANALISIS_CASO', 'CIERRE_CASO']) {
      assert.equal(children[0][column], null, `La revisión nace sin respuestas anteriores: ${column}`);
    }
    const source = (await execute('SELECT RESUMEN_ANALISIS_CASO, NUEVA_FECHA_ANALISIS FROM DNDP.GESTION_JURIDICA WHERE ID_GESTION = :id', { id })).rows[0];
    assert.equal(source.RESUMEN_ANALISIS_CASO, 'ANALISIS ORIGINAL');
    assert(source.NUEVA_FECHA_ANALISIS, 'Conserva la programación en el histórico');
    checks.push('fecha exacta, mismo defensor y asignación, revisión vacía, historial, reintento sin duplicados');
    await execute('ROLLBACK TO review_fixture');

    for (const [name, sql] of [
      ['fuera de prisión', 'UPDATE DNDP.SITUACION_CARCELARIA SET ACTIVO = 0 WHERE ID_SITUACION = :id'],
      ['sin defensor vigente', 'UPDATE DNDP.ASIGNACION SET FECHA_FIN = SYSDATE WHERE ID_ASIGNACION = :id'],
      ['defensor reasignado', "UPDATE DNDP.ASIGNACION SET NOMBRE_DEFENSOR = 'OTRO DEFENSOR' WHERE ID_ASIGNACION = :id"],
      ['procedencia corregida', "UPDATE DNDP.GESTION_JURIDICA SET PROCEDENCIA_PENA_CUMPLIDA = 'Sí' WHERE ID_GESTION = :id"],
      ['cierre manual', "UPDATE DNDP.GESTION_JURIDICA SET CIERRE_CASO = 'Otro motivo.' WHERE ID_GESTION = :id"],
      ['sindicado', "UPDATE DNDP.SITUACION_CARCELARIA SET SITUACION = 'SINDICADO' WHERE ID_SITUACION = :id"],
    ]) {
      await execute(sql, { id });
      assert.equal(await repository.createDueReviews('2026-11-20'), 0, name);
      await execute('ROLLBACK TO review_fixture');
      checks.push(name);
    }
    await execute('UPDATE DNDP.GESTION_JURIDICA SET ID_ASIGNACION_GESTION = NULL WHERE ID_GESTION = :id', { id });
    assert.equal(await repository.createDueReviews('2026-11-20'), 1, 'Las gestiones legadas conservan al mismo defensor vigente');
    await execute('ROLLBACK TO review_fixture');
    checks.push('gestión legada sin identificador de asignación');
    // Una gestión creada por otro flujo reemplaza la revisión pendiente.
    await execute(`INSERT INTO DNDP.GESTION_JURIDICA (ID_GESTION, ID_SITUACION, DEFENSOR_GESTION, FECHA_REGISTRO)
      VALUES (:newerId, :id, 'DEFENSORA REVISION', SYSTIMESTAMP)`, { id, newerId: id - 1 });
    assert.equal(await repository.createDueReviews('2026-11-20'), 0);
    checks.push('no abre si ya existe una gestión posterior');
    console.log(JSON.stringify({ ok: true, rolledBack: true, checks }));
  } finally {
    db.execute = originalExecute;
    await connection.rollback();
    await connection.close();
    await db.closePool();
  }
}

run().catch(error => { console.error(error.message); process.exitCode = 1; });
