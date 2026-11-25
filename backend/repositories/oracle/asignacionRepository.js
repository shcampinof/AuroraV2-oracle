const { execute, getOracleDriver } = require('../../db/oraclePool');
const { buildGestionEstadoCodigoExpr } = require('./personaRepository');
const { buildGestionHasAnswersExpr } = require('./gestionProgressSql');

function normalizeCedula(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function cleanText(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || null;
}

async function replaceActiveAssignmentByPersona(
  idPersona,
  {
    defensorNombre = '',
    defensorCedula = '',
    pagCedula = '',
    pagNombre = '',
    idSituacion = null,
    idGestionCreada = null,
  } = {}
) {
  const cleanNombreDefensor = cleanText(defensorNombre);
  if (!cleanNombreDefensor) return 0;

  const sql = `
    DECLARE
      v_id_asignacion DNDP.ASIGNACION.ID_ASIGNACION%TYPE;
      v_id_anterior DNDP.ASIGNACION.ID_ASIGNACION%TYPE;
      v_defensor_anterior DNDP.ASIGNACION.NOMBRE_DEFENSOR%TYPE;
      v_cedula_anterior DNDP.ASIGNACION.CEDULA_DEFENSOR%TYPE;
      v_persona DNDP.PERSONA.ID_PERSONA%TYPE;
      v_situacion DNDP.SITUACION_CARCELARIA.ID_SITUACION%TYPE;
      v_max_asignacion DNDP.ASIGNACION.ID_ASIGNACION%TYPE;
      v_id_gestion DNDP.GESTION_JURIDICA.ID_GESTION%TYPE;
      v_defensor_gestion DNDP.GESTION_JURIDICA.DEFENSOR_GESTION%TYPE;
      v_gestion_cerrada NUMBER := 0;
      v_fecha_revision DNDP.GESTION_JURIDICA.NUEVA_FECHA_ANALISIS%TYPE;
      v_gestion_con_hitos NUMBER := 0;
      v_id_gestion_nueva DNDP.GESTION_JURIDICA.ID_GESTION%TYPE;
      v_max_gestion DNDP.GESTION_JURIDICA.ID_GESTION%TYPE;

      PROCEDURE insertar_gestion_defensor IS
      BEGIN
        BEGIN
          INSERT INTO DNDP.GESTION_JURIDICA (
            ID_SITUACION,
            DEFENSOR_GESTION,
            ID_ASIGNACION_GESTION,
            FECHA_REGISTRO
          ) VALUES (
            :idSituacion,
            :nombreDefensor,
            v_id_asignacion,
            SYSTIMESTAMP
          );
        EXCEPTION
          WHEN OTHERS THEN
            IF SQLCODE <> -1400 THEN
              RAISE;
            END IF;

            SELECT NVL(MAX(ID_GESTION), 0)
              INTO v_max_gestion
              FROM DNDP.GESTION_JURIDICA;

            LOOP
              SELECT DNDP.SEQ_GESTION.NEXTVAL
                INTO v_id_gestion_nueva
                FROM dual;
              EXIT WHEN v_id_gestion_nueva > v_max_gestion;
            END LOOP;

            INSERT INTO DNDP.GESTION_JURIDICA (
              ID_GESTION,
              ID_SITUACION,
              DEFENSOR_GESTION,
              ID_ASIGNACION_GESTION,
              FECHA_REGISTRO
            ) VALUES (
              v_id_gestion_nueva,
              :idSituacion,
              :nombreDefensor,
              v_id_asignacion,
              SYSTIMESTAMP
            );
        END;
      END insertar_gestion_defensor;
    BEGIN
      -- Serializa asignaciones de la misma persona y rechaza contextos obsoletos.
      SELECT ID_PERSONA INTO v_persona FROM DNDP.PERSONA
       WHERE ID_PERSONA = :idPersona FOR UPDATE;
      IF :idSituacion IS NOT NULL THEN
        SELECT ID_SITUACION INTO v_situacion FROM DNDP.SITUACION_CARCELARIA
         WHERE ID_SITUACION = :idSituacion AND ID_PERSONA = :idPersona AND ACTIVO = 1;
      END IF;
      BEGIN
        SELECT ID_ASIGNACION, NOMBRE_DEFENSOR, CEDULA_DEFENSOR
          INTO v_id_anterior, v_defensor_anterior, v_cedula_anterior
          FROM DNDP.ASIGNACION
         WHERE ID_PERSONA = :idPersona AND FECHA_FIN IS NULL;
      EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
      END;
      IF v_id_anterior IS NOT NULL AND (
        (:cedulaDefensor IS NOT NULL AND v_cedula_anterior = :cedulaDefensor)
        OR (:cedulaDefensor IS NULL AND UPPER(TRIM(v_defensor_anterior)) = UPPER(TRIM(:nombreDefensor)))
      ) THEN
        v_id_asignacion := v_id_anterior;
      ELSE
      UPDATE DNDP.ASIGNACION
         SET FECHA_FIN = SYSDATE
       WHERE ID_PERSONA = :idPersona
         AND FECHA_FIN IS NULL;

      -- Las cargas históricas pueden insertar IDs explícitos y dejar la
      -- secuencia por detrás del máximo real. Se consume la secuencia hasta
      -- obtener un ID nuevo, sin exigir una intervención manual al desplegar.
      SELECT NVL(MAX(ID_ASIGNACION), 0)
        INTO v_max_asignacion
        FROM DNDP.ASIGNACION;

      LOOP
        SELECT DNDP.SEQ_ASIGNACION.NEXTVAL
          INTO v_id_asignacion
          FROM dual;
        EXIT WHEN v_id_asignacion > v_max_asignacion;
      END LOOP;

      INSERT INTO DNDP.ASIGNACION (
        ID_ASIGNACION,
        ID_PERSONA,
        CEDULA_DEFENSOR,
        NOMBRE_DEFENSOR,
        CEDULA_PAG,
        NOMBRE_PAG,
        FECHA_ASIGNACION
      )
      VALUES (
        v_id_asignacion,
        :idPersona,
        :cedulaDefensor,
        :nombreDefensor,
        :cedulaPag,
        :nombrePag,
        SYSDATE
      );

      END IF;

      -- Cada gestión conserva su autor. Otra asignación abre una gestión vacía,
      -- sin copiar hitos ni cambiar al responsable de las gestiones anteriores.
      IF :idGestionCreada IS NOT NULL THEN
        UPDATE DNDP.GESTION_JURIDICA
           SET ID_ASIGNACION_GESTION = v_id_asignacion
         WHERE ID_GESTION = :idGestionCreada AND ID_SITUACION = :idSituacion
           AND UPPER(TRIM(DEFENSOR_GESTION)) = UPPER(TRIM(:nombreDefensor))
           AND ID_ASIGNACION_GESTION IS NULL;
        IF SQL%ROWCOUNT <> 1 THEN RAISE_APPLICATION_ERROR(-20001, 'La nueva gestion no corresponde a la asignacion.'); END IF;
      ELSIF :idSituacion IS NOT NULL THEN
        BEGIN
          SELECT ID_GESTION, DEFENSOR_GESTION, GESTION_CERRADA, TIENE_HITOS, NUEVA_FECHA_ANALISIS
            INTO v_id_gestion, v_defensor_gestion, v_gestion_cerrada, v_gestion_con_hitos, v_fecha_revision
            FROM (
              SELECT g.ID_GESTION,
                     g.DEFENSOR_GESTION,
                     g.NUEVA_FECHA_ANALISIS,
                     (${buildGestionHasAnswersExpr()}) AS TIENE_HITOS,
                     CASE WHEN (${buildGestionEstadoCodigoExpr('TO_NCHAR(g.DEFENSOR_GESTION)')}) = 'CASO_CERRADO'
                       THEN 1 ELSE 0 END AS GESTION_CERRADA
                FROM DNDP.GESTION_JURIDICA g
                JOIN DNDP.SITUACION_CARCELARIA s ON s.ID_SITUACION = g.ID_SITUACION
               WHERE g.ID_SITUACION = :idSituacion
               ORDER BY g.FECHA_REGISTRO DESC NULLS LAST, g.ID_GESTION DESC
            )
           WHERE ROWNUM = 1;

          IF v_gestion_con_hitos = 0 THEN
            -- Una gestión sin respuestas se reutiliza incluso al cambiar de
            -- defensor. El historial de asignaciones conserva la trazabilidad.
            UPDATE DNDP.GESTION_JURIDICA
               SET DEFENSOR_GESTION = :nombreDefensor,
                   ID_ASIGNACION_GESTION = v_id_asignacion,
                   ACCION_REALIZAR = 'Analizar el caso'
             WHERE ID_GESTION = v_id_gestion
               AND (TRIM(v_defensor_gestion) IS NULL OR v_id_anterior IS NULL
                 OR v_id_anterior <> v_id_asignacion
                 OR UPPER(TRIM(v_defensor_gestion)) <> UPPER(TRIM(:nombreDefensor)));
          ELSE
          -- Un autor legado ausente solo se completa con la asignación que
          -- todavía estaba vigente, antes de registrar el nuevo responsable.
          IF TRIM(v_defensor_gestion) IS NULL AND v_defensor_anterior IS NOT NULL THEN
            UPDATE DNDP.GESTION_JURIDICA
               SET DEFENSOR_GESTION = v_defensor_anterior,
                   ID_ASIGNACION_GESTION = NVL(ID_ASIGNACION_GESTION, v_id_anterior)
             WHERE ID_GESTION = v_id_gestion;
            v_defensor_gestion := v_defensor_anterior;
          END IF;
          IF (v_gestion_cerrada = 1 AND v_fecha_revision IS NULL)
             OR (TRIM(v_defensor_gestion) IS NULL AND v_gestion_con_hitos = 1)
             OR (TRIM(v_defensor_gestion) IS NOT NULL AND (
               v_id_anterior IS NULL OR v_id_anterior <> v_id_asignacion
               OR UPPER(TRIM(v_defensor_gestion)) <> UPPER(TRIM(:nombreDefensor))
             )) THEN
            insertar_gestion_defensor;
          ELSIF TRIM(v_defensor_gestion) IS NULL THEN
            UPDATE DNDP.GESTION_JURIDICA
               SET DEFENSOR_GESTION = NVL(DEFENSOR_GESTION, :nombreDefensor),
                   ID_ASIGNACION_GESTION = NVL(ID_ASIGNACION_GESTION, v_id_asignacion)
             WHERE ID_GESTION = v_id_gestion;
          END IF;
          END IF;
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            insertar_gestion_defensor;
        END;
      END IF;
    END;
  `;

  await execute(
    sql,
    {
      idPersona: Number(idPersona),
      idGestionCreada: Number(idGestionCreada) > 0 ? Number(idGestionCreada) : null,
      cedulaDefensor: normalizeCedula(defensorCedula) || null,
      nombreDefensor: cleanNombreDefensor,
      cedulaPag: normalizeCedula(pagCedula) || null,
      nombrePag: cleanText(pagNombre),
      idSituacion: Number.isFinite(Number(idSituacion)) && Number(idSituacion) !== 0
        ? Number(idSituacion)
        : null,
    },
    {
      autoCommit: true,
      operation: 'asignacion.replaceActiveAssignmentByPersona',
    }
  );

  return 1;
}

async function endActiveAssignmentByPersona(idPersona, { idSituacion = null } = {}) {
  if (idSituacion !== null) return unassignGestionByPersona(idPersona, idSituacion);
  const sql = `
    UPDATE DNDP.ASIGNACION
       SET FECHA_FIN = SYSDATE
     WHERE ID_PERSONA = :idPersona
       AND FECHA_FIN IS NULL
  `;

  const result = await execute(
    sql,
    { idPersona: Number(idPersona) },
    {
      autoCommit: true,
      operation: 'asignacion.endActiveAssignmentByPersona',
    }
  );

  return Number(result?.rowsAffected || 0);
}

async function unassignGestionByPersona(idPersona, idSituacion) {
  const driver = getOracleDriver();
  const result = await execute(`DECLARE
    v_persona NUMBER;
    v_situacion NUMBER;
    v_asignacion NUMBER;
    v_defensor DNDP.ASIGNACION.NOMBRE_DEFENSOR%TYPE;
    v_gestion NUMBER;
    v_con_respuestas NUMBER;
    v_id NUMBER;
    v_max NUMBER;
  BEGIN
    :updated := 0;
    SELECT ID_PERSONA INTO v_persona FROM DNDP.PERSONA WHERE ID_PERSONA=:idPersona FOR UPDATE;
    SELECT ID_SITUACION INTO v_situacion FROM DNDP.SITUACION_CARCELARIA
      WHERE ID_SITUACION=:idSituacion AND ID_PERSONA=:idPersona AND ACTIVO=1 FOR UPDATE;
    BEGIN
      SELECT ID_ASIGNACION, NOMBRE_DEFENSOR INTO v_asignacion, v_defensor FROM DNDP.ASIGNACION
        WHERE ID_PERSONA=:idPersona AND FECHA_FIN IS NULL FOR UPDATE;
    EXCEPTION WHEN NO_DATA_FOUND THEN v_asignacion := NULL;
    END;
    IF v_asignacion IS NOT NULL THEN
      BEGIN
        SELECT ID_GESTION, (${buildGestionHasAnswersExpr()}) INTO v_gestion, v_con_respuestas
          FROM DNDP.GESTION_JURIDICA g WHERE ID_GESTION=(
            SELECT latest.ID_GESTION FROM DNDP.GESTION_JURIDICA latest
              WHERE latest.ID_SITUACION=:idSituacion
              ORDER BY latest.FECHA_REGISTRO DESC NULLS LAST, latest.ID_GESTION DESC
              FETCH FIRST 1 ROWS ONLY) FOR UPDATE;
      EXCEPTION WHEN NO_DATA_FOUND THEN v_gestion := NULL;
      END;
      UPDATE DNDP.ASIGNACION SET FECHA_FIN=SYSDATE WHERE ID_ASIGNACION=v_asignacion;
      IF v_gestion IS NOT NULL AND v_con_respuestas=0 THEN
        UPDATE DNDP.GESTION_JURIDICA SET DEFENSOR_GESTION=NULL, ID_ASIGNACION_GESTION=NULL,
          ACCION_REALIZAR='Sin asignación' WHERE ID_GESTION=v_gestion;
      ELSE
        -- Conservar la autoría de una gestión avanzada, también si es legada.
        UPDATE DNDP.GESTION_JURIDICA SET
          ID_ASIGNACION_GESTION=CASE WHEN TRIM(DEFENSOR_GESTION) IS NULL
            THEN NVL(ID_ASIGNACION_GESTION, v_asignacion) ELSE ID_ASIGNACION_GESTION END,
          DEFENSOR_GESTION=NVL(DEFENSOR_GESTION, v_defensor)
          WHERE ID_GESTION=v_gestion;
        SELECT NVL(MAX(ID_GESTION),0) INTO v_max FROM DNDP.GESTION_JURIDICA;
        LOOP
          SELECT DNDP.SEQ_GESTION.NEXTVAL INTO v_id FROM dual;
          EXIT WHEN v_id > v_max;
        END LOOP;
        INSERT INTO DNDP.GESTION_JURIDICA (ID_GESTION, ID_SITUACION, FECHA_REGISTRO, ACCION_REALIZAR)
          VALUES (v_id, :idSituacion, SYSTIMESTAMP, 'Sin asignación');
      END IF;
      :updated := 1;
    END IF;
  END;`, {
    idPersona: Number(idPersona), idSituacion: Number(idSituacion),
    updated: { dir: driver.BIND_OUT, type: driver.NUMBER },
  }, { autoCommit: true, operation: 'asignacion.unassignGestionByPersona' });
  return Number(result?.outBinds?.updated || 0);
}

module.exports = {
  replaceActiveAssignmentByPersona,
  endActiveAssignmentByPersona,
};
