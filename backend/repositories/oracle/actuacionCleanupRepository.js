const { execute } = require('../../db/oraclePool');
const { normalizedSqlExpr } = require('./sqlFragments');

const DEFENSOR_ACTIVO_EXPR = 'COALESCE(TO_NCHAR(a.NOMBRE_DEFENSOR), TO_NCHAR(d.NOMBRE))';

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
      JOIN DNDP.PERSONA p
        ON p.ID_PERSONA = s.ID_PERSONA
      JOIN (
        SELECT
          aa.*,
          ROW_NUMBER() OVER (
            PARTITION BY aa.ID_PERSONA
            ORDER BY aa.FECHA_ASIGNACION DESC NULLS LAST, aa.ID_ASIGNACION DESC
          ) AS RN
        FROM DNDP.ASIGNACION aa
        WHERE aa.FECHA_FIN IS NULL
      ) a
        ON a.ID_PERSONA = p.ID_PERSONA
       AND a.RN = 1
      LEFT JOIN DNDP.DEFENSORES d
        ON d.CEDULA = a.CEDULA_DEFENSOR
     WHERE s.RN = 1
       AND ${normalizedSqlExpr(DEFENSOR_ACTIVO_EXPR)} = ${normalizedSqlExpr(':defensor')}
  `;
}

async function previewByActiveDefensor(defensor, { limit = 500 } = {}) {
  const targetSql = targetSituacionesSql();
  const summarySql = `
    SELECT
      COUNT(*) AS TOTAL_ACTUACIONES,
      COUNT(DISTINCT p.ID_PERSONA) AS TOTAL_PERSONAS
    FROM DNDP.GESTION_JURIDICA g
    JOIN DNDP.SITUACION_CARCELARIA s ON s.ID_SITUACION = g.ID_SITUACION
    JOIN DNDP.PERSONA p ON p.ID_PERSONA = s.ID_PERSONA
    WHERE g.ID_SITUACION IN (${targetSql})
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
    totalPersonas: Number(summary?.TOTAL_PERSONAS || 0),
    actuaciones: Array.isArray(detailResult?.rows) ? detailResult.rows : [],
  };
}

async function deleteByActiveDefensor(defensor, expectedCount) {
  const targetSql = targetSituacionesSql();
  const candidatesSql = `
    SELECT g2.ID_GESTION
      FROM DNDP.GESTION_JURIDICA g2
     WHERE g2.ID_SITUACION IN (${targetSql})
  `;
  const sql = `
    DELETE FROM DNDP.GESTION_JURIDICA g
     WHERE g.ID_GESTION IN (${candidatesSql})
       AND (SELECT COUNT(*) FROM (${candidatesSql})) = :expectedCount
  `;
  const result = await execute(
    sql,
    {
      defensor: String(defensor || '').trim(),
      expectedCount: Number(expectedCount),
    },
    {
      autoCommit: true,
      operation: 'actuacionCleanup.deleteByActiveDefensor',
    }
  );
  return Number(result?.rowsAffected || 0);
}

module.exports = {
  previewByActiveDefensor,
  deleteByActiveDefensor,
};
