const { execute } = require('../../db/oraclePool');
const { buildActiveSituacionCte, buildScopeWhereClause, DEFAULT_SCOPE_DEPARTAMENTOS } = require('./sqlFragments');

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
  's.FECHA_CALIFICACION AS S_FECHA_CALIFICACION',
  's.CALIFICACION AS S_CALIFICACION',
  's.FECHA_REGISTRO AS S_FECHA_REGISTRO',
  's.ACTIVO AS S_ACTIVO',

  'g.ID_GESTION AS G_ID_GESTION',
  'g.ID_SITUACION AS G_ID_SITUACION',
  'g.PAG AS G_PAG',
  'g.DEFENSOR AS G_DEFENSOR',
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
  'g.SENTIDO_DECISION AS G_SENTIDO_DECISION',
  'g.MOTIVO_DECISION_NEGATIVA AS G_MOTIVO_DECISION_NEGATIVA',
  'g.SE_PRESENTA_RECURSO AS G_SE_PRESENTA_RECURSO',
  'g.FECHA_RECURSO_DESFAVORABLE AS G_FECHA_RECURSO_DESFAVORABLE',
  'g.SENTIDO_DECISION_RESUELVE_RECURSO AS G_SENTIDO_DECISION_RESUELVE_RECURSO',
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
      TRIM(g.DEFENSOR) AS DEFENSOR
    FROM ranked_situacion s
    JOIN DNDP.PERSONA p
      ON p.ID_PERSONA = s.ID_PERSONA
    JOIN DNDP.GESTION_JURIDICA g
      ON g.ID_SITUACION = s.ID_SITUACION
    WHERE s.RN = 1
      AND ${scopeClause}
      AND ${tipoClause}
      AND TRIM(NVL(g.DEFENSOR, '')) <> ''
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
  findActiveContextByDocumento,
  listDistinctDefensores,
  updatePersonaById,
  PERSONA_COLUMNS,
};
