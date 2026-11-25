const { buildGestionEstadoCodigoExpr } = require('../repositories/oracle/personaRepository');

function regionalCasesSql() {
  return `SELECT p.NUMERO, s.ID_PERSONA, s.ID_SITUACION, s.ESTABLECIMIENTO,
                 g.ID_GESTION, a.ID_ASIGNACION, a.FECHA_ASIGNACION,
                 (${buildGestionEstadoCodigoExpr('TO_NCHAR(g.DEFENSOR_GESTION)')}) AS ESTADO_CODIGO
    FROM DNDP.SITUACION_CARCELARIA s
    JOIN DNDP.PERSONA p ON p.ID_PERSONA = s.ID_PERSONA
    LEFT JOIN DNDP.GESTION_JURIDICA g ON g.ID_GESTION = (
      SELECT latest.ID_GESTION FROM DNDP.GESTION_JURIDICA latest
       WHERE latest.ID_SITUACION = s.ID_SITUACION
       ORDER BY latest.FECHA_REGISTRO DESC NULLS LAST, latest.ID_GESTION DESC
       FETCH FIRST 1 ROWS ONLY)
    LEFT JOIN DNDP.ASIGNACION a ON a.ID_ASIGNACION = (
      SELECT latest.ID_ASIGNACION FROM DNDP.ASIGNACION latest
       WHERE latest.ID_PERSONA = s.ID_PERSONA AND latest.FECHA_FIN IS NULL
       ORDER BY latest.FECHA_ASIGNACION DESC NULLS LAST, latest.ID_ASIGNACION DESC
       FETCH FIRST 1 ROWS ONLY)
   WHERE s.ACTIVO = 1
     AND UPPER(COALESCE(s.SITUACION_JURIDICA_ACTUALIZADA, s.SITUACION)) LIKE '%CONDENAD%'`;
}

if (require.main === module) process.stdout.write(regionalCasesSql());
module.exports = { regionalCasesSql };
