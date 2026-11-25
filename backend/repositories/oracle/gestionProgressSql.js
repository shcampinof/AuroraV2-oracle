const { GESTION_COLUMNS } = require('./gestionRepository');

// Estado calculado, autor y fechas técnicas no son respuestas del formulario.
const METADATA_COLUMNS = new Set([
  'ACCION_REALIZAR', 'DEFENSOR_GESTION', 'ID_ASIGNACION_GESTION', 'FECHA_REGISTRO',
]);
const ANSWER_COLUMNS = [...GESTION_COLUMNS].filter(column => !METADATA_COLUMNS.has(column));

function buildGestionHasAnswersExpr(alias = 'g') {
  const predicates = ANSWER_COLUMNS.map(column => {
    const ref = `${alias}.${column}`;
    if (column.startsWith('FECHA_') || column === 'NUEVA_FECHA_ANALISIS') return `${ref} IS NOT NULL`;
    if (column === 'INSISTENCIAS') return `NVL(${ref}, 0) <> 0`;
    // REGEXP_LIKE también admite CLOB: no truncar un resumen largo ni convertir
    // todo el texto a VARCHAR2 para decidir si hay trabajo que preservar.
    let value = `REPLACE(REPLACE(${ref}, UNISTR('\\00A0'), ' '), UNISTR('\\200B'), '')`;
    if (column === 'OTRAS_SOLICITUDES_TRAMITAR' || column === 'CON_QUE_PROCESOS_ACUMULAR') {
      for (const delimiter of ['[', ']', '"', ',', ';', '|']) value = `REPLACE(${value}, '${delimiter}', ' ')`;
    }
    const placeholder = '[[:space:]]*(-|–|—|−|_|NULL|UNDEFINED|SELECCIONE|TODOS|SIN[[:space:]]+INFORMACI[OÓ]N|SIN[[:space:]]+DATOS?|SIN[[:space:]]+RESPUESTA)';
    return `(${ref} IS NOT NULL AND NOT REGEXP_LIKE(${value}, '^(${placeholder})*[[:space:]]*$', 'i'))`;
  });
  return `CASE WHEN ${predicates.join('\n OR ')} THEN 1 ELSE 0 END`;
}

module.exports = { ANSWER_COLUMNS, buildGestionHasAnswersExpr };
