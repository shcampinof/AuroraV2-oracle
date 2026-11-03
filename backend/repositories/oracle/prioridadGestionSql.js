// La prioridad se calcula sobre la atención vigente antes de contar y paginar.
// FECHA_REGISTRO es la apertura de la atención; editarla no reinicia el plazo.
function buildPrioridadGestionSelect(baseSelectSql) {
  const milestone = `CASE ESTADO_CODIGO
    WHEN 'ENTREVISTAR_USUARIO' THEN CAST("Fecha de analisis juridico del caso" AS DATE)
    WHEN 'PRESENTAR_SOLICITUD' THEN CAST("Fecha de entrevista" AS DATE)
    ELSE NULL
  END`;
  const baseline = `COALESCE(CAST(FECHA_INICIO_ATENCION AS DATE), CAST("Fecha de asignacion del PAG" AS DATE), ${milestone})`;
  const reference = `GREATEST(
    ${baseline},
    COALESCE(CAST("Fecha de asignacion del PAG" AS DATE), ${baseline}),
    COALESCE(${milestone}, ${baseline})
  )`;
  // ROWNUM impide fusionar esta vista: Oracle debe resolver el estado una vez,
  // sin expandir todo el cálculo jurídico en cada condición de prioridad.
  // Este ordinal interno no limita ni reordena las filas; la paginación ocurre después.
  return `SELECT /*+ NO_MERGE(dated_rows) */ dated_rows.*,
    CASE
      WHEN ESTADO_CODIGO IN ('SIN_ASIGNACION', 'CASO_CERRADO') THEN 'gris'
      WHEN ESTADO_CODIGO IN ('PENDIENTE_AUDIENCIA', 'PENDIENTE_DECISION_AUDIENCIA', 'PENDIENTE_DECISION') THEN 'azul'
      WHEN ESTADO_CODIGO = 'PRESENTAR_RECURSO' THEN 'rojo'
      WHEN DIAS_PRIORIDAD_GESTION IS NULL THEN 'sin_fecha'
      WHEN DIAS_PRIORIDAD_GESTION <= 15 THEN 'verde'
      WHEN DIAS_PRIORIDAD_GESTION <= 45 THEN 'amarillo'
      ELSE 'rojo'
    END AS PRIORIDAD_GESTION
    FROM (
      SELECT /*+ NO_MERGE(reference_rows) */ reference_rows.*,
        GREATEST(0, TRUNC(CAST(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota' AS DATE))
          - TRUNC(FECHA_REFERENCIA_GESTION)) AS DIAS_PRIORIDAD_GESTION
      FROM (
        SELECT /*+ NO_MERGE(base_rows) */ base_rows.*,
          CASE WHEN ESTADO_CODIGO IN ('ANALIZAR_CASO', 'ENTREVISTAR_USUARIO', 'PRESENTAR_SOLICITUD')
            THEN ${reference} ELSE NULL END AS FECHA_REFERENCIA_GESTION
        FROM (
          SELECT state_rows.*, ROWNUM AS PRIORIDAD_ROW_NUMBER
          FROM (${baseSelectSql}) state_rows
        ) base_rows
      ) reference_rows
    ) dated_rows`;
}

module.exports = { buildPrioridadGestionSelect };
