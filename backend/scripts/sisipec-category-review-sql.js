// El cargador Python consume la misma regla de cierre que Usuarios asignados.
// Generar SQL no abre conexiones ni instala objetos en Oracle.
const { buildGestionEstadoCodigoExpr } = require('../repositories/oracle/personaRepository');

function closedAssignedCasesSql() {
  return `SELECT p.NUMERO, s.ID_PERSONA, s.ID_SITUACION, s.CATEGORIZACION,
                 g.ID_GESTION, a.ID_ASIGNACION, a.NOMBRE_DEFENSOR,
                 a.CEDULA_DEFENSOR, a.NOMBRE_PAG, a.CEDULA_PAG
    FROM DNDP.SITUACION_CARCELARIA s
    JOIN DNDP.PERSONA p ON p.ID_PERSONA = s.ID_PERSONA
    JOIN DNDP.ASIGNACION a ON a.ID_PERSONA = s.ID_PERSONA AND a.FECHA_FIN IS NULL
    JOIN DNDP.GESTION_JURIDICA g ON g.ID_GESTION = (
      SELECT latest.ID_GESTION FROM DNDP.GESTION_JURIDICA latest
       WHERE latest.ID_SITUACION = s.ID_SITUACION
       ORDER BY latest.FECHA_REGISTRO DESC NULLS LAST, latest.ID_GESTION DESC
       FETCH FIRST 1 ROWS ONLY)
   WHERE s.ACTIVO = 1 AND TRIM(a.NOMBRE_DEFENSOR) IS NOT NULL
     AND UPPER(COALESCE(s.SITUACION_JURIDICA_ACTUALIZADA, s.SITUACION)) LIKE '%CONDENAD%'
     AND (${buildGestionEstadoCodigoExpr('TO_NCHAR(g.DEFENSOR_GESTION)')}) = 'CASO_CERRADO'`;
}

if (require.main === module) process.stdout.write(closedAssignedCasesSql());

module.exports = { closedAssignedCasesSql };
