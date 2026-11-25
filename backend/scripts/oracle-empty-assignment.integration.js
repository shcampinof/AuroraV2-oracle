const assert = require('assert/strict');
const { randomInt } = require('crypto');
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '..', '.env'), quiet: true });
const db = require('../db/oraclePool');
const { getOracleConfig, getOracleSchema } = require('../config/oracle');
const { ANSWER_COLUMNS } = require('../repositories/oracle/gestionProgressSql');

// Todo el DML se limita a esta persona sintética y se revierte. Nunca procesa
// asignaciones reales ni instala objetos. Las secuencias sí consumen valores.
async function run() {
  const driver = db.getOracleDriver();
  const config = getOracleConfig();
  const schema = getOracleSchema();
  const connection = await driver.getConnection({ user: config.user, password: config.password, connectString: config.connectString });
  const execute = (sql, binds = {}) => connection.execute(sql.replace(/\bDNDP\./g, `${schema}.`), binds,
    { outFormat: driver.OUT_FORMAT_OBJECT, autoCommit: false });
  const originalExecute = db.execute;
  const repositoryPath = require.resolve('../repositories/oracle/asignacionRepository');
  const previousModule = require.cache[repositoryPath];
  const id = -randomInt(1, 1_000_000_000);
  const checks = [];
  try {
    await execute("INSERT INTO DNDP.PERSONA (ID_PERSONA, NOMBRE) VALUES (:id, 'PRUEBA GESTION VACIA ROLLBACK')", { id });
    await execute(`INSERT INTO DNDP.SITUACION_CARCELARIA (ID_SITUACION, ID_PERSONA, ACTIVO, FUENTE, SITUACION)
      VALUES (:id, :id, 1, 'PRUEBA', 'CONDENADO')`, { id });
    await execute(`INSERT INTO DNDP.ASIGNACION (ID_ASIGNACION, ID_PERSONA, NOMBRE_DEFENSOR, FECHA_ASIGNACION)
      VALUES (:id, :id, 'DEFENSOR ORIGINAL', SYSDATE)`, { id });
    await execute(`INSERT INTO DNDP.GESTION_JURIDICA
      (ID_GESTION, ID_SITUACION, DEFENSOR_GESTION, ID_ASIGNACION_GESTION, ACCION_REALIZAR, FECHA_REGISTRO)
      VALUES (:id, :id, 'DEFENSOR ORIGINAL', :id, 'Analizar el caso', TIMESTAMP '2026-01-01 00:00:00')`, { id });
    await execute('SAVEPOINT empty_assignment_fixture');
    db.execute = execute;
    delete require.cache[repositoryPath];
    const repository = require(repositoryPath);
    const rows = async () => (await execute(`SELECT * FROM DNDP.GESTION_JURIDICA WHERE ID_SITUACION=:id
      ORDER BY FECHA_REGISTRO NULLS FIRST, ID_GESTION`, { id })).rows;
    const reset = () => execute('ROLLBACK TO empty_assignment_fixture');
    const unassign = () => repository.endActiveAssignmentByPersona(id, { idSituacion: id });
    const assign = () => repository.replaceActiveAssignmentByPersona(id, { defensorNombre: 'DEFENSOR NUEVO', idSituacion: id });
    const change = async (column, value) => execute(`UPDATE DNDP.GESTION_JURIDICA SET ${column}=:value WHERE ID_GESTION=:id`, { value, id });

    const placeholders = [null, '', ' ', '-', '--', '—', '–', '−', ' - — -- ', '\u00a0-\u00a0', '\u200b',
      'null', ' UNDEFINED ', 'Seleccione', 'Todos', 'Sin información', 'Sin datos', 'Sin respuesta'];
    const textColumns = ANSWER_COLUMNS.filter(column => !column.startsWith('FECHA_')
      && column !== 'NUEVA_FECHA_ANALISIS' && column !== 'INSISTENCIAS');
    for (const placeholder of placeholders) {
      for (const column of textColumns) await change(column, placeholder);
      await change('INSISTENCIAS', 0);
      assert.equal(await unassign(), 1);
      let gestiones = await rows();
      assert.equal(gestiones.length, 1, `Sin duplicar gestión para ${JSON.stringify(placeholder)}`);
      assert.equal(gestiones[0].ID_GESTION, id);
      assert.equal(gestiones[0].DEFENSOR_GESTION, null);
      assert.equal(gestiones[0].ID_ASIGNACION_GESTION, null);
      assert.equal(await unassign(), 0, 'Desasignar de nuevo no crea registros');
      await assign();
      gestiones = await rows();
      assert.equal(gestiones.length, 1);
      assert.equal(gestiones[0].ID_GESTION, id);
      assert.equal(gestiones[0].DEFENSOR_GESTION, 'DEFENSOR NUEVO');
      assert(gestiones[0].ID_ASIGNACION_GESTION > 0);
      await reset();
    }
    checks.push('vacíos, guiones Unicode, espacios, null textual y opciones sin respuesta reutilizan la gestión');

    for (const value of ['[]', '["-"]', '["", "--", "—"]']) {
      await change('OTRAS_SOLICITUDES_TRAMITAR', value);
      await change('CON_QUE_PROCESOS_ACUMULAR', value);
      await assign();
      assert.equal((await rows()).length, 1, `Lista sin respuestas: ${value}`);
      await reset();
    }
    checks.push('listas vacías y listas con marcadores sin respuesta');

    for (const column of ANSWER_COLUMNS) {
      const value = column.startsWith('FECHA_') || column === 'NUEVA_FECHA_ANALISIS' ? new Date('2026-01-01T12:00:00Z')
        : column === 'INSISTENCIAS' ? 1 : column === 'OTRAS_SOLICITUDES_TRAMITAR' ? '["-", "Ninguna"]' : 'No';
      await change(column, value);
      const before = (await rows())[0];
      await unassign();
      const after = await rows();
      assert.equal(after.length, 2, `Se conserva el avance de ${column}`);
      assert.deepEqual(after[0], before, `Se conserva íntegra la gestión con ${column}`);
      assert.equal(after[1].DEFENSOR_GESTION, null);
      await assign();
      assert.equal((await rows()).length, 2, 'Se reutiliza la nueva gestión sin defensor');
      await reset();
      await change(column, value);
      await assign();
      const reassigned = await rows();
      assert.equal(reassigned.length, 2, `Reasignar conserva una respuesta parcial en ${column}`);
      assert.equal(reassigned[0].DEFENSOR_GESTION, 'DEFENSOR ORIGINAL');
      assert.equal(reassigned[1].DEFENSOR_GESTION, 'DEFENSOR NUEVO');
      await reset();
    }
    checks.push(`cada uno de los ${ANSWER_COLUMNS.length} campos de respuesta protege la autoría aunque no haya análisis completo`);

    for (const value of ['No aplica', 'Ninguna', 'No cumple requisitos', 'Texto libre']) {
      await change('LIBERTAD_CONDICIONAL', value);
      await unassign();
      assert.equal((await rows()).length, 2, `Respuesta explícita: ${value}`);
      await reset();
    }
    checks.push('No, No aplica, Ninguna y respuestas negativas cuentan como avance');
    console.log(JSON.stringify({ ok: true, checks, rollback: true }));
  } finally {
    db.execute = originalExecute;
    if (previousModule) require.cache[repositoryPath] = previousModule;
    else delete require.cache[repositoryPath];
    await connection.rollback();
    assert.equal((await execute('SELECT COUNT(*) AS TOTAL FROM DNDP.PERSONA WHERE ID_PERSONA=:id', { id })).rows[0].TOTAL, 0);
    await connection.close();
    await db.closePool();
  }
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { run };
