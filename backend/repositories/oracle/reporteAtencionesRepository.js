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

// Los hitos sin autor original comprobable usan una sola asignación histórica. La primera
// también cubre las actuaciones importadas anteriores a su alta técnica.
const EVENT_ASSIGNMENT_SCOPE_SQL = `(
  (a.ORDEN = 1 OR e.FECHA >= TRUNC(a.FECHA_ASIGNACION))
  AND (a.FECHA_FIN IS NULL OR e.FECHA < TRUNC(a.FECHA_FIN) + 1)
)`;

const GESTION_CLOSED_SQL = `(${personaRepo.buildGestionEstadoCodigoExpr('TO_NCHAR(g.DEFENSOR_GESTION)')} = 'CASO_CERRADO')`;

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

function buildEventBaseSelect(filtersSql) {
  const dateColumns = EVENT_UNIONS.map(([tipo, dateExpression], index) => {
    const value = tipo === 'cierre' ? `CASE WHEN ${GESTION_CLOSED_SQL} THEN ${dateExpression} END` : dateExpression;
    return `CAST(${value} AS DATE) AS FECHA_EVENTO_${index}`;
  });
  return `
    SELECT /*+ MATERIALIZE */
      TO_CHAR(g.DEFENSOR_GESTION) AS DEFENSOR_GESTION,
      g.FECHA_REGISTRO AS FECHA_REGISTRO_GESTION,
      g.ID_ASIGNACION_GESTION,
      ag.CEDULA_DEFENSOR AS CEDULA_AUTOR_GESTION,
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
      ${dateColumns.join(',\n      ')}
    FROM DNDP.GESTION_JURIDICA g
    JOIN DNDP.SITUACION_CARCELARIA s ON s.ID_SITUACION = g.ID_SITUACION
    JOIN DNDP.PERSONA p ON p.ID_PERSONA = s.ID_PERSONA
    JOIN personas_del_defensor alcance ON alcance.ID_PERSONA = s.ID_PERSONA
    LEFT JOIN DNDP.ASIGNACION ag ON ag.ID_ASIGNACION = g.ID_ASIGNACION_GESTION
      AND ag.ID_PERSONA = s.ID_PERSONA
    WHERE 1=1 ${filtersSql}
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
    UNION
    SELECT DISTINCT
      TO_CHAR(d.CEDULA) AS CEDULA,
      TRIM(COALESCE(d.NOMBRE, g.DEFENSOR_GESTION)) AS NOMBRE,
      TRIM(d.REGIONAL) AS REGIONAL,
      TRIM(d.CORREO) AS CORREO
    FROM (SELECT DISTINCT DEFENSOR_GESTION FROM DNDP.GESTION_JURIDICA) g
    LEFT JOIN DNDP.DEFENSORES d
      ON ${normalizedMojibakeSqlExpr('d.NOMBRE')} = ${normalizedMojibakeSqlExpr('g.DEFENSOR_GESTION')}
    WHERE NVL(${normalizedMojibakeSqlExpr('g.DEFENSOR_GESTION')}, '-') NOT IN ('-', '--')
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

async function listAvailableEstablecimientos() {
  const result = await execute(`
    SELECT DISTINCT TRIM(TO_CHAR(s.ESTABLECIMIENTO)) AS ESTABLECIMIENTO
    FROM DNDP.SITUACION_CARCELARIA s
    WHERE TRIM(TO_CHAR(s.ESTABLECIMIENTO)) IS NOT NULL
    ORDER BY ESTABLECIMIENTO
  `, {}, { operation: 'reportes.atenciones.listAvailableEstablecimientos' });
  return (result?.rows || []).map((row) => row.ESTABLECIMIENTO);
}

// Las nuevas gestiones conservan su autor y su asignación original, incluso
// después de finalizarla. Las filas legadas sin vínculo mantienen la
// reconstrucción histórica porque versiones anteriores sobrescribían al autor.
function buildEventsSql({ tipo = 'all', lugar = '' } = {}) {
  const locationClause = lugar
    ? `AND ${normalizedMojibakeSqlExpr('s.ESTABLECIMIENTO')} = :lugar`
    : '';
  const tipoClause = tipo === 'all' ? '' : `AND ${normalizedMojibakeSqlExpr(
    "COALESCE(NULLIF(TRIM(TO_CHAR(s.SITUACION_JURIDICA_ACTUALIZADA)), ''), TO_CHAR(s.SITUACION))"
  )} LIKE :tipo`;
  return `
    WITH personas_del_defensor AS (
      SELECT a.ID_PERSONA FROM DNDP.ASIGNACION a WHERE ${DEFENSOR_MATCH_SQL}
      UNION
      SELECT s.ID_PERSONA FROM DNDP.GESTION_JURIDICA g
      JOIN DNDP.SITUACION_CARCELARIA s ON s.ID_SITUACION = g.ID_SITUACION
      WHERE ${normalizedMojibakeSqlExpr('g.DEFENSOR_GESTION')} = :defensorNombre
    ),
    gestiones_base AS (
      ${buildEventBaseSelect(`${locationClause} ${tipoClause}`)}
    ),
    eventos AS (
      SELECT SUBSTR(ORIGEN, 1, INSTR(ORIGEN, '_') - 1) AS TIPO,
        ORIGEN, DEFENSOR_GESTION, FECHA_REGISTRO_GESTION,
        ID_ASIGNACION_GESTION, CEDULA_AUTOR_GESTION,
        ID_GESTION, ID_SITUACION, ID_PERSONA, NOMBRE_USUARIO,
        IDENTIFICACION, LUGAR_PRIVACION, FECHA
      FROM gestiones_base
      UNPIVOT (FECHA FOR ORIGEN IN (
        ${EVENT_UNIONS.map(([tipoEvento], index) => `FECHA_EVENTO_${index} AS '${tipoEvento}_${index}'`).join(',\n        ')}
      ))
    ),
    asignaciones_ordenadas AS (
      SELECT a.*, ROW_NUMBER() OVER (
        PARTITION BY a.ID_PERSONA
        ORDER BY a.FECHA_ASIGNACION ASC NULLS FIRST, a.ID_ASIGNACION
      ) AS ORDEN
      FROM DNDP.ASIGNACION a
      JOIN personas_del_defensor alcance ON alcance.ID_PERSONA = a.ID_PERSONA
    ),
    eventos_con_registro AS (
      SELECT e.*, r.ID_ASIGNACION AS ID_ASIGNACION_REGISTRO,
        r.CEDULA_DEFENSOR AS CEDULA_REGISTRO, r.NOMBRE_DEFENSOR AS NOMBRE_REGISTRO,
        ROW_NUMBER() OVER (
          PARTITION BY e.ID_GESTION, e.ORIGEN
          ORDER BY r.FECHA_ASIGNACION DESC NULLS LAST, r.ID_ASIGNACION DESC
        ) AS RN_REGISTRO
      FROM eventos e
      LEFT JOIN asignaciones_ordenadas r
        ON r.ID_PERSONA = e.ID_PERSONA
       AND e.FECHA_REGISTRO_GESTION IS NOT NULL
       AND (r.ORDEN = 1 OR e.FECHA_REGISTRO_GESTION >= TRUNC(r.FECHA_ASIGNACION))
       AND (r.FECHA_FIN IS NULL OR e.FECHA_REGISTRO_GESTION < TRUNC(r.FECHA_FIN) + 1)
      WHERE e.FECHA >= TO_DATE(:fechaInicio, 'YYYY-MM-DD')
        AND e.FECHA < TO_DATE(:fechaFin, 'YYYY-MM-DD') + 1
    ),
    eventos_atribuidos AS (
      SELECT e.*, a.CEDULA_DEFENSOR, a.NOMBRE_DEFENSOR,
        ROW_NUMBER() OVER (
          PARTITION BY e.ID_GESTION, e.ORIGEN
          ORDER BY a.FECHA_ASIGNACION DESC NULLS LAST, a.ID_ASIGNACION DESC
        ) AS RN_AUTOR,
        CASE
          WHEN e.ID_ASIGNACION_GESTION IS NOT NULL THEN 1
          WHEN NVL(${normalizedMojibakeSqlExpr('e.DEFENSOR_GESTION')}, '-') IN ('-', '--') THEN 0
          WHEN e.FECHA >= TRUNC(e.FECHA_REGISTRO_GESTION)
            AND a.ID_ASIGNACION <> e.ID_ASIGNACION_REGISTRO THEN 0
          WHEN e.NOMBRE_REGISTRO IS NULL AND e.CEDULA_REGISTRO IS NULL THEN 1
          WHEN ${normalizedMojibakeSqlExpr('e.NOMBRE_REGISTRO')} = ${normalizedMojibakeSqlExpr('e.DEFENSOR_GESTION')} THEN 1
          WHEN EXISTS (
            SELECT 1 FROM DNDP.DEFENSORES registrado
            WHERE registrado.CEDULA = e.CEDULA_REGISTRO
              AND ${normalizedMojibakeSqlExpr('registrado.NOMBRE')} = ${normalizedMojibakeSqlExpr('e.DEFENSOR_GESTION')}
          ) THEN 1
          ELSE 0
        END AS AUTOR_ORIGINAL
      FROM eventos_con_registro e
      LEFT JOIN asignaciones_ordenadas a
        ON a.ID_PERSONA = e.ID_PERSONA
       AND ${EVENT_ASSIGNMENT_SCOPE_SQL}
      WHERE e.RN_REGISTRO = 1
    )
    SELECT e.TIPO, e.ORIGEN, e.ID_GESTION, e.ID_SITUACION, e.ID_PERSONA,
      e.NOMBRE_USUARIO, e.IDENTIFICACION, e.LUGAR_PRIVACION,
      CASE WHEN e.AUTOR_ORIGINAL = 1
        THEN 'DEFENSOR_GESTION' ELSE 'ASIGNACION_HISTORICA' END AS FUENTE_AUTOR,
      TO_CHAR(e.FECHA, 'YYYY-MM-DD') AS FECHA
    FROM eventos_atribuidos e
    WHERE e.RN_AUTOR = 1
      AND (
        (e.ID_ASIGNACION_GESTION IS NOT NULL AND (
          TO_CHAR(e.CEDULA_AUTOR_GESTION) = :defensorCedula
          OR (e.CEDULA_AUTOR_GESTION IS NULL
            AND ${normalizedMojibakeSqlExpr('e.DEFENSOR_GESTION')} = :defensorNombre
            AND NOT EXISTS (
              SELECT 1 FROM DNDP.DEFENSORES homonimo
              WHERE ${normalizedMojibakeSqlExpr('homonimo.NOMBRE')} = :defensorNombre
                AND TO_CHAR(homonimo.CEDULA) <> :defensorCedula
            ))
        ))
        OR (e.ID_ASIGNACION_GESTION IS NULL AND e.AUTOR_ORIGINAL = 1
          AND ${normalizedMojibakeSqlExpr('e.DEFENSOR_GESTION')} = :defensorNombre
          AND NOT EXISTS (
            SELECT 1 FROM DNDP.DEFENSORES homonimo
            WHERE ${normalizedMojibakeSqlExpr('homonimo.NOMBRE')} = :defensorNombre
              AND TO_CHAR(homonimo.CEDULA) <> :defensorCedula
          ))
        OR (e.ID_ASIGNACION_GESTION IS NULL AND e.AUTOR_ORIGINAL = 0 AND ${DEFENSOR_MATCH_SQL.replaceAll('a.', 'e.')})
      )
    ORDER BY e.TIPO, e.FECHA, e.NOMBRE_USUARIO, e.IDENTIFICACION
  `;
}

async function listEvents(params) {
  const binds = reportBinds(params);
  if (params.lugar) binds.lugar = normalizeSearchText(params.lugar);
  if (params.tipo && params.tipo !== 'all') binds.tipo = params.tipo === 'condenado' ? '%CONDENAD%' : '%SINDICAD%';
  const result = await execute(buildEventsSql(params), binds, { operation: 'reportes.atenciones.listEvents' });
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function listAssignedCases(params) {
  return personaRepo.listAssignedCasesForReport(params);
}

module.exports = {
  listAvailableDefensores,
  listAvailableRegionales,
  listAvailableEstablecimientos,
  listEvents,
  listAssignedCases,
  normalizeDefensorName,
  EVENT_UNIONS,
  EVENT_ASSIGNMENT_SCOPE_SQL,
  buildEventsSql,
};
