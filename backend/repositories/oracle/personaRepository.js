const { execute } = require('../../db/oraclePool');
const { buildActiveSituacionCte, buildScopeWhereClause, DEFAULT_SCOPE_DEPARTAMENTOS, normalizedSqlExpr } = require('./sqlFragments');

const DEFENSOR_ACTIVO_EXPR = 'COALESCE(TO_NCHAR(a.NOMBRE_DEFENSOR), TO_NCHAR(d.NOMBRE))';

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

function buildTipoFilter(tipo) {
  const safeTipo = String(tipo || '').trim().toLowerCase();
  if (safeTipo === 'condenado') {
    return "(LOWER(NVL(s.SITUACION_JURIDICA_ACTUALIZADA, '')) LIKE '%condenad%' OR LOWER(NVL(s.SITUACION, '')) LIKE '%condenad%')";
  }
  if (safeTipo === 'sindicado') {
    return "(LOWER(NVL(s.SITUACION_JURIDICA_ACTUALIZADA, '')) LIKE '%sindicad%' OR LOWER(NVL(s.SITUACION, '')) LIKE '%sindicad%')";
  }
  return '1=1';
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function buildCanonicalEstadoCase(columnRef) {
  const normalized = normalizedSqlExpr(columnRef);
  return `
    CASE
      WHEN ${normalized} LIKE '%ANALIZAR EL CASO%' THEN 'Analizar el caso'
      WHEN ${normalized} LIKE '%ENTREVISTAR AL USUARIO%' THEN 'Entrevistar al usuario'
      WHEN ${normalized} LIKE '%PRESENTAR SOLICITUD%' THEN 'Presentar solicitud'
      WHEN ${normalized} LIKE '%PENDIENTE DECISION%' THEN 'Pendiente decisión'
      WHEN ${normalized} LIKE '%CASO CERRADO%' OR ${normalized} = 'CERRADO' THEN 'Caso cerrado'
      ELSE NULL
    END
  `;
}

const ESTADO_LABEL_EXPR = `
  COALESCE(
    ${buildCanonicalEstadoCase('g.ACCION_REALIZAR')},
    ${buildCanonicalEstadoCase('g.ACTUACION_ADELANTAR')},
    ''
  )
`;

const ESTADO_ACCION_EXPR = `
  TRIM(
    NVL(${ESTADO_LABEL_EXPR}, '') || ' ' ||
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
    WHEN ${normalizedSqlExpr('s.CATEGORIZACION')} IN (
      'PRISION DOMICILIARIA Y LIBERTAD CONDICIONAL',
      'PRISION DOMICILIARIA',
      'REVISAR POR PENA',
      'LIBERTAD CONDICIONAL',
      'UTILIDAD PUBLICA'
    ) THEN 'potenciales_beneficiarios'
    WHEN ${normalizedSqlExpr('s.CATEGORIZACION')} IN (
      'PRELIMINAR PRISION DOMICILIARIA',
      'PRELIMINAR LIBERTAD CONDICIONAL'
    ) THEN 'proximos_requisito_temporal'
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

  const documento = String(filters?.documento || '').replace(/\D+/g, '');
  if (documento) {
    binds.documentoPrefix = `${documento}%`;
    clauses.push('TO_CHAR(p.NUMERO) LIKE :documentoPrefix');
  }

  const textFilters = [
    ['nombre', 'p.NOMBRE', 'contains'],
    ['defensor', DEFENSOR_ACTIVO_EXPR, 'prefix'],
    ['lugar', 's.ESTABLECIMIENTO', 'prefix'],
    ['departamento', 's.DEPARTAMENTO', 'prefix'],
    ['municipio', 's.MUNICIPIO', 'prefix'],
    ['estadoAccion', `(${ESTADO_ACCION_EXPR})`, 'contains'],
  ];

  textFilters.forEach(([key, columnRef, mode]) => {
    const value = normalizeSearchText(filters?.[key]);
    if (!value) return;
    const bindKey = `${key}Filter`;
    binds[bindKey] = mode === 'contains' ? `%${value}%` : `${value}%`;
    clauses.push(`${normalizedSqlExpr(columnRef)} LIKE :${bindKey}`);
  });

  const estado = normalizeSearchText(filters?.estado);
  if (estado) {
    const canonicalMap = new Map([
      ['ANALIZAR EL CASO', 'Analizar el caso'],
      ['ENTREVISTAR AL USUARIO', 'Entrevistar al usuario'],
      ['PRESENTAR SOLICITUD', 'Presentar solicitud'],
      ['PENDIENTE DECISION', 'Pendiente decisión'],
      ['CASO CERRADO', 'Caso cerrado'],
      ['CERRADO', 'Caso cerrado'],
    ]);
    const canonical = canonicalMap.get(estado) || '';
    if (canonical) {
      binds.estadoCanonico = canonical;
      clauses.push(`${ESTADO_LABEL_EXPR} = :estadoCanonico`);
    }
  }

  const potencial = String(filters?.potencialSubrogado || '').trim().toLowerCase();
  if (potencial) {
    if (['1', 'true', 'si', 'yes'].includes(potencial)) {
      clauses.push(`${POTENCIAL_SUBROGADO_EXPR} <> 'no_reunen_requisitos'`);
    } else if (['0', 'false', 'no', 'no_reunen_requisitos'].includes(potencial)) {
      clauses.push(`${POTENCIAL_SUBROGADO_EXPR} = 'no_reunen_requisitos'`);
    } else if (['potenciales_beneficiarios', 'proximos_requisito_temporal'].includes(potencial)) {
      binds.potencialSubrogado = potencial;
      clauses.push(`${POTENCIAL_SUBROGADO_EXPR} = :potencialSubrogado`);
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
} = {}) {
  const safeLimit = Math.max(1, Number.parseInt(String(limit || '1000'), 10) || 1000);
  const activeSituacionCte = buildActiveSituacionCte().replace(/^\s*WITH\s+/i, '');
  const cte = `
    ${activeSituacionCte},
    latest_gestion AS (
      SELECT
        g.*,
        ROW_NUMBER() OVER (
          PARTITION BY g.ID_SITUACION
          ORDER BY g.FECHA_REGISTRO DESC NULLS LAST, g.ID_GESTION DESC
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
    filters,
    scopeDepartamentos,
    includeUserFilters: true,
  });

  const rowsSql = `
    WITH
    ${cte}
    SELECT *
    FROM (
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
        s.SITUACION_JURIDICA_ACTUALIZADA AS "Situacion Juridica actualizada (de conformidad con la rama judicial)",
        ${DEFENSOR_ACTIVO_EXPR} AS "Defensor(a) Publico(a) Asignado para tramitar la solicitud",
        ${DEFENSOR_ACTIVO_EXPR} AS "Defensor",
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
        g.FECHA_ENTREVISTA AS "Fecha de entrevista",
        g.ACTUACION_ADELANTAR AS "Actuacion a adelantar",
        g.LIBERTAD_CONDICIONAL AS "Procedencia de libertad condicional",
        g.PRISION_DOMICILIARIA_MITAD_PENA AS "Procedencia de prision domiciliaria de mitad de pena",
        g.UTILIDAD_PUBLICA AS "Procedencia de utilidad publica (solo para mujeres)",
        g.PROCEDENCIA_PENA_CUMPLIDA AS "Procedencia de pena cumplida",
        g.PROCEDENCIA_ACUMULACION_PENAS AS "Procedencia de acumulacion de penas",
        g.OTRAS_SOLICITUDES_TRAMITAR AS "Otras solicitudes a tramitar",
        g.DECISION_USUARIO AS "Decision del usuario",
        g.CUMPLE_REQUISITO_MARGINALIDAD AS "Cumple el requisito de marginalidad",
        g.CUMPLE_REQUISITO_JEFATURA_HOGAR AS "Cumple el requisito de jefatura de hogar",
        g.SE_PRESENTA_RECURSO AS "Se presenta recurso",
        g.SENTIDO_DECISION AS "Sentido de la decision",
        g.SENTIDO_DECISION_RESUELVE_RECURSO AS "Sentido de la decision que resuelve recurso",
        CAST(NULL AS VARCHAR2(4000)) AS "Sentido de la decision que resuelve la solicitud",
        g.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD AS "Fecha de presentacion de la solicitud a la autoridad",
        g.FECHA_RADICACION_UTILIDAD AS "Fecha de radicacion de solicitud de utilidad publica",
        g.FECHA_DECISION_AUTORIDAD AS "Fecha de decision de la autoridad",
        a.FECHA_ASIGNACION AS "Fecha de asignacion del PAG",
        CAST(NULL AS VARCHAR2(4000)) AS "Estado del caso",
        CAST(NULL AS VARCHAR2(4000)) AS "Estado del tramite",
        g.ACCION_REALIZAR AS "Accion a realizar",
        CAST(NULL AS VARCHAR2(4000)) AS "posibleActuacionJudicial",
        ${POTENCIAL_SUBROGADO_EXPR} AS CATEGORIA_POTENCIAL_SUBROGADO,
        ${ESTADO_LABEL_EXPR} AS ESTADO_DERIVADO,
        COUNT(*) OVER() AS TOTAL_MATCHED
      ${fromAndWhere}
      ORDER BY TO_CHAR(p.NUMERO) ASC
    )
    WHERE ROWNUM <= :limit
  `;

  const result = await execute(rowsSql, { ...binds, limit: safeLimit }, { operation: 'persona.listCondenadosSummary.rows' });
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const totalMatched = rows.length ? Number(rows[0]?.TOTAL_MATCHED || 0) : 0;

  const hasUserFilters = Object.values(filters || {}).some((value) => String(value || '').trim() !== '');
  if (!hasUserFilters) {
    return {
      rows,
      totalMatched,
      totalAvailable: totalMatched,
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
  };
}

async function listDistinctCondenadosFilterOptions({
  tipo = 'all',
  filters = {},
  scopeDepartamentos = DEFAULT_SCOPE_DEPARTAMENTOS,
  maxPerField = 1000,
} = {}) {
  const safeMax = Math.max(1, Math.min(5000, Number.parseInt(String(maxPerField || '1000'), 10) || 1000));
  const activeSituacionCte = buildActiveSituacionCte().replace(/^\s*WITH\s+/i, '');
  const cte = `
    ${activeSituacionCte},
    latest_gestion AS (
      SELECT
        g.*,
        ROW_NUMBER() OVER (
          PARTITION BY g.ID_SITUACION
          ORDER BY g.FECHA_REGISTRO DESC NULLS LAST, g.ID_GESTION DESC
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

  const departamento = String(filters?.departamento || '').trim();
  const municipio = String(filters?.municipio || '').trim();
  const defensor = String(filters?.defensor || '').trim();

  const [departamentos, municipios, lugares, defensores] = await Promise.all([
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
    queryDistinct({
      columnRef: DEFENSOR_ACTIVO_EXPR,
      alias: 'DEFENSOR',
      fieldFilters: { defensor },
    }),
  ]);

  return {
    departamentos,
    municipios,
    lugares,
    defensores,
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
  listDistinctCondenadosFilterOptions,
  findActiveContextByDocumento,
  listDistinctDefensores,
  updatePersonaById,
  PERSONA_COLUMNS,
};
