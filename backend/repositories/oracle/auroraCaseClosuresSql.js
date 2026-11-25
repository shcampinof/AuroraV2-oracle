const { normalizedMojibakeSqlExpr } = require('./sqlFragments');
const { closures } = require('../../domain/auroraCaseClosures');

function literal(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function normalizedAnswer(column) {
  return `REGEXP_REPLACE(NVL(${normalizedMojibakeSqlExpr(column)}, '-'), '^[0-9]+[^A-Z]*', '')`;
}

function buildAutomaticBlock3ClosureSql(alias = 'g') {
  const q30 = normalizedAnswer(`${alias}.LIBERTAD_CONDICIONAL`);
  const q31 = normalizedAnswer(`${alias}.PRISION_DOMICILIARIA_MITAD_PENA`);
  const response = (key) => literal(closures[key].respuesta.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase());
  const negative = (column) => {
    const value = normalizedAnswer(`${alias}.${column}`);
    return `(${value} = 'NO' OR ${value} LIKE 'NO APLICA%' OR ${value} LIKE 'NO CUMPLE%')`;
  };
  return `CASE
    WHEN ${q30} = ${response('libertad')} OR ${q31} = ${response('libertad')}
      THEN ${literal(closures.libertad.motivo)}
    WHEN ${q30} = ${response('traslado')} AND ${q31} = ${response('traslado')}
      AND ${negative('PROCEDENCIA_PENA_CUMPLIDA')}
      AND ${negative('PROCEDENCIA_ACUMULACION_PENAS')}
      AND (${normalizedAnswer(`${alias}.UTILIDAD_PUBLICA`)} IN ('-', '--') OR ${negative('UTILIDAD_PUBLICA')})
      AND ${normalizedAnswer(`${alias}.OTRAS_SOLICITUDES_TRAMITAR`)} = 'NINGUNA'
      THEN ${literal(closures.traslado.motivo)}
    ELSE NULL END`;
}

module.exports = { buildAutomaticBlock3ClosureSql };
