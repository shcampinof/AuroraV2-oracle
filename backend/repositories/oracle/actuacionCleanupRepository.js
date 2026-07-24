const { execute } = require('../../db/oraclePool');
const { normalizedSqlExpr } = require('./sqlFragments');

const DEFENSOR_ACTIVO_EXPR = 'COALESCE(TO_NCHAR(a.NOMBRE_DEFENSOR), TO_NCHAR(d.NOMBRE))';

function targetAssignmentsSql() {
  return `
    SELECT a.ID_ASIGNACION
      FROM (
        SELECT
          aa.*,
          ROW_NUMBER() OVER (
            PARTITION BY aa.ID_PERSONA
            ORDER BY aa.FECHA_ASIGNACION DESC NULLS LAST, aa.ID_ASIGNACION DESC
          ) AS RN
        FROM DNDP.ASIGNACION aa
        WHERE aa.FECHA_FIN IS NULL
      ) a
      LEFT JOIN DNDP.DEFENSORES d
        ON d.CEDULA = a.CEDULA_DEFENSOR
     WHERE a.RN = 1
       AND ${normalizedSqlExpr(DEFENSOR_ACTIVO_EXPR)} = ${normalizedSqlExpr(':defensor')}
  `;
}

function targetPersonasSql() {
  return `
    SELECT a.ID_PERSONA
      FROM DNDP.ASIGNACION a
     WHERE a.ID_ASIGNACION IN (${targetAssignmentsSql()})
  `;
}

function targetSituacionesSql() {
  return `
    SELECT s.ID_SITUACION
      FROM (
        SELECT
          sc.*,
          ROW_NUMBER() OVER (
            PARTITION BY sc.ID_PERSONA
            ORDER BY
              CASE WHEN NVL(sc.ACTIVO, 0) = 1 THEN 0 ELSE 1 END,
              sc.FECHA_CAPTURA DESC NULLS LAST,
              LENGTH(REGEXP_REPLACE(NVL(sc.PROCESO, ''), '[^0-9]', '')) DESC,
              sc.FECHA_REGISTRO DESC NULLS LAST,
              sc.ID_SITUACION DESC
          ) AS RN
        FROM DNDP.SITUACION_CARCELARIA sc
      ) s
     WHERE s.RN = 1
       AND s.ID_PERSONA IN (${targetPersonasSql()})
  `;
}

async function previewByActiveDefensor(defensor, { limit = 500 } = {}) {
  const targetSql = targetSituacionesSql();
  const summarySql = `
    SELECT
      (
        SELECT COUNT(*)
        FROM DNDP.GESTION_JURIDICA g
        WHERE g.ID_SITUACION IN (${targetSql})
      ) AS TOTAL_ACTUACIONES,
      (SELECT COUNT(*) FROM (${targetAssignmentsSql()})) AS TOTAL_ASIGNACIONES
    FROM dual
  `;
  const detailSql = `
    SELECT
      g.ID_GESTION,
      g.ID_SITUACION,
      TO_CHAR(p.NUMERO) AS DOCUMENTO,
      p.NOMBRE,
      g.FECHA_REGISTRO,
      g.ACTUACION_ADELANTAR
    FROM DNDP.GESTION_JURIDICA g
    JOIN DNDP.SITUACION_CARCELARIA s ON s.ID_SITUACION = g.ID_SITUACION
    JOIN DNDP.PERSONA p ON p.ID_PERSONA = s.ID_PERSONA
    WHERE g.ID_SITUACION IN (${targetSql})
    ORDER BY g.FECHA_REGISTRO DESC NULLS LAST, g.ID_GESTION DESC
    FETCH FIRST ${Math.max(1, Math.min(1000, Number(limit) || 500))} ROWS ONLY
  `;
  const binds = { defensor: String(defensor || '').trim() };
  const [summaryResult, detailResult] = await Promise.all([
    execute(summarySql, binds, { operation: 'actuacionCleanup.previewSummary' }),
    execute(detailSql, binds, { operation: 'actuacionCleanup.previewDetail' }),
  ]);
  const summary = Array.isArray(summaryResult?.rows) ? summaryResult.rows[0] : null;

  return {
    totalActuaciones: Number(summary?.TOTAL_ACTUACIONES || 0),
    totalPersonas: Number(summary?.TOTAL_ASIGNACIONES || 0),
    totalAsignaciones: Number(summary?.TOTAL_ASIGNACIONES || 0),
    actuaciones: Array.isArray(detailResult?.rows) ? detailResult.rows : [],
  };
}

async function deleteByActiveDefensor(defensor, expectedCount, expectedAssignments) {
  const targetSql = targetSituacionesSql();
  const assignmentsSql = targetAssignmentsSql();
  const sql = `
    DECLARE
      v_actuaciones NUMBER;
      v_asignaciones NUMBER;
    BEGIN
      SELECT COUNT(*)
        INTO v_actuaciones
        FROM DNDP.GESTION_JURIDICA g
       WHERE g.ID_SITUACION IN (${targetSql});

      SELECT COUNT(*)
        INTO v_asignaciones
        FROM (${assignmentsSql});

      IF v_actuaciones != :expectedCount OR v_asignaciones != :expectedAssignments THEN
        RAISE_APPLICATION_ERROR(-20001, 'Los registros cambiaron desde la vista previa');
      END IF;

      DELETE FROM DNDP.GESTION_JURIDICA g
       WHERE g.ID_SITUACION IN (${targetSql});

      IF SQL%ROWCOUNT != :expectedCount THEN
        RAISE_APPLICATION_ERROR(-20002, 'Cambio concurrente al eliminar actuaciones');
      END IF;

      DELETE FROM DNDP.ASIGNACION a
       WHERE a.ID_ASIGNACION IN (${assignmentsSql});

      IF SQL%ROWCOUNT != :expectedAssignments THEN
        RAISE_APPLICATION_ERROR(-20003, 'Cambio concurrente al eliminar asignaciones');
      END IF;
    END;
  `;
  await execute(
    sql,
    {
      defensor: String(defensor || '').trim(),
      expectedCount: Number(expectedCount),
      expectedAssignments: Number(expectedAssignments),
    },
    {
      autoCommit: true,
      operation: 'actuacionCleanup.deleteByActiveDefensor',
    }
  );
  return {
    deleted: Number(expectedCount),
    assignmentsDeleted: Number(expectedAssignments),
  };
}

module.exports = {
  previewByActiveDefensor,
  deleteByActiveDefensor,
};
