const { execute } = require('../../db/oraclePool');
const {
  buildActiveSituacionCte,
  buildStrictActiveSituacionCte,
  buildScopeWhereClause,
  DEFAULT_SCOPE_DEPARTAMENTOS,
  normalizedSqlExpr,
  normalizedMojibakeSqlExpr,
} = require('./sqlFragments');
const { resolveEstadoCodigo } = require('../../domain/estadoCaso');
const {
  getAccionByCodigo,
  getAllCentroNormalizedAliases,
  getCentroById,
  getCentroNormalizedAliases,
  resolveAccionCodigo,
  OTROS_LUGARES_ACTIVOS_ID,
} = require('../../domain/catalogosHomologacion');
const { normalizeSearchText } = require('../../utils/textNormalization');

// La cédula vincula la asignación con el catálogo canónico. Se prioriza ese
// nombre para que un snapshot histórico con mojibake no oculte al defensor.
// NOMBRE_DEFENSOR sigue siendo respaldo para asignaciones antiguas sin cédula.
const DEFENSOR_ACTIVO_EXPR = 'COALESCE(TO_NCHAR(d.NOMBRE), TO_NCHAR(a.NOMBRE_DEFENSOR))';
const SITUACION_JURIDICA_EFECTIVA_EXPR = `COALESCE(
  NULLIF(TRIM(TO_CHAR(s.SITUACION_JURIDICA_ACTUALIZADA)), ''),
  TO_CHAR(s.SITUACION)
)`;

const BASE_SELECT_COLUMNS = [
  'p.ID_PERSONA AS P_ID_PERSONA',
  'p.NUMERO AS P_NUMERO',
  'p.NOMBRE AS P_NOMBRE',
  'p.TIPO_IDENTIFICACION AS P_TIPO_IDENTIFICACION',
  'p.GENERO AS P_GENERO',
  'p.NACIONALIDAD AS P_NACIONALIDAD',
  'p.FECHA_NACIMIENTO AS P_FECHA_NACIMIENTO',
  'p.EDAD AS P_EDAD',
  'p.FECHA_CREACION AS P_FECHA_CREACION',

  's.ID_SITUACION AS S_ID_SITUACION',
  's.ID_PERSONA AS S_ID_PERSONA',
  's.FECHA_CAPTURA AS S_FECHA_CAPTURA',
  's.SITUACION AS S_SITUACION',
  's.DELITOS AS S_DELITOS',
  's.PROCESO AS S_PROCESO',
  's.AUTORIDAD AS S_AUTORIDAD',
  's.SITUACION_JURIDICA_ACTUALIZADA AS S_SITUACION_JURIDICA_ACTUALIZADA',
  's.LUGAR_PRIVACION AS S_LUGAR_PRIVACION',
  's.ESTABLECIMIENTO AS S_ESTABLECIMIENTO',
  's.DEPARTAMENTO AS S_DEPARTAMENTO',
  's.MUNICIPIO AS S_MUNICIPIO',
  's.SIGUE_CDT AS S_SIGUE_CDT',
  's.PENA AS S_PENA',
  's.PENA_DIAS AS S_PENA_DIAS',
  's.PRIVACION AS S_PRIVACION',
  's.REDENCION AS S_REDENCION',
  's.TIEMPO_EFECTIVO AS S_TIEMPO_EFECTIVO',
  's.PORCENTAJE AS S_PORCENTAJE',
  's.FASE AS S_FASE',
  's.ENFOQUE AS S_ENFOQUE',
  's.REQUERIMIENTOS AS S_REQUERIMIENTOS',
  's.ATENCION_MEDICA AS S_ATENCION_MEDICA',
  's.GESTACION AS S_GESTACION',
  's.CABEZA_FAMILIA AS S_CABEZA_FAMILIA',
  's.CATEGORIZACION AS S_CATEGORIZACION',
  's.DIAS_PRISION AS S_DIAS_PRISION',
  's.DIAS_LIBERTAD AS S_DIAS_LIBERTAD',
  'c.FECHA_CALIFICACION_1 AS S_FECHA_CALIFICACION',
  'c.CALIFICACION_1 AS S_CALIFICACION',
  'c.ACTA_1 AS C_ACTA_1',
  'c.FECHA_INICIO_1 AS C_FECHA_INICIO_1',
  'c.FECHA_FIN_1 AS C_FECHA_FIN_1',
  'c.FECHA_CALIFICACION_1 AS C_FECHA_CALIFICACION_1',
  'c.CALIFICACION_1 AS C_CALIFICACION_1',
  'c.ACTA_2 AS C_ACTA_2',
  'c.FECHA_INICIO_2 AS C_FECHA_INICIO_2',
  'c.FECHA_FIN_2 AS C_FECHA_FIN_2',
  'c.FECHA_CALIFICACION_2 AS C_FECHA_CALIFICACION_2',
  'c.CALIFICACION_2 AS C_CALIFICACION_2',
  'c.ACTA_3 AS C_ACTA_3',
  'c.FECHA_INICIO_3 AS C_FECHA_INICIO_3',
  'c.FECHA_FIN_3 AS C_FECHA_FIN_3',
  'c.FECHA_CALIFICACION_3 AS C_FECHA_CALIFICACION_3',
  'c.CALIFICACION_3 AS C_CALIFICACION_3',
  'c.ACTA_4 AS C_ACTA_4',
  'c.FECHA_INICIO_4 AS C_FECHA_INICIO_4',
  'c.FECHA_FIN_4 AS C_FECHA_FIN_4',
  'c.FECHA_CALIFICACION_4 AS C_FECHA_CALIFICACION_4',
  'c.CALIFICACION_4 AS C_CALIFICACION_4',
  's.FECHA_REGISTRO AS S_FECHA_REGISTRO',
  's.ACTIVO AS S_ACTIVO',
  's.FUENTE AS S_FUENTE',
  's.FECHA_CORTE AS S_FECHA_CORTE',
  's.TOTAL_SITUACIONES AS S_TOTAL_SITUACIONES',
  's.MIN_ACTIVO_HISTORICO AS S_MIN_ACTIVO_HISTORICO',
  's.MAX_ACTIVO_HISTORICO AS S_MAX_ACTIVO_HISTORICO',

  'g.ID_GESTION AS G_ID_GESTION',
  'g.ID_SITUACION AS G_ID_SITUACION',
  'a.NOMBRE_PAG AS G_PAG',
  'a.CEDULA_PAG AS G_CEDULA_PAG',
  'a.CEDULA_DEFENSOR AS G_CEDULA_DEFENSOR',
  `${DEFENSOR_ACTIVO_EXPR} AS G_DEFENSOR`,
  'a.FECHA_ASIGNACION AS G_FECHA_ASIGNACION',
  'g.ACCION_REALIZAR AS G_ACCION_REALIZAR',
  'g.FECHA_ANALISIS AS G_FECHA_ANALISIS',
  'g.VENCIMIENTO_TERMINOS AS G_VENCIMIENTO_TERMINOS',
  'g.UTILIDAD_PUBLICA AS G_UTILIDAD_PUBLICA',
  'g.LIBERTAD_CONDICIONAL AS G_LIBERTAD_CONDICIONAL',
  'g.PRISION_DOMICILIARIA_MITAD_PENA AS G_PRISION_DOMICILIARIA_MITAD_PENA',
  'g.PROCEDENCIA_PENA_CUMPLIDA AS G_PROCEDENCIA_PENA_CUMPLIDA',
  'g.PROCEDENCIA_ACUMULACION_PENAS AS G_PROCEDENCIA_ACUMULACION_PENAS',
  'g.CON_QUE_PROCESOS_ACUMULAR AS G_CON_QUE_PROCESOS_ACUMULAR',
  'g.OTRAS_SOLICITUDES_TRAMITAR AS G_OTRAS_SOLICITUDES_TRAMITAR',
  'g.RESUMEN_ANALISIS_CASO AS G_RESUMEN_ANALISIS_CASO',
  'g.FECHA_ENTREVISTA AS G_FECHA_ENTREVISTA',
  'g.DECISION_USUARIO AS G_DECISION_USUARIO',
  'g.ACTUACION_ADELANTAR AS G_ACTUACION_ADELANTAR',
  'g.REQUIERE_PRUEBAS AS G_REQUIERE_PRUEBAS',
  'g.PODER_AVANZAR_SOLICITUD AS G_PODER_AVANZAR_SOLICITUD',
  'g.FECHA_ENTREVISTA_PSICOSOCIAL AS G_FECHA_ENTREVISTA_PSICOSOCIAL',
  'g.CUMPLE_REQUISITO_MARGINALIDAD AS G_CUMPLE_REQUISITO_MARGINALIDAD',
  'g.CUMPLE_REQUISITO_JEFATURA_HOGAR AS G_CUMPLE_REQUISITO_JEFATURA_HOGAR',
  'g.REQUIERE_MISION_TRABAJO AS G_REQUIERE_MISION_TRABAJO',
  'g.FECHA_SOLICITUD_MISION_TRABAJO AS G_FECHA_SOLICITUD_MISION_TRABAJO',
  'g.FECHA_ASIGNACION_INVESTIGADOR AS G_FECHA_ASIGNACION_INVESTIGADOR',
  'g.FECHA_RECEPCION_TODAS_PRUEBAS AS G_FECHA_RECEPCION_TODAS_PRUEBAS',
  'g.FECHA_RECEPCION_PRUEBAS_USUARIO AS G_FECHA_RECEPCION_PRUEBAS_USUARIO',
  'g.FECHA_SOLICITUD_DOCS_INPEC AS G_FECHA_SOLICITUD_DOCS_INPEC',
  'g.FECHA_REVISION_EXPEDIENTE AS G_FECHA_REVISION_EXPEDIENTE',
  'g.CONFIRMACION_PROCEDENCIA_VENCIMIENTO AS G_CONFIRMACION_PROCEDENCIA_VENCIMIENTO',
  'g.FECHA_SOLICITUD_AUDIENCIA_CONTROL AS G_FECHA_SOLICITUD_AUDIENCIA_CONTROL',
  'g.FECHA_REALIZACION_AUDIENCIA AS G_FECHA_REALIZACION_AUDIENCIA',
  'g.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD AS G_FECHA_PRESENTACION_SOLICITUD_AUTORIDAD',
  'g.FECHA_DECISION_AUTORIDAD AS G_FECHA_DECISION_AUTORIDAD',
  'g.FECHA_RADICACION_UTILIDAD AS G_FECHA_RADICACION_UTILIDAD',
  'g.SENTIDO_DECISION AS G_SENTIDO_DECISION',
  'g.MOTIVO_DECISION_NEGATIVA AS G_MOTIVO_DECISION_NEGATIVA',
  'g.SE_PRESENTA_RECURSO AS G_SE_PRESENTA_RECURSO',
  'g.FECHA_RECURSO_DESFAVORABLE AS G_FECHA_RECURSO_DESFAVORABLE',
  'g.FECHA_PRESENTACION_RECURSO AS G_FECHA_PRESENTACION_RECURSO',
  'g.FECHA_DECISION_RECURSO AS G_FECHA_DECISION_RECURSO',
  'g.SENTIDO_DECISION_RESUELVE_RECURSO AS G_SENTIDO_DECISION_RESUELVE_RECURSO',
  'g.CIERRE_CASO AS G_CIERRE_CASO',
  'g.FECHA_REGISTRO AS G_FECHA_REGISTRO',
].join(',\n      ');

const PERSONA_COLUMNS = new Set([
  'NUMERO',
  'NOMBRE',
  'TIPO_IDENTIFICACION',
  'GENERO',
  'NACIONALIDAD',
  'FECHA_NACIMIENTO',
  'EDAD',
  'FECHA_CREACION',
]);

const GESTION_MEANINGFUL_ORDER_EXPR = `
  CASE
    WHEN g.ACCION_REALIZAR IS NOT NULL
      OR g.FECHA_ANALISIS IS NOT NULL
      OR g.VENCIMIENTO_TERMINOS IS NOT NULL
      OR g.UTILIDAD_PUBLICA IS NOT NULL
      OR g.LIBERTAD_CONDICIONAL IS NOT NULL
      OR g.PRISION_DOMICILIARIA_MITAD_PENA IS NOT NULL
      OR g.PROCEDENCIA_PENA_CUMPLIDA IS NOT NULL
      OR g.PROCEDENCIA_ACUMULACION_PENAS IS NOT NULL
      OR g.CON_QUE_PROCESOS_ACUMULAR IS NOT NULL
      OR g.OTRAS_SOLICITUDES_TRAMITAR IS NOT NULL
      OR g.RESUMEN_ANALISIS_CASO IS NOT NULL
      OR g.FECHA_ENTREVISTA IS NOT NULL
      OR g.DECISION_USUARIO IS NOT NULL
      OR g.ACTUACION_ADELANTAR IS NOT NULL
      OR g.REQUIERE_PRUEBAS IS NOT NULL
      OR g.PODER_AVANZAR_SOLICITUD IS NOT NULL
      OR g.FECHA_ENTREVISTA_PSICOSOCIAL IS NOT NULL
      OR g.CUMPLE_REQUISITO_MARGINALIDAD IS NOT NULL
      OR g.CUMPLE_REQUISITO_JEFATURA_HOGAR IS NOT NULL
      OR g.REQUIERE_MISION_TRABAJO IS NOT NULL
      OR g.FECHA_SOLICITUD_MISION_TRABAJO IS NOT NULL
      OR g.FECHA_ASIGNACION_INVESTIGADOR IS NOT NULL
      OR g.FECHA_RECEPCION_TODAS_PRUEBAS IS NOT NULL
      OR g.FECHA_RECEPCION_PRUEBAS_USUARIO IS NOT NULL
      OR g.FECHA_SOLICITUD_DOCS_INPEC IS NOT NULL
      OR g.FECHA_REVISION_EXPEDIENTE IS NOT NULL
      OR g.CONFIRMACION_PROCEDENCIA_VENCIMIENTO IS NOT NULL
      OR g.FECHA_SOLICITUD_AUDIENCIA_CONTROL IS NOT NULL
      OR g.FECHA_REALIZACION_AUDIENCIA IS NOT NULL
      OR g.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD IS NOT NULL
      OR g.FECHA_DECISION_AUTORIDAD IS NOT NULL
      OR g.FECHA_RADICACION_UTILIDAD IS NOT NULL
      OR g.SENTIDO_DECISION IS NOT NULL
      OR g.MOTIVO_DECISION_NEGATIVA IS NOT NULL
      OR g.SE_PRESENTA_RECURSO IS NOT NULL
      OR g.FECHA_RECURSO_DESFAVORABLE IS NOT NULL
      OR g.FECHA_PRESENTACION_RECURSO IS NOT NULL
      OR g.FECHA_DECISION_RECURSO IS NOT NULL
      OR g.SENTIDO_DECISION_RESUELVE_RECURSO IS NOT NULL
      OR g.CIERRE_CASO IS NOT NULL
    THEN 0
    ELSE 1
  END
`;

function buildTipoFilter(tipo) {
  const safeTipo = String(tipo || '').trim().toLowerCase();
  if (safeTipo === 'condenado') {
    return `LOWER(NVL(${SITUACION_JURIDICA_EFECTIVA_EXPR}, '')) LIKE '%condenad%'`;
  }
  if (safeTipo === 'sindicado') {
    return `LOWER(NVL(${SITUACION_JURIDICA_EFECTIVA_EXPR}, '')) LIKE '%sindicad%'`;
  }
  return 'TRIM(s.SITUACION) IS NOT NULL';
}

function buildCanonicalEstadoCodeCase(columnRef) {
  const normalized = normalizedMojibakeSqlExpr(columnRef);
  return `
    CASE
      WHEN ${normalized} LIKE '%ANALIZAR EL CASO%' THEN 'ANALIZAR_CASO'
      WHEN ${normalized} LIKE '%ENTREVISTAR AL USUARIO%' THEN 'ENTREVISTAR_USUARIO'
      WHEN ${normalized} LIKE '%PENDIENTE DECISION DE AUDIENCIA%' THEN 'PENDIENTE_DECISION_AUDIENCIA'
      WHEN ${normalized} LIKE '%PENDIENTE AUDIENCIA%' THEN 'PENDIENTE_AUDIENCIA'
      WHEN ${normalized} LIKE '%PRESENTAR SOLICITUD%' THEN 'PRESENTAR_SOLICITUD'
      WHEN ${normalized} LIKE '%PRESENTAR RECURSO%' THEN 'PRESENTAR_RECURSO'
      WHEN ${normalized} LIKE '%PENDIENTE DECISION%' THEN 'PENDIENTE_DECISION'
      WHEN ${normalized} LIKE '%CASO CERRADO%' OR ${normalized} = 'CERRADO' THEN 'CASO_CERRADO'
      ELSE NULL
    END
  `;
}

const EXPLICIT_ESTADO_CODIGO_EXPR = `
  COALESCE(
    ${buildCanonicalEstadoCodeCase('g.ACCION_REALIZAR')},
    ${buildCanonicalEstadoCodeCase('g.ACTUACION_ADELANTAR')},
    ''
  )
`;
const ANALIZAR_CON_FALLBACK_EXPR = `COALESCE(NULLIF((${EXPLICIT_ESTADO_CODIGO_EXPR}), ''), 'ANALIZAR_CASO')`;

function sqlFilled(columnRef) {
  return `${columnRef} IS NOT NULL AND TRIM(TO_CHAR(${columnRef})) NOT IN ('-', '--')`;
}

// La etiqueta visible no depende solamente de ACCION_REALIZAR. La interfaz
// deriva los estados iniciales a partir de los hitos diligenciados del flujo;
// la búsqueda debe usar esos mismos hitos para no ocultar filas que sí muestra
// como "Entrevistar al usuario", "Presentar solicitud", etc.
const HAS_ANALISIS_COMPLETO_EXPR = `(
  ${sqlFilled('g.FECHA_ANALISIS')}
  AND ${sqlFilled('g.RESUMEN_ANALISIS_CASO')}
)`;
const HAS_ENTREVISTA_Y_ACTUACION_EXPR = `(
  ${sqlFilled('g.FECHA_ENTREVISTA')}
  AND ${sqlFilled('g.ACTUACION_ADELANTAR')}
)`;
function sqlAnyFilled(columnRefs) {
  return `(${columnRefs.map((columnRef) => `(${sqlFilled(columnRef)})`).join(' OR ')})`;
}

const ACTUACION_NORMALIZADA_EXPR = normalizedMojibakeSqlExpr('g.ACTUACION_ADELANTAR');
const DECISION_NORMALIZADA_EXPR = normalizedMojibakeSqlExpr('g.SENTIDO_DECISION');
const RECURSO_NORMALIZADO_EXPR = normalizedMojibakeSqlExpr('g.SE_PRESENTA_RECURSO');
const DECISION_USUARIO_NORMALIZADA_EXPR = normalizedMojibakeSqlExpr('g.DECISION_USUARIO');
const HAS_DECISION_RECURSO_EXPR = sqlAnyFilled([
  'g.FECHA_DECISION_RECURSO',
  'g.SENTIDO_DECISION_RESUELVE_RECURSO',
]);
const IS_UTILIDAD_PUBLICA_EXPR = `(${ACTUACION_NORMALIZADA_EXPR} LIKE '%UTILIDAD PUBLICA%')`;
const FECHA_RADICACION_EXPR = `(CASE
  WHEN ${IS_UTILIDAD_PUBLICA_EXPR} THEN g.FECHA_RADICACION_UTILIDAD
  ELSE g.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD
END)`;
const IS_RECURSO_PRESENTADO_EXPR = `(${RECURSO_NORMALIZADO_EXPR} IN ('SI', 'S?'))`;
const IS_RECURSO_NO_PRESENTADO_EXPR = `(${RECURSO_NORMALIZADO_EXPR} = 'NO')`;
const IS_DECISION_NEGATIVA_EXPR = `(
  (NOT ${IS_UTILIDAD_PUBLICA_EXPR} AND (
    ${DECISION_NORMALIZADA_EXPR} = 'NO CONCEDE LA SOLICITUD'
    OR ${DECISION_NORMALIZADA_EXPR} = 'NO CONCEDE SUBROGADO PENAL'
  ))
  OR (${IS_UTILIDAD_PUBLICA_EXPR} AND ${DECISION_NORMALIZADA_EXPR} = 'NIEGA UTILIDAD PUBLICA')
)`;
const HAS_BLOQUE5_DATA_EXPR = sqlAnyFilled([
  'g.FECHA_ENTREVISTA_PSICOSOCIAL',
  'g.CUMPLE_REQUISITO_MARGINALIDAD',
  'g.CUMPLE_REQUISITO_JEFATURA_HOGAR',
  'g.REQUIERE_MISION_TRABAJO',
  'g.FECHA_SOLICITUD_MISION_TRABAJO',
  'g.FECHA_ASIGNACION_INVESTIGADOR',
  'g.FECHA_RECEPCION_TODAS_PRUEBAS',
  'g.FECHA_RECEPCION_PRUEBAS_USUARIO',
  'g.FECHA_SOLICITUD_DOCS_INPEC',
  'g.FECHA_RADICACION_UTILIDAD',
  'g.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD',
  'g.FECHA_DECISION_AUTORIDAD',
  'g.SENTIDO_DECISION',
  'g.MOTIVO_DECISION_NEGATIVA',
  'g.SE_PRESENTA_RECURSO',
  'g.FECHA_RECURSO_DESFAVORABLE',
  'g.FECHA_DECISION_RECURSO',
  'g.SENTIDO_DECISION_RESUELVE_RECURSO',
]);
function sqlNegativeProcedencia(columnRef) {
  const normalized = normalizedMojibakeSqlExpr(columnRef);
  return `(${normalized} = 'NO' OR ${normalized} LIKE 'NO APLICA%' OR ${normalized} LIKE 'NO CUMPLE%')`;
}
const ALL_PROCEDENCIAS_NEGATIVAS_EXPR = `(
  ${[
    'g.LIBERTAD_CONDICIONAL',
    'g.PRISION_DOMICILIARIA_MITAD_PENA',
    'g.PROCEDENCIA_PENA_CUMPLIDA',
    'g.PROCEDENCIA_ACUMULACION_PENAS',
  ].map(sqlNegativeProcedencia).join(' AND ')}
  AND (
    NOT (${sqlFilled('g.UTILIDAD_PUBLICA')})
    OR ${sqlNegativeProcedencia('g.UTILIDAD_PUBLICA')}
  )
)`;
const OTRAS_SOLICITUDES_NORMALIZADA_EXPR = normalizedMojibakeSqlExpr('g.OTRAS_SOLICITUDES_TRAMITAR');
const WITHOUT_POSITIVE_OTRAS_SOLICITUDES_EXPR = `(
  ${OTRAS_SOLICITUDES_NORMALIZADA_EXPR} IN (
    '',
    'NINGUNA',
    'MAS DE UNA OPCION',
    'MAS DE UNA OPCION (VER RESUMEN ANALISIS DEL CASO)'
  )
)`;

const AURORA_DERIVED_ESTADO_CODIGO_EXPR = `
  CASE
    WHEN (${ALL_PROCEDENCIAS_NEGATIVAS_EXPR} AND ${WITHOUT_POSITIVE_OTRAS_SOLICITUDES_EXPR})
      OR ${sqlFilled('g.CIERRE_CASO')}
      OR ${HAS_DECISION_RECURSO_EXPR}
      OR (${sqlFilled('g.DECISION_USUARIO')} AND NOT (
        ${DECISION_USUARIO_NORMALIZADA_EXPR} LIKE 'SI%'
      ))
      OR ${ACTUACION_NORMALIZADA_EXPR} LIKE '%NINGUNA%'
      OR ${ACTUACION_NORMALIZADA_EXPR} LIKE '%NO PROCEDE NADA%'
      OR ${normalizedMojibakeSqlExpr('g.CUMPLE_REQUISITO_MARGINALIDAD')} = 'NO'
      OR ${normalizedMojibakeSqlExpr('g.CUMPLE_REQUISITO_JEFATURA_HOGAR')} = 'NO'
      OR (${IS_DECISION_NEGATIVA_EXPR} AND (
        ${IS_RECURSO_NO_PRESENTADO_EXPR}
        OR ${HAS_DECISION_RECURSO_EXPR}
      ))
      OR (NOT ${IS_UTILIDAD_PUBLICA_EXPR}
        AND ${sqlFilled('g.SENTIDO_DECISION')}
        AND NOT (${DECISION_NORMALIZADA_EXPR} IN ('NO CONCEDE LA SOLICITUD', 'NO CONCEDE SUBROGADO PENAL')))
      OR (${IS_UTILIDAD_PUBLICA_EXPR}
        AND ${sqlFilled('g.SENTIDO_DECISION')}
        AND ${DECISION_NORMALIZADA_EXPR} <> 'NIEGA UTILIDAD PUBLICA')
      THEN 'CASO_CERRADO'
    WHEN ${IS_DECISION_NEGATIVA_EXPR}
      AND ${IS_RECURSO_PRESENTADO_EXPR}
      AND NOT (${HAS_DECISION_RECURSO_EXPR})
      THEN 'PENDIENTE_DECISION'
    WHEN ${IS_DECISION_NEGATIVA_EXPR}
      AND NOT (${IS_RECURSO_PRESENTADO_EXPR})
      AND NOT (${IS_RECURSO_NO_PRESENTADO_EXPR})
      THEN 'PRESENTAR_RECURSO'
    WHEN ${sqlFilled('g.FECHA_DECISION_AUTORIDAD')}
      AND NOT (${sqlFilled('g.SENTIDO_DECISION')})
      THEN 'PENDIENTE_DECISION'
    WHEN ${sqlFilled(FECHA_RADICACION_EXPR)}
      AND NOT (${sqlFilled('g.FECHA_DECISION_AUTORIDAD')})
      THEN 'PENDIENTE_DECISION'
    WHEN ${HAS_BLOQUE5_DATA_EXPR}
      AND NOT (${sqlFilled(FECHA_RADICACION_EXPR)})
      THEN 'PRESENTAR_SOLICITUD'
    WHEN ${HAS_ANALISIS_COMPLETO_EXPR}
      AND ${HAS_ENTREVISTA_Y_ACTUACION_EXPR}
      AND NOT (${sqlFilled(FECHA_RADICACION_EXPR)})
      THEN 'PRESENTAR_SOLICITUD'
    WHEN ${HAS_ANALISIS_COMPLETO_EXPR}
      AND NOT (${HAS_ENTREVISTA_Y_ACTUACION_EXPR})
      THEN 'ENTREVISTAR_USUARIO'
    ELSE ${ANALIZAR_CON_FALLBACK_EXPR}
  END
`;

const CELESTE_HAS_ANALISIS_COMPLETO_EXPR = `(
  TRIM(NVL(${DEFENSOR_ACTIVO_EXPR}, '')) IS NOT NULL
  AND ${sqlFilled('g.FECHA_ANALISIS')}
  AND ${sqlFilled('g.ACTUACION_ADELANTAR')}
  AND ${sqlFilled('g.RESUMEN_ANALISIS_CASO')}
)`;
const CELESTE_DERIVED_ESTADO_CODIGO_EXPR = `
  CASE
    WHEN ${ACTUACION_NORMALIZADA_EXPR} LIKE 'NO SE AVANZARA%'
      THEN 'CASO_CERRADO'
    WHEN ${sqlFilled('g.FECHA_DECISION_RECURSO')}
      OR ${sqlFilled('g.SENTIDO_DECISION_RESUELVE_RECURSO')}
      OR ${DECISION_NORMALIZADA_EXPR} LIKE '%REVOCA MEDIDA%'
      OR ${DECISION_NORMALIZADA_EXPR} LIKE '%SUSTITUYE MEDIDA%'
      THEN 'CASO_CERRADO'
    WHEN ${DECISION_NORMALIZADA_EXPR} LIKE '%NIEGA LA SOLICITUD%'
      THEN CASE
        WHEN ${IS_RECURSO_PRESENTADO_EXPR} THEN 'PENDIENTE_DECISION'
        WHEN ${IS_RECURSO_NO_PRESENTADO_EXPR} THEN 'CASO_CERRADO'
        ELSE 'PRESENTAR_RECURSO'
      END
    WHEN ${sqlFilled('g.FECHA_PRESENTACION_RECURSO')} OR ${IS_RECURSO_PRESENTADO_EXPR}
      THEN 'PENDIENTE_DECISION'
    WHEN ${sqlFilled('g.FECHA_REALIZACION_AUDIENCIA')} AND NOT (${sqlFilled('g.SENTIDO_DECISION')})
      THEN 'PENDIENTE_DECISION_AUDIENCIA'
    WHEN ${sqlFilled('g.FECHA_SOLICITUD_AUDIENCIA_CONTROL')}
      AND NOT (${sqlFilled('g.FECHA_REALIZACION_AUDIENCIA')})
      THEN 'PENDIENTE_AUDIENCIA'
    WHEN ${sqlAnyFilled([
      'g.FECHA_SOLICITUD_AUDIENCIA_CONTROL',
      'g.FECHA_REALIZACION_AUDIENCIA',
      'g.SENTIDO_DECISION',
      'g.SE_PRESENTA_RECURSO',
    ])}
      THEN 'PRESENTAR_SOLICITUD'
    WHEN NOT (${CELESTE_HAS_ANALISIS_COMPLETO_EXPR})
      OR ${ACTUACION_NORMALIZADA_EXPR} NOT LIKE 'SE AVANZARA%'
      THEN ${ANALIZAR_CON_FALLBACK_EXPR}
    WHEN NOT (${sqlFilled('g.FECHA_ENTREVISTA')})
      THEN 'ENTREVISTAR_USUARIO'
    ELSE 'PRESENTAR_SOLICITUD'
  END
`;

const DERIVED_ESTADO_CODIGO_EXPR = `
  CASE
    WHEN NVL(s.ACTIVO, 0) <> 1 THEN 'CASO_CERRADO'
    WHEN ${normalizedMojibakeSqlExpr(SITUACION_JURIDICA_EFECTIVA_EXPR)} LIKE '%SINDICAD%'
      THEN (${CELESTE_DERIVED_ESTADO_CODIGO_EXPR})
    ELSE (${AURORA_DERIVED_ESTADO_CODIGO_EXPR})
  END
`;

const ESTADO_CODIGO_EXPR = DERIVED_ESTADO_CODIGO_EXPR;

const ESTADO_ACCION_EXPR = `
  TRIM(
    NVL(${ESTADO_CODIGO_EXPR}, '') || ' ' ||
    NVL(g.ACCION_REALIZAR, '') || ' ' ||
    NVL(g.ACTUACION_ADELANTAR, '')
  )
`;

const PORCENTAJE_NORMALIZADO_EXPR = `
  CASE
    WHEN s.PORCENTAJE IS NULL OR s.PORCENTAJE < 0 THEN NULL
    WHEN s.PORCENTAJE <= 1 THEN s.PORCENTAJE
    WHEN s.PORCENTAJE <= 100 THEN s.PORCENTAJE / 100
    ELSE NULL
  END
`;

const POTENCIAL_SUBROGADO_EXPR = `
  CASE
    WHEN ${normalizedSqlExpr('s.CATEGORIZACION')} LIKE 'PRELIMINAR %'
      THEN 'proximos_requisito_temporal'
    WHEN ${normalizedSqlExpr('s.CATEGORIZACION')} = 'UTILIDAD PUBLICA'
      THEN 'mujeres_potenciales_utilidad_publica'
    WHEN ${normalizedSqlExpr('s.CATEGORIZACION')} LIKE '%PRISION DOMICILIARIA%'
      OR ${normalizedSqlExpr('s.CATEGORIZACION')} LIKE '%LIBERTAD CONDICIONAL%'
      OR ${normalizedSqlExpr('s.CATEGORIZACION')} LIKE '%REVISAR POR PENA%'
      THEN 'potenciales_beneficiarios'
    ELSE 'no_reunen_requisitos'
  END
`;

function buildCondenadosSummaryWhereClause({
  tipo = 'condenado',
  filters = {},
  scopeDepartamentos = DEFAULT_SCOPE_DEPARTAMENTOS,
  includeUserFilters = true,
} = {}) {
  const binds = {};
  const clauses = [];
  const { clause: scopeClause, binds: scopeBinds } = buildScopeWhereClause('s.DEPARTAMENTO', 'dep', scopeDepartamentos);
  Object.assign(binds, scopeBinds);
  clauses.push(scopeClause);
  clauses.push(buildTipoFilter(tipo));

  if (!includeUserFilters) {
    return { clause: clauses.join('\n      AND '), binds };
  }

  const rawDocumento = String(filters?.documento || '').trim();
  const documento = rawDocumento.replace(/\D+/g, '');
  if (documento) {
    binds.documentoPrefix = `${documento}%`;
    clauses.push('TO_CHAR(p.NUMERO) LIKE :documentoPrefix');
  } else if (rawDocumento) {
    clauses.push('1=0');
  }

  const hasLocationFilter = ['lugar', 'centroId', 'departamento', 'municipio']
    .some((key) => String(filters?.[key] || '').trim());
  if (hasLocationFilter) clauses.push('NVL(s.ACTIVO, 0) = 1');

  const rawDefensorId = String(filters?.defensorId || '').trim();
  const defensorId = rawDefensorId.replace(/\D+/g, '');
  if (defensorId) {
    binds.defensorId = defensorId;
    clauses.push('TO_CHAR(a.CEDULA_DEFENSOR) = :defensorId');
  } else if (rawDefensorId && !String(filters?.defensor || '').trim()) {
    clauses.push('1=0');
  }

  const centroId = String(filters?.centroId || '').trim();
  const centroCatalogado = getCentroById(centroId);
  if (centroId === OTROS_LUGARES_ACTIVOS_ID) {
    const aliases = getAllCentroNormalizedAliases();
    const placeholders = aliases.map((alias, index) => {
      const bindKey = `centroOficial${index}`;
      binds[bindKey] = alias;
      return `:${bindKey}`;
    });
    const normalizedCentro = normalizedMojibakeSqlExpr('s.ESTABLECIMIENTO');
    // Oracle trata '' como NULL; comparar <> '' descartaría todas las filas.
    clauses.push('TRIM(s.ESTABLECIMIENTO) IS NOT NULL');
    if (placeholders.length) clauses.push(`${normalizedCentro} NOT IN (${placeholders.join(', ')})`);
  } else if (centroCatalogado) {
    const aliases = getCentroNormalizedAliases(centroCatalogado.id);
    const placeholders = aliases.map((alias, index) => {
      const bindKey = `centroAlias${index}`;
      binds[bindKey] = alias;
      return `:${bindKey}`;
    });
    if (placeholders.length) {
      clauses.push(`${normalizedMojibakeSqlExpr('s.ESTABLECIMIENTO')} IN (${placeholders.join(', ')})`);
    }
  } else if (centroId && !String(filters?.lugar || '').trim()) {
    clauses.push('1=0');
  }

  const textFilters = [
    ['nombre', 'p.NOMBRE', 'contains'],
    ...(defensorId ? [] : [['defensor', DEFENSOR_ACTIVO_EXPR, 'prefix']]),
    ...(centroCatalogado || centroId === OTROS_LUGARES_ACTIVOS_ID
      ? []
      : [['lugar', 's.ESTABLECIMIENTO', 'prefix']]),
    ['departamento', 's.DEPARTAMENTO', 'prefix'],
    ['municipio', 's.MUNICIPIO', 'prefix'],
    ['estadoAccion', `(${ESTADO_ACCION_EXPR})`, 'contains'],
  ];

  textFilters.forEach(([key, columnRef, mode]) => {
    const value = normalizeSearchText(filters?.[key]);
    if (!value) return;
    const bindKey = `${key}Filter`;
    binds[bindKey] = mode === 'contains' ? `%${value}%` : `${value}%`;
    const normalizedColumn = normalizedMojibakeSqlExpr(columnRef);
    clauses.push(`${normalizedColumn} LIKE :${bindKey}`);
  });

  const potencial = String(filters?.potencialSubrogado || '').trim().toLowerCase();
  if (potencial) {
    if (['1', 'true', 'si', 'yes'].includes(potencial)) {
      clauses.push(`${POTENCIAL_SUBROGADO_EXPR} <> 'no_reunen_requisitos'`);
    } else if (['0', 'false', 'no', 'no_reunen_requisitos'].includes(potencial)) {
      clauses.push(`${POTENCIAL_SUBROGADO_EXPR} = 'no_reunen_requisitos'`);
    } else if (
      [
        'potenciales_beneficiarios',
        'mujeres_potenciales_utilidad_publica',
        'proximos_requisito_temporal',
      ].includes(potencial)
    ) {
      binds.potencialSubrogado = potencial;
      clauses.push(`${POTENCIAL_SUBROGADO_EXPR} = :potencialSubrogado`);
    } else {
      clauses.push('1=0');
    }
  }

  return {
    clause: clauses.join('\n      AND '),
    binds,
  };
}

function buildCondenadosSummaryFromAndWhere({
  tipo = 'condenado',
  filters = {},
  scopeDepartamentos = DEFAULT_SCOPE_DEPARTAMENTOS,
  includeUserFilters = true,
} = {}) {
  const { clause, binds } = buildCondenadosSummaryWhereClause({
    tipo,
    filters,
    scopeDepartamentos,
    includeUserFilters,
  });

  const fromAndWhere = `
    FROM DNDP.PERSONA p
    JOIN ranked_situacion s
      ON s.ID_PERSONA = p.ID_PERSONA
     AND s.RN = 1
    LEFT JOIN active_asignacion a
      ON a.ID_PERSONA = p.ID_PERSONA
     AND a.RN = 1
    LEFT JOIN DNDP.DEFENSORES d
      ON d.CEDULA = a.CEDULA_DEFENSOR
    LEFT JOIN latest_gestion g
      ON g.ID_SITUACION = s.ID_SITUACION
     AND g.RN = 1
    LEFT JOIN DNDP.CALIFICACION_CONDUCTA c
      ON c.ID_SITUACION = s.ID_SITUACION
    WHERE ${clause}
  `;

  return { fromAndWhere, binds };
}

async function listCondenadosSummary({
  tipo = 'condenado',
  filters = {},
  limit = 1000,
  scopeDepartamentos = DEFAULT_SCOPE_DEPARTAMENTOS,
  includeExactCounts = true,
} = {}) {
  const safeLimit = Math.max(1, Number.parseInt(String(limit || '1000'), 10) || 1000);
  const fetchLimit = includeExactCounts ? safeLimit : safeLimit + 1;
  const rawEstadoCodigo = String(filters?.estadoCodigo || '').trim();
  const rawEstadoLegado = String(filters?.estado || '').trim();
  const estadoCodigo = resolveEstadoCodigo(rawEstadoCodigo) || resolveEstadoCodigo(rawEstadoLegado);
  const hasEstadoFilter = Boolean(rawEstadoCodigo || rawEstadoLegado);
  const rawAccionCodigo = String(filters?.accionCodigo || '').trim();
  const rawAccionLegada = String(filters?.accion || '').trim();
  const accionCodigo = resolveAccionCodigo(rawAccionCodigo) || resolveAccionCodigo(rawAccionLegada);
  const hasAccionFilter = Boolean(rawAccionCodigo || rawAccionLegada);
  const accionCatalogada = getAccionByCodigo(accionCodigo);
  const repositoryFilters = {
    ...(filters && typeof filters === 'object' ? filters : {}),
    estadoCodigo: '',
    estado: '',
    accionCodigo: '',
    accion: '',
  };
  const activeSituacionCte = buildActiveSituacionCte().replace(/^\s*WITH\s+/i, '');
  const cte = `
    ${activeSituacionCte},
    latest_gestion AS (
      SELECT
        g.*,
        ROW_NUMBER() OVER (
          PARTITION BY g.ID_SITUACION
          ORDER BY ${GESTION_MEANINGFUL_ORDER_EXPR}, g.FECHA_REGISTRO DESC NULLS LAST, g.ID_GESTION DESC
        ) AS RN
      FROM DNDP.GESTION_JURIDICA g
    ),
    active_asignacion AS (
      SELECT
        a.*,
        ROW_NUMBER() OVER (
          PARTITION BY a.ID_PERSONA
          ORDER BY a.FECHA_ASIGNACION DESC NULLS LAST, a.ID_ASIGNACION DESC
        ) AS RN
      FROM DNDP.ASIGNACION a
      WHERE a.FECHA_FIN IS NULL
    )
  `;

  const { fromAndWhere, binds } = buildCondenadosSummaryFromAndWhere({
    tipo,
    filters: repositoryFilters,
    scopeDepartamentos,
    includeUserFilters: true,
  });

  const baseSelectSql = `
      SELECT
        TO_CHAR(p.NUMERO) AS "Numero de identificacion",
        TO_CHAR(p.NUMERO) AS "numero",
        p.NOMBRE AS "Nombre",
        p.NOMBRE AS "Nombre usuario",
        s.ESTABLECIMIENTO AS "Nombre del lugar de privacion de la libertad",
        s.ESTABLECIMIENTO AS "ESTABLECIMIENTO",
        s.DEPARTAMENTO AS "Departamento del lugar de privacion de la libertad",
        s.DEPARTAMENTO AS "Departamento",
        s.MUNICIPIO AS "Distrito/municipio del lugar de privacion de la libertad",
        s.MUNICIPIO AS "Municipio",
        s.AUTORIDAD AS "Autoridad a cargo",
        s.AUTORIDAD AS "autoridad",
        s.PROCESO AS "Numero de proceso",
        s.PROCESO AS "Proceso",
        s.SITUACION AS "Situacion Juridica",
        s.SITUACION AS "situacion",
        s.ACTIVO AS S_ACTIVO,
        s.FUENTE AS FUENTE_SITUACION,
        s.FECHA_CORTE AS FECHA_CORTE_SITUACION,
        s.TOTAL_SITUACIONES AS TOTAL_SITUACIONES,
        s.MIN_ACTIVO_HISTORICO AS MIN_ACTIVO_HISTORICO,
        s.MAX_ACTIVO_HISTORICO AS MAX_ACTIVO_HISTORICO,
        s.SITUACION_JURIDICA_ACTUALIZADA AS "Situacion Juridica actualizada (de conformidad con la rama judicial)",
        ${DEFENSOR_ACTIVO_EXPR} AS "Defensor(a) Publico(a) Asignado para tramitar la solicitud",
        ${DEFENSOR_ACTIVO_EXPR} AS "Defensor(a) Público(a) Asignado para tramitar la solicitud",
        ${DEFENSOR_ACTIVO_EXPR} AS "Defensor",
        TO_CHAR(a.CEDULA_DEFENSOR) AS DEFENSOR_ID,
        s.PENA_DIAS AS "Pena dias",
        s.TIEMPO_EFECTIVO AS "Tiempo efectivo",
        s.PORCENTAJE AS "Porcentaje",
        s.PENA AS "Pena",
        s.PRIVACION AS "Privacion",
        s.REDENCION AS "Redencion",
        s.CATEGORIZACION AS "Categorizacion",
        s.DIAS_PRISION AS "Dias_Prision",
        s.DIAS_LIBERTAD AS "Dias_libertad",
        g.FECHA_ANALISIS AS "Fecha de analisis juridico del caso",
        g.RESUMEN_ANALISIS_CASO AS "Resumen del analisis del caso",
        g.RESUMEN_ANALISIS_CASO AS "RESUMEN DEL ANALISIS JURIDICO DEL PRESENTE CASO",
        g.FECHA_ENTREVISTA AS "Fecha de entrevista",
        g.ACTUACION_ADELANTAR AS "Actuacion a adelantar",
        g.ACTUACION_ADELANTAR AS "PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TERMINOS",
        g.LIBERTAD_CONDICIONAL AS "Procedencia de libertad condicional",
        g.PRISION_DOMICILIARIA_MITAD_PENA AS "Procedencia de prision domiciliaria de mitad de pena",
        g.UTILIDAD_PUBLICA AS "Procedencia de utilidad publica (solo para mujeres)",
        g.PROCEDENCIA_PENA_CUMPLIDA AS "Procedencia de pena cumplida",
        g.PROCEDENCIA_ACUMULACION_PENAS AS "Procedencia de acumulacion de penas",
        g.CON_QUE_PROCESOS_ACUMULAR AS "Con que procesos debe acumular penas (si aplica)",
        g.OTRAS_SOLICITUDES_TRAMITAR AS "Otras solicitudes a tramitar",
        g.DECISION_USUARIO AS "Decision del usuario",
        g.REQUIERE_PRUEBAS AS "Requiere pruebas",
        g.PODER_AVANZAR_SOLICITUD AS "Poder en caso de avanzar con la solicitud",
        g.FECHA_ENTREVISTA_PSICOSOCIAL AS "Fecha de entrevista psicosocial",
        g.CUMPLE_REQUISITO_MARGINALIDAD AS "Cumple el requisito de marginalidad",
        g.CUMPLE_REQUISITO_JEFATURA_HOGAR AS "Cumple el requisito de jefatura de hogar",
        g.REQUIERE_MISION_TRABAJO AS "Se requiere mision de trabajo",
        g.FECHA_SOLICITUD_MISION_TRABAJO AS "Fecha de solicitud de mision de trabajo",
        g.FECHA_ASIGNACION_INVESTIGADOR AS "Fecha de asignacion de investigador",
        g.FECHA_RECEPCION_TODAS_PRUEBAS AS "Fecha en la que se reciben todas las pruebas",
        g.FECHA_RECEPCION_PRUEBAS_USUARIO AS "Fecha de recepcion de pruebas aportadas por el usuario (Si aplica)",
        g.FECHA_SOLICITUD_DOCS_INPEC AS "Fecha de solicitud de documentos al INPEC (Si aplica)",
        g.FECHA_REVISION_EXPEDIENTE AS "FECHA DE REVISION DEL EXPEDIENTE Y ELEMENTOS MATERIALES PROBATORIOS",
        g.CONFIRMACION_PROCEDENCIA_VENCIMIENTO AS "CONFIRMACION DE LA PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TERMINOS",
        g.FECHA_SOLICITUD_AUDIENCIA_CONTROL AS "FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTIAS PARA SUSTENTAR REVOCATORIA",
        g.FECHA_REALIZACION_AUDIENCIA AS "FECHA DE REALIZACION DE AUDIENCIA",
        g.SE_PRESENTA_RECURSO AS "Se presenta recurso",
        g.SE_PRESENTA_RECURSO AS "SE RECURRIO EN CASO DE DECISION NEGATIVA",
        g.SENTIDO_DECISION AS "Sentido de la decision",
        g.SENTIDO_DECISION AS "SENTIDO DE LA DECISION",
        g.MOTIVO_DECISION_NEGATIVA AS "Motivo de la decision negativa",
        g.FECHA_RECURSO_DESFAVORABLE AS "Fecha de recurso en caso desfavorable",
        g.FECHA_PRESENTACION_RECURSO AS "Fecha de presentacion del recurso",
        g.SENTIDO_DECISION_RESUELVE_RECURSO AS "Sentido de la decision que resuelve recurso",
        g.SENTIDO_DECISION_RESUELVE_RECURSO AS "SENTIDO DE LA DECISION QUE RESUELVE RECURSO",
        g.FECHA_DECISION_RECURSO AS "Fecha de la decision del recurso",
        g.CIERRE_CASO AS "Cierre del caso por imposibilidad de avanzar (si aplica)",
        g.SENTIDO_DECISION_RESUELVE_RECURSO AS "Sentido de la decision que resuelve la solicitud",
        g.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD AS "Fecha de presentacion de la solicitud a la autoridad",
        g.FECHA_RADICACION_UTILIDAD AS "Fecha de radicacion de solicitud de utilidad publica",
        g.FECHA_DECISION_AUTORIDAD AS "Fecha de decision de la autoridad",
        a.FECHA_ASIGNACION AS "Fecha de asignacion del PAG",
        CAST(NULL AS VARCHAR2(4000)) AS "Estado del caso",
        CAST(NULL AS VARCHAR2(4000)) AS "Estado del tramite",
        g.ACCION_REALIZAR AS "Accion a realizar",
        CAST(NULL AS VARCHAR2(4000)) AS "posibleActuacionJudicial",
        ${POTENCIAL_SUBROGADO_EXPR} AS CATEGORIA_POTENCIAL_SUBROGADO,
        ${ESTADO_CODIGO_EXPR} AS ESTADO_CODIGO
      ${fromAndWhere}
  `;

  const outerPredicates = [];
  const outerBinds = {};
  if (estadoCodigo) {
    outerPredicates.push('ESTADO_CODIGO = :estadoCodigo');
    outerBinds.estadoCodigo = estadoCodigo;
  } else if (hasEstadoFilter) {
    outerPredicates.push('1=0');
  }
  if (accionCatalogada?.estadoCodigos?.length) {
    const placeholders = accionCatalogada.estadoCodigos.map((codigo, index) => {
      const bindKey = `accionEstado${index}`;
      outerBinds[bindKey] = codigo;
      return `:${bindKey}`;
    });
    outerPredicates.push(`ESTADO_CODIGO IN (${placeholders.join(', ')})`);
  } else if (hasAccionFilter) {
    outerPredicates.push('1=0');
  }
  const estadoPredicate = outerPredicates.length ? outerPredicates.join(' AND ') : '1=1';
  const filteredSelectSql = `
    SELECT
      filtered_rows.*
      ${includeExactCounts ? ', COUNT(*) OVER() AS TOTAL_MATCHED' : ''}
    FROM (
      ${baseSelectSql}
    ) filtered_rows
    WHERE ${estadoPredicate}
  `;

  const rowsSql = `
    WITH
    ${cte}
    SELECT *
    FROM (
      ${filteredSelectSql}
      ORDER BY "Numero de identificacion" ASC
    )
    WHERE ROWNUM <= :limit
  `;

  const result = await execute(
    rowsSql,
    { ...binds, ...outerBinds, limit: fetchLimit },
    { operation: 'persona.listCondenadosSummary.rows' }
  );
  const fetchedRows = Array.isArray(result?.rows) ? result.rows : [];
  const truncated = !includeExactCounts && fetchedRows.length > safeLimit;
  const rows = truncated ? fetchedRows.slice(0, safeLimit) : fetchedRows;
  const totalMatched = includeExactCounts
    ? rows.length
      ? Number(rows[0]?.TOTAL_MATCHED || 0)
      : 0
    : truncated
      ? safeLimit + 1
      : rows.length;

  const hasUserFilters = Object.values(filters || {}).some((value) => String(value || '').trim() !== '');
  if (!hasUserFilters || !includeExactCounts) {
    return {
      rows,
      totalMatched,
      totalAvailable: includeExactCounts ? totalMatched : 0,
      totalMatchedExact: includeExactCounts,
      truncated: includeExactCounts ? totalMatched > safeLimit : truncated,
    };
  }

  const { fromAndWhere: availableFromWhere, binds: availableBinds } = buildCondenadosSummaryFromAndWhere({
    tipo,
    filters: {},
    scopeDepartamentos,
    includeUserFilters: false,
  });

  const availableSql = `
    WITH
    ${cte}
    SELECT COUNT(*) AS TOTAL_AVAILABLE
    ${availableFromWhere}
  `;

  const availableResult = await execute(availableSql, availableBinds, { operation: 'persona.listCondenadosSummary.countAvailable' });
  const availableRow = Array.isArray(availableResult?.rows) ? availableResult.rows[0] : null;

  return {
    rows,
    totalMatched,
    totalAvailable: Number(availableRow?.TOTAL_AVAILABLE || 0),
    totalMatchedExact: true,
    truncated: totalMatched > safeLimit,
  };
}

async function listDistinctCondenadosFilterOptions({
  tipo = 'all',
  filters = {},
  scopeDepartamentos = DEFAULT_SCOPE_DEPARTAMENTOS,
  maxPerField = 1000,
} = {}) {
  const safeMax = Math.max(1, Math.min(5000, Number.parseInt(String(maxPerField || '1000'), 10) || 1000));
  const activeSituacionCte = buildStrictActiveSituacionCte().replace(/^\s*WITH\s+/i, '');
  const cte = `
    ${activeSituacionCte},
    latest_gestion AS (
      SELECT
        g.*,
        ROW_NUMBER() OVER (
          PARTITION BY g.ID_SITUACION
          ORDER BY ${GESTION_MEANINGFUL_ORDER_EXPR}, g.FECHA_REGISTRO DESC NULLS LAST, g.ID_GESTION DESC
        ) AS RN
      FROM DNDP.GESTION_JURIDICA g
    ),
    active_asignacion AS (
      SELECT
        a.*,
        ROW_NUMBER() OVER (
          PARTITION BY a.ID_PERSONA
          ORDER BY a.FECHA_ASIGNACION DESC NULLS LAST, a.ID_ASIGNACION DESC
        ) AS RN
      FROM DNDP.ASIGNACION a
      WHERE a.FECHA_FIN IS NULL
    )
  `;

  async function queryDistinct({ columnRef, alias, fieldFilters = {} }) {
    const { fromAndWhere, binds } = buildCondenadosSummaryFromAndWhere({
      tipo,
      filters: fieldFilters,
      scopeDepartamentos,
      includeUserFilters: true,
    });

    const sql = `
      WITH
      ${cte}
      SELECT ${alias}
      FROM (
        SELECT DISTINCT TRIM(${columnRef}) AS ${alias}
        ${fromAndWhere}
          AND TRIM(${columnRef}) IS NOT NULL
        ORDER BY ${alias} ASC
      )
      WHERE ROWNUM <= :maxRows
    `;

    const result = await execute(sql, { ...binds, maxRows: safeMax }, { operation: `persona.listFilterOptions.${alias}` });
    return (Array.isArray(result?.rows) ? result.rows : [])
      .map((row) => String(row?.[alias] || '').trim())
      .filter(Boolean);
  }

  async function queryDefensorOptions() {
    const { fromAndWhere, binds } = buildCondenadosSummaryFromAndWhere({
      tipo,
      filters: {},
      scopeDepartamentos,
      includeUserFilters: true,
    });
    const sql = `
      WITH
      ${cte}
      SELECT DEFENSOR_ID, DEFENSOR
      FROM (
        SELECT DISTINCT
          TRIM(TO_CHAR(a.CEDULA_DEFENSOR)) AS DEFENSOR_ID,
          TRIM(${DEFENSOR_ACTIVO_EXPR}) AS DEFENSOR
        ${fromAndWhere}
          AND TRIM(${DEFENSOR_ACTIVO_EXPR}) IS NOT NULL
        ORDER BY DEFENSOR ASC
      )
      WHERE ROWNUM <= :maxRows
    `;
    const result = await execute(
      sql,
      { ...binds, maxRows: safeMax },
      { operation: 'persona.listFilterOptions.DEFENSOR_OPTIONS' }
    );
    return (Array.isArray(result?.rows) ? result.rows : [])
      .map((row) => ({
        id: String(row?.DEFENSOR_ID || '').trim(),
        label: String(row?.DEFENSOR || '').trim(),
      }))
      .filter((item) => item.label);
  }

  const departamento = String(filters?.departamento || '').trim();
  const municipio = String(filters?.municipio || '').trim();

  const [departamentos, municipios, lugares, defensorOptions] = await Promise.all([
    queryDistinct({
      columnRef: 's.DEPARTAMENTO',
      alias: 'DEPARTAMENTO',
      fieldFilters: {},
    }),
    queryDistinct({
      columnRef: 's.MUNICIPIO',
      alias: 'MUNICIPIO',
      fieldFilters: { departamento },
    }),
    queryDistinct({
      columnRef: 's.ESTABLECIMIENTO',
      alias: 'LUGAR',
      fieldFilters: { departamento, municipio },
    }),
    queryDefensorOptions(),
  ]);

  const defensores = defensorOptions.map((item) => item.label);

  return {
    departamentos,
    municipios,
    lugares,
    defensores,
    defensorOptions,
  };
}

async function listCondenadosHomologationValues({
  tipo = 'all',
  scopeDepartamentos = DEFAULT_SCOPE_DEPARTAMENTOS,
  maxPerField = 5000,
} = {}) {
  const safeMax = Math.max(1, Math.min(5000, Number.parseInt(String(maxPerField || '5000'), 10) || 5000));
  // La auditoría que alimenta la homologación debe usar el mismo universo del
  // filtro visible: únicamente personas cuya situación vigente sigue activa.
  const activeSituacionCte = buildStrictActiveSituacionCte().replace(/^\s*WITH\s+/i, '');
  const cte = `
    ${activeSituacionCte},
    latest_gestion AS (
      SELECT
        g.*,
        ROW_NUMBER() OVER (
          PARTITION BY g.ID_SITUACION
          ORDER BY ${GESTION_MEANINGFUL_ORDER_EXPR}, g.FECHA_REGISTRO DESC NULLS LAST, g.ID_GESTION DESC
        ) AS RN
      FROM DNDP.GESTION_JURIDICA g
    ),
    active_asignacion AS (
      SELECT
        a.*,
        ROW_NUMBER() OVER (
          PARTITION BY a.ID_PERSONA
          ORDER BY a.FECHA_ASIGNACION DESC NULLS LAST, a.ID_ASIGNACION DESC
        ) AS RN
      FROM DNDP.ASIGNACION a
      WHERE a.FECHA_FIN IS NULL
    )
  `;
  const { fromAndWhere, binds } = buildCondenadosSummaryFromAndWhere({
    tipo,
    filters: {},
    scopeDepartamentos,
    includeUserFilters: false,
  });

  const centersSql = `
    WITH
    ${cte}
    SELECT LUGAR, TOTAL
    FROM (
      SELECT
        TRIM(s.ESTABLECIMIENTO) AS LUGAR,
        COUNT(*) AS TOTAL
      ${fromAndWhere}
        AND TRIM(s.ESTABLECIMIENTO) IS NOT NULL
      GROUP BY TRIM(s.ESTABLECIMIENTO)
      ORDER BY TOTAL DESC, LUGAR ASC
    )
    WHERE ROWNUM <= :maxRows
  `;
  const actionsSql = `
    WITH
    ${cte}
    SELECT ESTADO_CODIGO, ACCION_ORIGINAL, TOTAL
    FROM (
      SELECT
        ${ESTADO_CODIGO_EXPR} AS ESTADO_CODIGO,
        TRIM(g.ACCION_REALIZAR) AS ACCION_ORIGINAL,
        COUNT(*) AS TOTAL
      ${fromAndWhere}
      GROUP BY ${ESTADO_CODIGO_EXPR}, TRIM(g.ACCION_REALIZAR)
      ORDER BY TOTAL DESC, ESTADO_CODIGO ASC, ACCION_ORIGINAL ASC
    )
    WHERE ROWNUM <= :maxRows
  `;

  const [centersResult, actionsResult] = await Promise.all([
    execute(centersSql, { ...binds, maxRows: safeMax }, { operation: 'persona.listHomologationValues.CENTERS' }),
    execute(actionsSql, { ...binds, maxRows: safeMax }, { operation: 'persona.listHomologationValues.ACTIONS' }),
  ]);

  return {
    centros: (Array.isArray(centersResult?.rows) ? centersResult.rows : []).map((row) => ({
      valor: String(row?.LUGAR || '').trim(),
      cantidad: Number(row?.TOTAL || 0),
    })),
    acciones: (Array.isArray(actionsResult?.rows) ? actionsResult.rows : []).map((row) => ({
      estadoCodigo: String(row?.ESTADO_CODIGO || '').trim(),
      valorOriginal: String(row?.ACCION_ORIGINAL || '').trim(),
      cantidad: Number(row?.TOTAL || 0),
    })),
  };
}

async function listRowsWithActiveSituacionAndGestiones({
  documento = '',
  scopeDepartamentos = DEFAULT_SCOPE_DEPARTAMENTOS,
} = {}) {
  const { clause: scopeClause, binds: scopeBinds } = buildScopeWhereClause('s.DEPARTAMENTO', 'dep', scopeDepartamentos);
  const hasDocumento = String(documento || '').trim() !== '';

  const sql = `
    ${buildActiveSituacionCte()}
    SELECT
      ${BASE_SELECT_COLUMNS}
    FROM DNDP.PERSONA p
    JOIN ranked_situacion s
      ON s.ID_PERSONA = p.ID_PERSONA
     AND s.RN = 1
    LEFT JOIN DNDP.GESTION_JURIDICA g
      ON g.ID_SITUACION = s.ID_SITUACION
    LEFT JOIN (
      SELECT
        a.*,
        ROW_NUMBER() OVER (
          PARTITION BY a.ID_PERSONA
          ORDER BY a.FECHA_ASIGNACION DESC NULLS LAST, a.ID_ASIGNACION DESC
        ) AS RN
      FROM DNDP.ASIGNACION a
      WHERE a.FECHA_FIN IS NULL
    ) a
      ON a.ID_PERSONA = p.ID_PERSONA
     AND a.RN = 1
    LEFT JOIN DNDP.DEFENSORES d
      ON d.CEDULA = a.CEDULA_DEFENSOR
    LEFT JOIN DNDP.CALIFICACION_CONDUCTA c
      ON c.ID_SITUACION = s.ID_SITUACION
    WHERE ${scopeClause}
      ${hasDocumento ? 'AND TO_CHAR(p.NUMERO) = :documento' : ''}
    ORDER BY
      TO_CHAR(p.NUMERO) ASC,
      NVL(g.FECHA_REGISTRO, s.FECHA_REGISTRO) ASC NULLS LAST,
      NVL(g.ID_GESTION, 0) ASC
  `;

  const binds = {
    ...scopeBinds,
    ...(hasDocumento ? { documento: String(documento).trim() } : {}),
  };

  const result = await execute(sql, binds, { operation: 'persona.listRowsWithActiveSituacionAndGestiones' });
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function findActiveContextByDocumento(documento, { scopeDepartamentos = DEFAULT_SCOPE_DEPARTAMENTOS } = {}) {
  const rows = await listRowsWithActiveSituacionAndGestiones({ documento, scopeDepartamentos });
  return rows.length ? rows[0] : null;
}

async function listDistinctDefensores({ tipo = '', scopeDepartamentos = DEFAULT_SCOPE_DEPARTAMENTOS } = {}) {
  const { clause: scopeClause, binds: scopeBinds } = buildScopeWhereClause('s.DEPARTAMENTO', 'dep', scopeDepartamentos);
  const tipoClause = buildTipoFilter(tipo);

  const sql = `
    ${buildActiveSituacionCte()}
    SELECT DISTINCT
      TRIM(${DEFENSOR_ACTIVO_EXPR}) AS DEFENSOR
    FROM ranked_situacion s
    JOIN DNDP.PERSONA p
      ON p.ID_PERSONA = s.ID_PERSONA
    LEFT JOIN (
      SELECT
        a.*,
        ROW_NUMBER() OVER (
          PARTITION BY a.ID_PERSONA
          ORDER BY a.FECHA_ASIGNACION DESC NULLS LAST, a.ID_ASIGNACION DESC
        ) AS RN
      FROM DNDP.ASIGNACION a
      WHERE a.FECHA_FIN IS NULL
    ) a
      ON a.ID_PERSONA = p.ID_PERSONA
     AND a.RN = 1
    LEFT JOIN DNDP.DEFENSORES d
      ON d.CEDULA = a.CEDULA_DEFENSOR
    WHERE s.RN = 1
      AND ${scopeClause}
      AND ${tipoClause}
      AND TRIM(NVL(${DEFENSOR_ACTIVO_EXPR}, '')) <> ''
    ORDER BY DEFENSOR ASC
  `;

  const result = await execute(sql, scopeBinds, { operation: 'persona.listDistinctDefensores' });
  return (Array.isArray(result?.rows) ? result.rows : [])
    .map((row) => String(row?.DEFENSOR || '').trim())
    .filter(Boolean);
}

async function updatePersonaById(idPersona, fields = {}) {
  const updates = Object.entries(fields || {}).filter(([column]) => PERSONA_COLUMNS.has(String(column || '').toUpperCase()));
  if (!updates.length) return 0;

  const setClauses = [];
  const binds = { idPersona: Number(idPersona) };

  updates.forEach(([column, value], idx) => {
    const bindKey = `v${idx}`;
    setClauses.push(`${String(column).toUpperCase()} = :${bindKey}`);
    binds[bindKey] = value;
  });

  const sql = `
    UPDATE DNDP.PERSONA
       SET ${setClauses.join(', ')}
     WHERE ID_PERSONA = :idPersona
  `;

  const result = await execute(sql, binds, {
    autoCommit: true,
    operation: 'persona.updatePersonaById',
  });

  return Number(result?.rowsAffected || 0);
}

module.exports = {
  listRowsWithActiveSituacionAndGestiones,
  listCondenadosSummary,
  listCondenadosHomologationValues,
  listDistinctCondenadosFilterOptions,
  findActiveContextByDocumento,
  listDistinctDefensores,
  updatePersonaById,
  PERSONA_COLUMNS,
};
