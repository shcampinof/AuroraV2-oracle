const { execute } = require('../../db/oraclePool');
const { buildGestionEstadoCodigoExpr } = require('./personaRepository');

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
          SELECT ID_GESTION, DEFENSOR_GESTION, GESTION_CERRADA, TIENE_HITOS
            INTO v_id_gestion, v_defensor_gestion, v_gestion_cerrada, v_gestion_con_hitos
            FROM (
              SELECT g.ID_GESTION,
                     g.DEFENSOR_GESTION,
                     CASE WHEN g.FECHA_ANALISIS IS NOT NULL OR g.RESUMEN_ANALISIS_CASO IS NOT NULL
                       OR g.FECHA_ENTREVISTA IS NOT NULL OR g.FECHA_SOLICITUD_AUDIENCIA_CONTROL IS NOT NULL
                       OR g.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD IS NOT NULL OR g.FECHA_RADICACION_UTILIDAD IS NOT NULL
                       OR g.FECHA_DECISION_AUTORIDAD IS NOT NULL OR g.FECHA_PRESENTACION_RECURSO IS NOT NULL
                       OR g.FECHA_DECISION_RECURSO IS NOT NULL THEN 1 ELSE 0 END AS TIENE_HITOS,
                     CASE WHEN (${buildGestionEstadoCodigoExpr('TO_NCHAR(g.DEFENSOR_GESTION)')}) = 'CASO_CERRADO'
                       THEN 1 ELSE 0 END AS GESTION_CERRADA
                FROM DNDP.GESTION_JURIDICA g
                JOIN DNDP.SITUACION_CARCELARIA s ON s.ID_SITUACION = g.ID_SITUACION
               WHERE g.ID_SITUACION = :idSituacion
               ORDER BY g.FECHA_REGISTRO DESC NULLS LAST, g.ID_GESTION DESC
            )
           WHERE ROWNUM = 1;

          -- Un autor legado ausente solo se completa con la asignación que
          -- todavía estaba vigente, antes de registrar el nuevo responsable.
          IF TRIM(v_defensor_gestion) IS NULL AND v_defensor_anterior IS NOT NULL THEN
            UPDATE DNDP.GESTION_JURIDICA
               SET DEFENSOR_GESTION = v_defensor_anterior,
                   ID_ASIGNACION_GESTION = NVL(ID_ASIGNACION_GESTION, v_id_anterior)
             WHERE ID_GESTION = v_id_gestion;
            v_defensor_gestion := v_defensor_anterior;
          END IF;
          IF v_gestion_cerrada = 1
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

async function endActiveAssignmentByPersona(idPersona) {
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

module.exports = {
  replaceActiveAssignmentByPersona,
  endActiveAssignmentByPersona,
};
