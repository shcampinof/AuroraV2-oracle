const { normalizeSearchText } = require('../../utils/textNormalization');
const { listCentros, resolveCentro } = require('../../domain/catalogosHomologacion');

const DEFAULT_SCOPE_DEPARTAMENTOS = [];
const REPORT_REGIONAL_SIN_IDENTIFICAR = 'Sin regional identificada';

const COMMON_MOJIBAKE_SQL_REPLACEMENTS = [
  ['\\00C3\\0081', 'A'],
  ['\\00C3\\00A1', 'A'],
  ['\\00C3\\2030', 'E'],
  ['\\00C3\\00A9', 'E'],
  ['\\00C3\\008D', 'I'],
  ['\\00C3\\00AD', 'I'],
  ['\\00C3\\201C', 'O'],
  ['\\00C3\\00B3', 'O'],
  ['\\00C3\\0161', 'U'],
  ['\\00C3\\00BA', 'U'],
  ['\\00C3\\2018', 'N'],
  ['\\00C3\\00B1', 'N'],
];

function repairCommonMojibakeSqlExpr(columnRef) {
  return COMMON_MOJIBAKE_SQL_REPLACEMENTS.reduce(
    (expression, [sequence, replacement]) =>
      `REPLACE(${expression}, UNISTR('${sequence}'), '${replacement}')`,
    columnRef
  );
}

function normalizedSqlExpr(columnRef) {
  return `TRANSLATE(UPPER(TRIM(NVL(${columnRef}, ''))), 'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑ', 'AEIOUAEIOUAEIOUN')`;
}

function normalizedMojibakeSqlExpr(columnRef) {
  const repaired = repairCommonMojibakeSqlExpr(columnRef);
  const whitespaceNormalized = `REGEXP_REPLACE(REPLACE(${repaired}, UNISTR('\\00A0'), ' '), '[[:space:]]+', ' ')`;
  return `TRANSLATE(UPPER(TRIM(NVL(${whitespaceNormalized}, ''))), 'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑ', 'AEIOUAEIOUAEIOUN')`;
}

function buildScopeWhereClause(columnRef = 's.DEPARTAMENTO', bindPrefix = 'dep', values = DEFAULT_SCOPE_DEPARTAMENTOS) {
  const safe = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!safe.length) {
    return { clause: '1=1', binds: {} };
  }

  const binds = {};
  const placeholders = safe.map((value, idx) => {
    const key = `${bindPrefix}${idx}`;
    binds[key] = String(value || '').trim().toUpperCase();
    return `:${key}`;
  });

  return {
    clause: `${normalizedSqlExpr(columnRef)} IN (${placeholders.join(', ')})`,
    binds,
  };
}

function buildSituacionRegionalClause(regional, situacionAlias = 's') {
  const value = normalizeSearchText(regional);
  if (!value) return { clause: '1=1', binds: {} };
  return {
    clause: `EXISTS (
      SELECT 1 FROM DNDP.VW_SITUACION_REGIONAL report_regional
      WHERE report_regional.ID_SITUACION = ${situacionAlias}.ID_SITUACION
        AND ${normalizedMojibakeSqlExpr('report_regional.REGIONAL')} = :regional
    )`,
    binds: { regional: value },
  };
}

function buildSindicadoClause(situacionAlias = 's') {
  return `${normalizedMojibakeSqlExpr(`COALESCE(
    NULLIF(TRIM(TO_CHAR(${situacionAlias}.SITUACION_JURIDICA_ACTUALIZADA)), ''),
    TO_CHAR(${situacionAlias}.SITUACION)
  )`)} LIKE '%SINDICAD%'`;
}

function buildCondenadoClause(situacionAlias = 's') {
  return `${normalizedMojibakeSqlExpr(`COALESCE(
    NULLIF(TRIM(TO_CHAR(${situacionAlias}.SITUACION_JURIDICA_ACTUALIZADA)), ''),
    TO_CHAR(${situacionAlias}.SITUACION)
  )`)} LIKE '%CONDENAD%'`;
}

function buildReportEronCtes() {
  const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const aliases = listCentros().flatMap((centro) => [...new Set(centro.aliases.map(normalizeSearchText))]
    .map((alias) => `SELECT ${literal(centro.id)} AS CENTRO_ID, ${literal(alias)} AS ALIAS FROM dual`));
  return `report_eron_aliases AS (
    ${aliases.join('\n    UNION ALL\n    ')}
  ), report_erones AS (
    SELECT /*+ MATERIALIZE */ DISTINCT eron_alias.CENTRO_ID,
      TRIM(TO_CHAR(eron_catalog.REGIONAL)) AS REGIONAL,
      ${normalizedMojibakeSqlExpr('eron_catalog.REGIONAL')} AS REGIONAL_KEY
    FROM DNDP.CAT_ERON_REGIONAL eron_catalog
    JOIN report_eron_aliases eron_alias
      ON eron_alias.ALIAS = ${normalizedMojibakeSqlExpr('eron_catalog.ESTABLECIMIENTO')}
    WHERE NVL(eron_catalog.ACTIVO, 1) = 1
      AND TRIM(TO_CHAR(eron_catalog.REGIONAL)) IS NOT NULL
  )`;
}

function buildReportEstablecimientoExpr(situacionAlias = 's') {
  return `COALESCE(NULLIF(TRIM(TO_CHAR(${situacionAlias}.ESTABLECIMIENTO)), ''), TO_CHAR(${situacionAlias}.LUGAR_PRIVACION))`;
}

function buildReportRegionalClause({ regional = '', lugar = '' } = {}, situacionAlias = 's') {
  const value = normalizeSearchText(regional);
  if (!value) return { clause: '1=1', binds: {} };
  const selected = String(lugar).trim();
  const sinRegional = value === normalizeSearchText(REPORT_REGIONAL_SIN_IDENTIFICAR);
  if (sinRegional && selected) return { clause: '1=0', binds: {} };
  const centro = selected ? resolveCentro(selected) : null;
  if (selected && !centro?.homologado) return { clause: '1=0', binds: {} };
  const binds = sinRegional ? {} : { regional: value };
  if (selected) binds.reportCentroId = centro.id;
  const eronMatch = `EXISTS (
    SELECT 1 FROM report_erones eron
    JOIN report_eron_aliases eron_nombre ON eron_nombre.CENTRO_ID = eron.CENTRO_ID
    WHERE eron_nombre.ALIAS = ${normalizedMojibakeSqlExpr(buildReportEstablecimientoExpr(situacionAlias))}
      ${sinRegional ? '' : 'AND eron.REGIONAL_KEY = :regional'}
      ${selected ? 'AND eron.CENTRO_ID = :reportCentroId' : ''}
  )`;
  return {
    clause: `((${buildCondenadoClause(situacionAlias)} OR ${buildSindicadoClause(situacionAlias)}) AND ${sinRegional ? 'NOT ' : ''}${eronMatch})`,
    binds,
  };
}

function buildActiveSituacionCte() {
  return `
    WITH ranked_situacion AS (
      SELECT
        s.*,
        COUNT(*) OVER (PARTITION BY s.ID_PERSONA) AS TOTAL_SITUACIONES,
        MIN(NVL(s.ACTIVO, 0)) OVER (PARTITION BY s.ID_PERSONA) AS MIN_ACTIVO_HISTORICO,
        MAX(NVL(s.ACTIVO, 0)) OVER (PARTITION BY s.ID_PERSONA) AS MAX_ACTIVO_HISTORICO,
        ROW_NUMBER() OVER (
          PARTITION BY s.ID_PERSONA
          ORDER BY
            COALESCE(s.FECHA_CORTE, CAST(s.FECHA_REGISTRO AS DATE), s.FECHA_CAPTURA) DESC NULLS LAST,
            CASE WHEN NVL(s.ACTIVO, 0) = 1 THEN 0 ELSE 1 END,
            s.FECHA_REGISTRO DESC NULLS LAST,
            s.FECHA_CAPTURA DESC NULLS LAST,
            LENGTH(REGEXP_REPLACE(NVL(s.PROCESO, ''), '[^0-9]', '')) DESC,
            s.ID_SITUACION DESC
        ) AS RN
      FROM DNDP.SITUACION_CARCELARIA s
    )
  `;
}

// Los catálogos de filtros solo deben reflejar la situación más reciente si
// esta continúa activa. Filtrar ACTIVO antes de ordenar resucitaría una fila
// histórica de alguien cuya situación posterior ya fue cerrada.
function buildStrictActiveSituacionCte() {
  return `
    WITH ranked_situacion AS (
      SELECT s.*
      FROM (
        SELECT
          source_s.*,
          ROW_NUMBER() OVER (
            PARTITION BY source_s.ID_PERSONA
            ORDER BY
              COALESCE(source_s.FECHA_CORTE, CAST(source_s.FECHA_REGISTRO AS DATE), source_s.FECHA_CAPTURA) DESC NULLS LAST,
              source_s.FECHA_REGISTRO DESC NULLS LAST,
              source_s.FECHA_CAPTURA DESC NULLS LAST,
              source_s.ID_SITUACION DESC
          ) AS RN
        FROM DNDP.SITUACION_CARCELARIA source_s
      ) s
      WHERE s.RN = 1
        AND NVL(s.ACTIVO, 0) = 1
    )
  `;
}

module.exports = {
  DEFAULT_SCOPE_DEPARTAMENTOS,
  REPORT_REGIONAL_SIN_IDENTIFICAR,
  repairCommonMojibakeSqlExpr,
  normalizedSqlExpr,
  normalizedMojibakeSqlExpr,
  buildScopeWhereClause,
  buildSituacionRegionalClause,
  buildSindicadoClause,
  buildCondenadoClause,
  buildReportEronCtes,
  buildReportEstablecimientoExpr,
  buildReportRegionalClause,
  buildActiveSituacionCte,
  buildStrictActiveSituacionCte,
};
