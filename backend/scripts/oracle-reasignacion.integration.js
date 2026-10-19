const assert = require('assert/strict');
const { randomInt } = require('crypto');
const path = require('path');
require('dotenv').config({
  path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env'),
  quiet: true,
});

const db = require('../db/oraclePool');
const { getOracleConfig, getOracleSchema } = require('../config/oracle');

// Prueba el SQL real del repositorio en una sola conexión, siempre sin commit.
// La persona y sus asignaciones son sintéticas y se eliminan mediante rollback.
// Oracle sí consume valores de SEQ_ASIGNACION, incluso al revertir la transacción.
async function run() {
  const driver = db.getOracleDriver();
  const config = getOracleConfig();
  const schema = getOracleSchema();
  const connection = await driver.getConnection({
    user: config.user,
    password: config.password,
    connectString: config.connectString,
  });
  const repositoryPath = require.resolve('../repositories/oracle/asignacionRepository');
  const previousModule = require.cache[repositoryPath];
  const originalExecute = db.execute;
  const idPersona = -randomInt(1, 2_000_000_000);
  let idSituacion = null;
  const execute = (sql, binds = {}) => connection.execute(
    sql.replace(/\bDNDP\./g, `${schema}.`),
    binds,
    { outFormat: driver.OUT_FORMAT_OBJECT, autoCommit: false }
  );
  const checks = [];

  try {
    db.execute = execute;
    delete require.cache[repositoryPath];
    const repository = require(repositoryPath);

    const before = await execute(
      'SELECT COUNT(*) AS TOTAL FROM DNDP.PERSONA WHERE ID_PERSONA = :idPersona',
      { idPersona }
    );
    assert.equal(before.rows[0].TOTAL, 0, 'El ID sintético debe estar libre');
    const maxSituacion = await execute('SELECT NVL(MAX(ID_SITUACION), 0) AS MAX_ID FROM DNDP.SITUACION_CARCELARIA');
    idSituacion = Number(maxSituacion.rows[0].MAX_ID) + randomInt(1000, 2_000_000);
    await execute(
      'INSERT INTO DNDP.PERSONA (ID_PERSONA, NOMBRE) VALUES (:idPersona, :nombre)',
      { idPersona, nombre: 'PRUEBA REASIGNACION SIN COMMIT' }
    );
    await execute(
      `INSERT INTO DNDP.SITUACION_CARCELARIA (ID_SITUACION, ID_PERSONA, ACTIVO, FUENTE)
       VALUES (:idSituacion, :idPersona, 1, 'PRUEBA')`,
      { idSituacion, idPersona }
    );

    async function checkAssignments(expectedTotal, expectedActive, expectedDefensor, expectedGestiones) {
      const result = await execute(`
        SELECT COUNT(*) AS TOTAL,
               COUNT(CASE WHEN FECHA_FIN IS NULL THEN 1 END) AS ACTIVAS,
               MAX(CASE WHEN FECHA_FIN IS NULL THEN NOMBRE_DEFENSOR END) AS DEFENSOR,
               COUNT(DISTINCT TRUNC(FECHA_ASIGNACION)) AS DIAS
          FROM DNDP.ASIGNACION
         WHERE ID_PERSONA = :idPersona`, { idPersona });
      const row = result.rows[0];
      assert.equal(row.TOTAL, expectedTotal, 'Debe conservarse todo el historial');
      assert.equal(row.ACTIVAS, expectedActive, 'Debe haber como máximo una asignación activa');
      assert.equal(row.DEFENSOR, expectedDefensor, 'Debe quedar activo el último defensor');
      assert.equal(row.DIAS, 1, 'Las reasignaciones deben suceder en el mismo día Oracle');

      const gestiones = await execute(`
        SELECT COUNT(*) AS TOTAL,
               MAX(DEFENSOR_GESTION) KEEP (DENSE_RANK LAST ORDER BY FECHA_REGISTRO, ID_GESTION) AS DEFENSOR
          FROM DNDP.GESTION_JURIDICA
         WHERE ID_SITUACION = :idSituacion`, { idSituacion });
      assert.equal(gestiones.rows[0].TOTAL, expectedGestiones, 'La cantidad de gestiones no coincide con su estado de cierre');
      if (expectedDefensor != null) {
        assert.equal(gestiones.rows[0].DEFENSOR, expectedDefensor, 'La última gestión debe conservar su defensor');
      }
    }

    const defensores = ['PRUEBA A', 'PRUEBA B', 'PRUEBA A', 'PRUEBA C'];
    for (const [index, defensorNombre] of defensores.entries()) {
      assert.equal(await repository.replaceActiveAssignmentByPersona(idPersona, {
        defensorNombre,
        pagNombre: 'PAG PRUEBA SIN COMMIT',
        idSituacion,
      }), 1);
      await checkAssignments(index + 1, 1, defensorNombre, index + 1);
      const gestiones = (await execute('SELECT DEFENSOR_GESTION, ID_ASIGNACION_GESTION FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION = :idSituacion ORDER BY FECHA_REGISTRO, ID_GESTION', { idSituacion })).rows;
      assert.deepEqual(gestiones.map(g => g.DEFENSOR_GESTION), defensores.slice(0, index + 1), 'La reasignación no cambia ningún autor anterior');
      assert(gestiones.every(g => g.ID_ASIGNACION_GESTION > 0));
      if (index === 0) {
        await execute('UPDATE DNDP.GESTION_JURIDICA SET ID_ASIGNACION_GESTION = NULL WHERE ID_SITUACION = :idSituacion', { idSituacion });
        await repository.replaceActiveAssignmentByPersona(idPersona, { defensorNombre, idSituacion });
        const legacy = (await execute('SELECT ID_ASIGNACION_GESTION FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION = :idSituacion', { idSituacion })).rows;
        assert.equal(legacy[0].ID_ASIGNACION_GESTION, null, 'Un reintento no convierte una autoría legada en un vínculo inferido');
        await execute('UPDATE DNDP.GESTION_JURIDICA SET ID_ASIGNACION_GESTION = :asignacion WHERE ID_SITUACION = :idSituacion', { asignacion: gestiones[0].ID_ASIGNACION_GESTION, idSituacion });
      }
      if (index < 2) await execute('UPDATE DNDP.GESTION_JURIDICA SET FECHA_ANALISIS = SYSDATE, RESUMEN_ANALISIS_CASO = :resumen WHERE ID_ASIGNACION_GESTION = :asignacion', { resumen: defensorNombre, asignacion: gestiones[index].ID_ASIGNACION_GESTION });
      checks.push(index === 0 ? 'asignación inicial' : `reasignación ${index}`);
    }

    // Los hitos del mismo día pertenecen a la gestión que los registró, aunque
    // el caso haya vuelto al primer defensor y luego pasado a un tercero.
    const report = require('../repositories/oracle/reporteAtencionesRepository');
    for (const defensor of ['PRUEBA A', 'PRUEBA B', 'PRUEBA C']) {
      const events = await report.listEvents({ defensorNombre: defensor, defensorCedula: '', fechaInicio: '2026-01-01', fechaFin: '2099-12-31' });
      const mine = events.filter(e => e.ID_PERSONA === idPersona && e.TIPO === 'analisis');
      assert.equal(mine.length, defensor === 'PRUEBA C' ? 0 : 1, 'No se transfieren hitos anteriores al defensor actual');
    }
    checks.push('autoría del reporte con A → B → A → C y hitos en el mismo día');
    assert.equal(await repository.replaceActiveAssignmentByPersona(idPersona, { defensorNombre: 'PRUEBA C', idSituacion }), 1);
    await checkAssignments(4, 1, 'PRUEBA C', 4);
    checks.push('repetir el mismo defensor no duplica asignación ni gestión');

    assert.equal(await repository.endActiveAssignmentByPersona(idPersona), 1);
    await checkAssignments(4, 0, null, 4);
    checks.push('eliminar asignación');
    assert.equal(await repository.replaceActiveAssignmentByPersona(idPersona, {
      defensorNombre: 'PRUEBA B',
      idSituacion,
    }), 1);
    await checkAssignments(5, 1, 'PRUEBA B', 5);
    checks.push('asignar después de eliminar');

    await execute(`
      UPDATE DNDP.GESTION_JURIDICA
         SET CIERRE_CASO = 'Otro motivo.'
       WHERE ID_SITUACION = :idSituacion`, { idSituacion });
    assert.equal(await repository.replaceActiveAssignmentByPersona(idPersona, {
      defensorNombre: 'PRUEBA A',
      idSituacion,
    }), 1);
    await checkAssignments(6, 1, 'PRUEBA A', 6);
    checks.push('gestión nueva después de reasignación y cierre');

    await connection.rollback();
    for (const table of ['GESTION_JURIDICA', 'ASIGNACION', 'SITUACION_CARCELARIA', 'PERSONA']) {
      const result = await execute(
        table === 'GESTION_JURIDICA'
          ? `SELECT COUNT(*) AS TOTAL FROM DNDP.${table} WHERE ID_SITUACION = :idSituacion`
          : `SELECT COUNT(*) AS TOTAL FROM DNDP.${table} WHERE ID_PERSONA = :idPersona`,
        table === 'GESTION_JURIDICA' ? { idSituacion } : { idPersona }
      );
      assert.equal(result.rows[0].TOTAL, 0, `El rollback debe eliminar los datos sintéticos de ${table}`);
    }
    console.log(JSON.stringify({ ok: true, schema, checks, rollbackVerified: true }, null, 2));
  } finally {
    db.execute = originalExecute;
    delete require.cache[repositoryPath];
    if (previousModule) require.cache[repositoryPath] = previousModule;
    try {
      await connection.rollback();
    } finally {
      await connection.close();
    }
  }
}

if (require.main === module) {
  if (String(process.env.RUN_ORACLE_INTEGRATION).toLowerCase() === 'true') {
    run().catch((error) => { console.error(error.message); process.exitCode = 1; });
  } else {
    console.log('SKIP oracle-reasignacion.integration (configure RUN_ORACLE_INTEGRATION=true)');
  }
}

module.exports = { run };
