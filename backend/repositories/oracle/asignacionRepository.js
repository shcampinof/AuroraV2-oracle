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
  } = {}
) {
  const cleanNombreDefensor = cleanText(defensorNombre);
  if (!cleanNombreDefensor) return 0;

  const sql = `
    BEGIN
      UPDATE DNDP.ASIGNACION
         SET FECHA_FIN = SYSDATE
       WHERE ID_PERSONA = :idPersona
         AND FECHA_FIN IS NULL;

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
        DNDP.SEQ_ASIGNACION.NEXTVAL,
        :idPersona,
        :cedulaDefensor,
        :nombreDefensor,
        :cedulaPag,
        :nombrePag,
        SYSDATE
      );
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
