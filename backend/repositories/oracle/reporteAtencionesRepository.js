const { execute } = require('../../db/oraclePool');

const DEFENSOR_MATCH_SQL = `(
  TO_CHAR(a.CEDULA_DEFENSOR) = :defensorCedula
  OR (
    a.CEDULA_DEFENSOR IS NULL
    AND TRANSLATE(UPPER(TRIM(a.NOMBRE_DEFENSOR)), 'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑ', 'AEIOUAEIOUAEIOUN') = :defensorNombre
  )
)`;

const CASE_CLOSED_SQL = `(
  NVL(s.ACTIVO, 0) = 0
  OR TRIM(TO_CHAR(g.CIERRE_CASO)) NOT IN ('-', '--')
  OR UPPER(NVL(TO_CHAR(g.ACCION_REALIZAR), '')) LIKE '%CASO CERRADO%'
  OR UPPER(NVL(TO_CHAR(g.ACTUACION_ADELANTAR), '')) LIKE '%CASO CERRADO%'
)`;

const EVENT_UNIONS = [
  ['analisis', 'g.FECHA_ANALISIS'],
  ['entrevista', 'g.FECHA_ENTREVISTA'],
  ['solicitud', 'g.FECHA_SOLICITUD_AUDIENCIA_CONTROL'],
  ['solicitud', 'g.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD'],
  ['solicitud', 'g.FECHA_RADICACION_UTILIDAD'],
  ['reiteracion', 'g.FECHA_INSISTENCIA_1'],
  ['reiteracion', 'g.FECHA_INSISTENCIA_2'],
  ['recurso', 'COALESCE(g.FECHA_PRESENTACION_RECURSO, g.FECHA_RECURSO_DESFAVORABLE)'],
  [
    'cierre',
    `COALESCE(
      g.FECHA_DECISION_RECURSO,
      g.FECHA_DECISION_AUTORIDAD,
      g.FECHA_PRESENTACION_RECURSO,
      g.FECHA_RECURSO_DESFAVORABLE,
      g.FECHA_ENTREVISTA,
      g.FECHA_ANALISIS,
      g.FECHA_REGISTRO
    )`,
  ],
];

const HAS_REPORT_ACTIVITY_SQL = `(
  g.FECHA_ANALISIS IS NOT NULL
  OR g.FECHA_ENTREVISTA IS NOT NULL
  OR g.FECHA_SOLICITUD_AUDIENCIA_CONTROL IS NOT NULL
  OR g.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD IS NOT NULL
  OR g.FECHA_RADICACION_UTILIDAD IS NOT NULL
  OR g.FECHA_INSISTENCIA_1 IS NOT NULL
  OR g.FECHA_INSISTENCIA_2 IS NOT NULL
  OR g.FECHA_PRESENTACION_RECURSO IS NOT NULL
  OR g.FECHA_RECURSO_DESFAVORABLE IS NOT NULL
  OR TRIM(TO_CHAR(g.CIERRE_CASO)) NOT IN ('-', '--')
  OR UPPER(NVL(TO_CHAR(g.ACCION_REALIZAR), '')) LIKE '%CASO CERRADO%'
  OR UPPER(NVL(TO_CHAR(g.ACTUACION_ADELANTAR), '')) LIKE '%CASO CERRADO%'
)`;

function buildEventSelect(tipo, dateExpression) {
  const closureCondition = tipo === 'cierre'
    ? `AND (
        TRIM(TO_CHAR(g.CIERRE_CASO)) NOT IN ('-', '--')
        OR UPPER(NVL(TO_CHAR(g.ACCION_REALIZAR), '')) LIKE '%CASO CERRADO%'
        OR UPPER(NVL(TO_CHAR(g.ACTUACION_ADELANTAR), '')) LIKE '%CASO CERRADO%'
      )`
    : '';

  return `
    SELECT
      '${tipo}' AS TIPO,
      g.ID_GESTION,
      s.ID_SITUACION,
      p.ID_PERSONA,
      TO_CHAR(p.NOMBRE) AS NOMBRE_USUARIO,
      TO_CHAR(p.NUMERO) AS IDENTIFICACION,
      COALESCE(
        NULLIF(TRIM(TO_CHAR(s.ESTABLECIMIENTO)), ''),
        NULLIF(TRIM(TO_CHAR(s.LUGAR_PRIVACION)), ''),
        'Sin información'
      ) AS LUGAR_PRIVACION,
      ${dateExpression} AS FECHA
    FROM DNDP.GESTION_JURIDICA g
    JOIN DNDP.SITUACION_CARCELARIA s ON s.ID_SITUACION = g.ID_SITUACION
    JOIN DNDP.PERSONA p ON p.ID_PERSONA = s.ID_PERSONA
    WHERE ${dateExpression} IS NOT NULL
      ${closureCondition}
  `;
}

function normalizeDefensorName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function reportBinds({ fechaInicio, fechaFin, defensorCedula, defensorNombre }) {
  return {
    fechaInicio,
    fechaFin,
    defensorCedula: String(defensorCedula || '').replace(/\D+/g, ''),
    defensorNombre: normalizeDefensorName(defensorNombre),
  };
}

async function listAvailableDefensores() {
  const sql = `
    SELECT DISTINCT
      TO_CHAR(a.CEDULA_DEFENSOR) AS CEDULA,
      TRIM(COALESCE(d.NOMBRE, a.NOMBRE_DEFENSOR)) AS NOMBRE,
      TRIM(d.REGIONAL) AS REGIONAL,
      TRIM(d.CORREO) AS CORREO
    FROM DNDP.ASIGNACION a
    LEFT JOIN DNDP.DEFENSORES d ON d.CEDULA = a.CEDULA_DEFENSOR
    WHERE TRIM(COALESCE(d.NOMBRE, a.NOMBRE_DEFENSOR)) IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM DNDP.SITUACION_CARCELARIA s
        JOIN DNDP.GESTION_JURIDICA g ON g.ID_SITUACION = s.ID_SITUACION
        WHERE s.ID_PERSONA = a.ID_PERSONA
          AND ${HAS_REPORT_ACTIVITY_SQL}
      )
    ORDER BY NOMBRE, CEDULA
  `;
  const result = await execute(sql, {}, { operation: 'reportes.atenciones.listAvailableDefensores' });
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function listAvailableRegionales() {
  const sql = `
    SELECT REGIONAL
    FROM (
      SELECT DISTINCT TRIM(TO_CHAR(r.REGIONAL)) AS REGIONAL
      FROM DNDP.REGIONALES r
      WHERE TRIM(TO_CHAR(r.REGIONAL)) IS NOT NULL
      UNION
      SELECT DISTINCT TRIM(TO_CHAR(d.REGIONAL)) AS REGIONAL
      FROM DNDP.DEFENSORES d
      WHERE TRIM(TO_CHAR(d.REGIONAL)) IS NOT NULL
    )
    ORDER BY REGIONAL
  `;
  const result = await execute(sql, {}, { operation: 'reportes.atenciones.listAvailableRegionales' });
  return (Array.isArray(result?.rows) ? result.rows : [])
    .map((row) => String(row?.REGIONAL || '').trim())
    .filter(Boolean);
}

async function listEvents(params) {
  const sql = `
    WITH eventos AS (
      ${EVENT_UNIONS.map(([tipo, dateExpression]) => buildEventSelect(tipo, dateExpression)).join('\nUNION ALL\n')}
    )
    SELECT
      e.TIPO,
      e.ID_GESTION,
      e.ID_SITUACION,
      e.ID_PERSONA,
      e.NOMBRE_USUARIO,
      e.IDENTIFICACION,
      e.LUGAR_PRIVACION,
      TO_CHAR(e.FECHA, 'YYYY-MM-DD') AS FECHA
    FROM eventos e
    WHERE e.FECHA >= TO_DATE(:fechaInicio, 'YYYY-MM-DD')
      AND e.FECHA < TO_DATE(:fechaFin, 'YYYY-MM-DD') + 1
      AND EXISTS (
        SELECT 1
        FROM DNDP.ASIGNACION a
        WHERE a.ID_PERSONA = e.ID_PERSONA
          AND ${DEFENSOR_MATCH_SQL}
          AND e.FECHA >= TRUNC(a.FECHA_ASIGNACION)
          AND (a.FECHA_FIN IS NULL OR e.FECHA < TRUNC(a.FECHA_FIN) + 1)
      )
    ORDER BY e.TIPO, e.FECHA, e.NOMBRE_USUARIO, e.IDENTIFICACION
  `;

  const result = await execute(sql, reportBinds(params), { operation: 'reportes.atenciones.listEvents' });
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function listAssignedCases(params) {
  const sql = `
    WITH current_assignment AS (
      SELECT selected.*
      FROM (
        SELECT
          a.*,
          ROW_NUMBER() OVER (
            PARTITION BY a.ID_PERSONA
            ORDER BY a.FECHA_ASIGNACION DESC NULLS LAST, a.ID_ASIGNACION DESC
          ) AS RN
        FROM DNDP.ASIGNACION a
        WHERE a.FECHA_FIN IS NULL
          AND ${DEFENSOR_MATCH_SQL}
      ) selected
      WHERE selected.RN = 1
    ),
    latest_situacion AS (
      SELECT selected.*
      FROM (
        SELECT
          s.*,
          ROW_NUMBER() OVER (
            PARTITION BY s.ID_PERSONA
            ORDER BY
              COALESCE(s.FECHA_CORTE, CAST(s.FECHA_REGISTRO AS DATE), s.FECHA_CAPTURA) DESC NULLS LAST,
              s.FECHA_REGISTRO DESC NULLS LAST,
              s.ID_SITUACION DESC
          ) AS RN
        FROM DNDP.SITUACION_CARCELARIA s
      ) selected
      WHERE selected.RN = 1
    ),
    latest_gestion AS (
      SELECT selected.*
      FROM (
        SELECT
          g.*,
          ROW_NUMBER() OVER (
            PARTITION BY g.ID_SITUACION
            ORDER BY g.FECHA_REGISTRO DESC NULLS LAST, g.ID_GESTION DESC
          ) AS RN
        FROM DNDP.GESTION_JURIDICA g
      ) selected
      WHERE selected.RN = 1
    )
    SELECT
      p.ID_PERSONA,
      TO_CHAR(p.NOMBRE) AS NOMBRE_USUARIO,
      TO_CHAR(p.NUMERO) AS IDENTIFICACION,
      COALESCE(
        NULLIF(TRIM(TO_CHAR(s.ESTABLECIMIENTO)), ''),
        NULLIF(TRIM(TO_CHAR(s.LUGAR_PRIVACION)), ''),
        'Sin información'
      ) AS LUGAR_PRIVACION,
      CASE
        WHEN ${CASE_CLOSED_SQL} THEN 'Caso cerrado'
        WHEN TRIM(TO_CHAR(g.ACCION_REALIZAR)) IS NOT NULL THEN TRIM(TO_CHAR(g.ACCION_REALIZAR))
        WHEN TRIM(TO_CHAR(g.ACTUACION_ADELANTAR)) IS NOT NULL THEN TRIM(TO_CHAR(g.ACTUACION_ADELANTAR))
        ELSE 'Analizar el caso'
      END AS ESTADO,
      CASE WHEN ${CASE_CLOSED_SQL} THEN 0 ELSE 1 END AS ACTIVO
    FROM current_assignment a
    JOIN DNDP.PERSONA p ON p.ID_PERSONA = a.ID_PERSONA
    LEFT JOIN latest_situacion s ON s.ID_PERSONA = p.ID_PERSONA
    LEFT JOIN latest_gestion g ON g.ID_SITUACION = s.ID_SITUACION
    ORDER BY p.NOMBRE, p.NUMERO
  `;

  const binds = reportBinds(params);
  const result = await execute(
    sql,
    { defensorCedula: binds.defensorCedula, defensorNombre: binds.defensorNombre },
    { operation: 'reportes.atenciones.listAssignedCases' }
  );
  return Array.isArray(result?.rows) ? result.rows : [];
}

module.exports = {
  listAvailableDefensores,
  listAvailableRegionales,
  listEvents,
  listAssignedCases,
  normalizeDefensorName,
  EVENT_UNIONS,
};
