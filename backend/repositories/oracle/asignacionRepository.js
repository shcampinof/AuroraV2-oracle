const { execute } = require('../../db/oraclePool');

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
  } = {}
) {
  const cleanNombreDefensor = cleanText(defensorNombre);
  if (!cleanNombreDefensor) return 0;

  const sql = `
    DECLARE
      v_id_asignacion DNDP.ASIGNACION.ID_ASIGNACION%TYPE;
      v_max_asignacion DNDP.ASIGNACION.ID_ASIGNACION%TYPE;
      v_id_gestion DNDP.GESTION_JURIDICA.ID_GESTION%TYPE;
      v_defensor_gestion DNDP.GESTION_JURIDICA.DEFENSOR_GESTION%TYPE;
      v_gestion_cerrada NUMBER := 0;
      v_id_gestion_nueva DNDP.GESTION_JURIDICA.ID_GESTION%TYPE;
      v_max_gestion DNDP.GESTION_JURIDICA.ID_GESTION%TYPE;

      PROCEDURE insertar_gestion_defensor IS
      BEGIN
        BEGIN
          INSERT INTO DNDP.GESTION_JURIDICA (
            ID_SITUACION,
            DEFENSOR_GESTION,
            FECHA_REGISTRO
          ) VALUES (
            :idSituacion,
            :nombreDefensor,
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
              FECHA_REGISTRO
            ) VALUES (
              v_id_gestion_nueva,
              :idSituacion,
              :nombreDefensor,
              SYSTIMESTAMP
            );
        END;
      END insertar_gestion_defensor;
    BEGIN
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

      -- La asignacion vigente y su historial viven en ASIGNACION. Mientras la
      -- gestion siga abierta, una reasignacion actualiza su responsable sin
      -- crear otra gestion. Solo una gestion cerrada obliga a abrir una nueva.
      IF :idSituacion IS NOT NULL THEN
        BEGIN
          SELECT ID_GESTION, DEFENSOR_GESTION, GESTION_CERRADA
            INTO v_id_gestion, v_defensor_gestion, v_gestion_cerrada
            FROM (
              SELECT ID_GESTION,
                     DEFENSOR_GESTION,
                     CASE
                       WHEN NVL(TRIM(TO_CHAR(CIERRE_CASO)), '-') NOT IN ('-', '--')
                         OR UPPER(TRIM(TO_CHAR(ACCION_REALIZAR))) LIKE 'CASO CERRADO%'
                       THEN 1
                       ELSE 0
                     END AS GESTION_CERRADA
                FROM DNDP.GESTION_JURIDICA
               WHERE ID_SITUACION = :idSituacion
               ORDER BY FECHA_REGISTRO DESC NULLS LAST, ID_GESTION DESC
            )
           WHERE ROWNUM = 1;

          IF v_gestion_cerrada = 1 THEN
            insertar_gestion_defensor;
          ELSIF TRIM(v_defensor_gestion) IS NULL
             OR UPPER(TRIM(v_defensor_gestion)) <> UPPER(TRIM(:nombreDefensor)) THEN
            UPDATE DNDP.GESTION_JURIDICA
               SET DEFENSOR_GESTION = :nombreDefensor
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
      cedulaDefensor: normalizeCedula(defensorCedula) || null,
      nombreDefensor: cleanNombreDefensor,
      cedulaPag: normalizeCedula(pagCedula) || null,
      nombrePag: cleanText(pagNombre),
      idSituacion: Number.isFinite(Number(idSituacion)) && Number(idSituacion) > 0
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
