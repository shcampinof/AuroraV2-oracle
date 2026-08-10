const DEFAULT_SCOPE_DEPARTAMENTOS = [];

function normalizedSqlExpr(columnRef) {
  return `TRANSLATE(UPPER(TRIM(NVL(${columnRef}, ''))), 'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑ', 'AEIOUAEIOUAEIOUN')`;
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
  normalizedSqlExpr,
  buildScopeWhereClause,
  buildActiveSituacionCte,
};
