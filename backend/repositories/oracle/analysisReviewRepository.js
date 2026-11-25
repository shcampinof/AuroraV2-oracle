const db = require('../../db/oraclePool');
const { normalizedMojibakeSqlExpr } = require('./sqlFragments');
const { buildAutomaticBlock3ClosureSql } = require('./auroraCaseClosuresSql');
const { buildGestionEstadoCodigoExpr } = require('./personaRepository');

function reviewCondition() {
  const answer = column => `REGEXP_REPLACE(NVL(${normalizedMojibakeSqlExpr(`g.${column}`)}, '-'), '^[0-9]+[^A-Z]*', '')`;
  const negative = column => `(${answer(column)} = 'NO' OR ${answer(column)} LIKE 'NO APLICA%' OR ${answer(column)} LIKE 'NO CUMPLE%')`;
  return `
    ${['LIBERTAD_CONDICIONAL', 'PRISION_DOMICILIARIA_MITAD_PENA',
      'PROCEDENCIA_PENA_CUMPLIDA', 'PROCEDENCIA_ACUMULACION_PENAS'].map(negative).join(' AND ')}
    AND (${answer('UTILIDAD_PUBLICA')} IN ('-', '--') OR ${negative('UTILIDAD_PUBLICA')})
    AND ${answer('OTRAS_SOLICITUDES_TRAMITAR')} IN ('NINGUNA', '["NINGUNA"]')
    AND ${answer('CIERRE_CASO')} IN ('-', '--')
    AND (${buildAutomaticBlock3ClosureSql()}) IS NULL
    AND g.FECHA_ANALISIS IS NOT NULL
    AND (${buildGestionEstadoCodigoExpr('TO_NCHAR(g.DEFENSOR_GESTION)')}) = 'CASO_CERRADO'
    AND UPPER(NVL(s.SITUACION_JURIDICA_ACTUALIZADA, NVL(s.SITUACION, '-'))) NOT LIKE '%SINDICAD%'
  `;
}

function eligibleCondition() {
  return `${reviewCondition()}
    AND s.ACTIVO = 1
    AND TRIM(g.DEFENSOR_GESTION) IS NOT NULL
    AND g.NUEVA_FECHA_ANALISIS <= TO_DATE(:today, 'YYYY-MM-DD')
    AND a.FECHA_FIN IS NULL
    AND UPPER(TRIM(a.NOMBRE_DEFENSOR)) = UPPER(TRIM(g.DEFENSOR_GESTION))
    AND (g.ID_ASIGNACION_GESTION = a.ID_ASIGNACION OR g.ID_ASIGNACION_GESTION IS NULL)
    AND NOT EXISTS (SELECT 1 FROM DNDP.GESTION_JURIDICA child WHERE child.ID_GESTION_ORIGEN = g.ID_GESTION)
    AND NOT EXISTS (
      SELECT 1 FROM DNDP.GESTION_JURIDICA newer WHERE newer.ID_SITUACION = g.ID_SITUACION
      AND (NVL(newer.FECHA_REGISTRO, TIMESTAMP '1900-01-01 00:00:00') > NVL(g.FECHA_REGISTRO, TIMESTAMP '1900-01-01 00:00:00')
        OR (NVL(newer.FECHA_REGISTRO, TIMESTAMP '1900-01-01 00:00:00') = NVL(g.FECHA_REGISTRO, TIMESTAMP '1900-01-01 00:00:00')
          AND newer.ID_GESTION > g.ID_GESTION)))`;
}

async function createDueReviews(today) {
  const driver = db.getOracleDriver();
  const eligible = eligibleCondition();
  // La fila de persona serializa este proceso con las reasignaciones PAG.
  // La relectura tras el bloqueo y el índice único protegen varios servidores.
  const result = await db.execute(`DECLARE
    v_locked NUMBER;
    v_count NUMBER;
    v_created NUMBER := 0;
    v_id NUMBER;
    v_max NUMBER;
    v_source DNDP.GESTION_JURIDICA%ROWTYPE;
  BEGIN
    FOR candidate IN (
      SELECT g.ID_GESTION, s.ID_PERSONA, s.ID_SITUACION, a.ID_ASIGNACION
        FROM DNDP.GESTION_JURIDICA g
        JOIN DNDP.SITUACION_CARCELARIA s ON s.ID_SITUACION = g.ID_SITUACION
        JOIN DNDP.ASIGNACION a ON a.ID_PERSONA = s.ID_PERSONA
       WHERE ${eligible}
       ORDER BY g.NUEVA_FECHA_ANALISIS, g.ID_GESTION
       FETCH FIRST 100 ROWS ONLY
    ) LOOP
      SELECT ID_PERSONA INTO v_locked FROM DNDP.PERSONA WHERE ID_PERSONA = candidate.ID_PERSONA FOR UPDATE;
      SELECT ID_SITUACION INTO v_locked FROM DNDP.SITUACION_CARCELARIA
        WHERE ID_SITUACION = candidate.ID_SITUACION FOR UPDATE;
      SELECT * INTO v_source FROM DNDP.GESTION_JURIDICA
        WHERE ID_GESTION = candidate.ID_GESTION FOR UPDATE;
      SELECT COUNT(*) INTO v_count FROM DNDP.GESTION_JURIDICA g
        JOIN DNDP.SITUACION_CARCELARIA s ON s.ID_SITUACION = g.ID_SITUACION
        JOIN DNDP.ASIGNACION a ON a.ID_PERSONA = s.ID_PERSONA
        WHERE g.ID_GESTION = candidate.ID_GESTION AND a.ID_ASIGNACION = candidate.ID_ASIGNACION AND ${eligible};
      IF v_count = 1 THEN
        BEGIN
          INSERT INTO DNDP.GESTION_JURIDICA
            (ID_SITUACION, DEFENSOR_GESTION, ID_ASIGNACION_GESTION, ID_GESTION_ORIGEN, FECHA_REGISTRO, ACCION_REALIZAR)
          VALUES (v_source.ID_SITUACION, v_source.DEFENSOR_GESTION, candidate.ID_ASIGNACION,
            v_source.ID_GESTION, SYSTIMESTAMP, 'Analizar el caso');
        EXCEPTION WHEN OTHERS THEN
          IF SQLCODE <> -1400 THEN RAISE; END IF;
          SELECT NVL(MAX(ID_GESTION), 0) INTO v_max FROM DNDP.GESTION_JURIDICA;
          LOOP
            SELECT DNDP.SEQ_GESTION.NEXTVAL INTO v_id FROM dual;
            EXIT WHEN v_id > v_max;
          END LOOP;
          INSERT INTO DNDP.GESTION_JURIDICA
            (ID_GESTION, ID_SITUACION, DEFENSOR_GESTION, ID_ASIGNACION_GESTION, ID_GESTION_ORIGEN, FECHA_REGISTRO, ACCION_REALIZAR)
          VALUES (v_id, v_source.ID_SITUACION, v_source.DEFENSOR_GESTION, candidate.ID_ASIGNACION,
            v_source.ID_GESTION, SYSTIMESTAMP, 'Analizar el caso');
        END;
        v_created := v_created + 1;
      END IF;
    END LOOP;
    :created := v_created;
  END;`, {
    today,
    created: { dir: driver.BIND_OUT, type: driver.NUMBER },
  }, { autoCommit: true, operation: 'analysisReview.createDueReviews' });
  return Number(result?.outBinds?.created || 0);
}

module.exports = { createDueReviews, reviewCondition };
