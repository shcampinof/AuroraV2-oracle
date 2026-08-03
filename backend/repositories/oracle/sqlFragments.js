const DEFAULT_SCOPE_DEPARTAMENTOS = [];

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

function buildActiveSituacionCte() {
  return `
    WITH ranked_situacion AS (
      SELECT
        s.*,
        ROW_NUMBER() OVER (
          PARTITION BY s.ID_PERSONA
          ORDER BY
            CASE WHEN NVL(s.ACTIVO, 0) = 1 THEN 0 ELSE 1 END,
            s.FECHA_CAPTURA DESC NULLS LAST,
            LENGTH(REGEXP_REPLACE(NVL(s.PROCESO, ''), '[^0-9]', '')) DESC,
            s.FECHA_REGISTRO DESC NULLS LAST,
            s.ID_SITUACION DESC
        ) AS RN
      FROM DNDP.SITUACION_CARCELARIA s
    )
  `;
}

module.exports = {
  DEFAULT_SCOPE_DEPARTAMENTOS,
  repairCommonMojibakeSqlExpr,
  normalizedSqlExpr,
  normalizedMojibakeSqlExpr,
  buildScopeWhereClause,
  buildActiveSituacionCte,
};
