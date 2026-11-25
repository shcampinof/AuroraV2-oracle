const { normalizedSqlExpr } = require('./sqlFragments');

function buildPotentialCategorySql(column = 's.CATEGORIZACION') {
  const value = normalizedSqlExpr(column);
  return `CASE
    WHEN ${value} LIKE 'PRELIMINAR %' THEN 'proximos_requisito_temporal'
    WHEN ${value} = 'UTILIDAD PUBLICA' THEN 'mujeres_potenciales_utilidad_publica'
    WHEN ${value} LIKE '%PRISION DOMICILIARIA%'
      OR ${value} LIKE '%LIBERTAD CONDICIONAL%'
      OR ${value} LIKE '%REVISAR POR PENA%' THEN 'potenciales_beneficiarios'
    ELSE 'no_reunen_requisitos'
  END`;
}

function buildIsPotentialBeneficiarySql(column) {
  return `((${buildPotentialCategorySql(column)}) IN ('potenciales_beneficiarios', 'mujeres_potenciales_utilidad_publica'))`;
}

module.exports = { buildPotentialCategorySql, buildIsPotentialBeneficiarySql };
