const { execute } = require('../../db/oraclePool');
const personaRepo = require('./personaRepository');
const { normalizedMojibakeSqlExpr } = require('./sqlFragments');
const { normalizeSearchText } = require('../../utils/textNormalization');

const DEFENSOR_MATCH_SQL = `(
  TO_CHAR(a.CEDULA_DEFENSOR) = :defensorCedula
  OR (
    a.CEDULA_DEFENSOR IS NULL
    AND ${normalizedMojibakeSqlExpr('a.NOMBRE_DEFENSOR')} = :defensorNombre
  )
)`;

const EVENT_UNIONS = [
  ['analisis', 'g.FECHA_ANALISIS'],
  ['entrevista', 'g.FECHA_ENTREVISTA'],
  ['solicitud', 'g.FECHA_SOLICITUD_AUDIENCIA_CONTROL'],
  ['solicitud', 'g.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD'],
  ['solicitud', 'g.FECHA_RADICACION_UTILIDAD'],
  ['reiteracion', 'g.FECHA_INSISTENCIA_1'],
  ['reiteracion', 'g.FECHA_INSISTENCIA_2'],
  ['reiteracion', 'g.FECHA_INSISTENCIA_3'],
  ['reiteracion', 'g.FECHA_INSISTENCIA_4'],
  ['reiteracion', 'g.FECHA_INSISTENCIA_5'],
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
  OR g.FECHA_INSISTENCIA_3 IS NOT NULL
  OR g.FECHA_INSISTENCIA_4 IS NOT NULL
  OR g.FECHA_INSISTENCIA_5 IS NOT NULL
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
  return normalizeSearchText(value);
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
  return personaRepo.listAssignedCasesForReport(params);
}

module.exports = {
  listAvailableDefensores,
  listAvailableRegionales,
  listEvents,
  listAssignedCases,
  normalizeDefensorName,
  EVENT_UNIONS,
};
