const { execute, getOracleDriver } = require('../../db/oraclePool');

const GESTION_COLUMNS = new Set([
  'ACCION_REALIZAR',
  'FECHA_ANALISIS',
  'VENCIMIENTO_TERMINOS',
  'UTILIDAD_PUBLICA',
  'LIBERTAD_CONDICIONAL',
  'PRISION_DOMICILIARIA_MITAD_PENA',
  'PROCEDENCIA_PENA_CUMPLIDA',
  'PROCEDENCIA_ACUMULACION_PENAS',
  'CON_QUE_PROCESOS_ACUMULAR',
  'OTRAS_SOLICITUDES_TRAMITAR',
  'RESUMEN_ANALISIS_CASO',
  'FECHA_ENTREVISTA',
  'DECISION_USUARIO',
  'ACTUACION_ADELANTAR',
  'REQUIERE_PRUEBAS',
  'PODER_AVANZAR_SOLICITUD',
  'FECHA_ENTREVISTA_PSICOSOCIAL',
  'CUMPLE_REQUISITO_MARGINALIDAD',
  'CUMPLE_REQUISITO_JEFATURA_HOGAR',
  'REQUIERE_MISION_TRABAJO',
  'FECHA_SOLICITUD_MISION_TRABAJO',
  'FECHA_ASIGNACION_INVESTIGADOR',
  'FECHA_RECEPCION_TODAS_PRUEBAS',
  'FECHA_RECEPCION_PRUEBAS_USUARIO',
  'FECHA_SOLICITUD_DOCS_INPEC',
  'FECHA_REVISION_EXPEDIENTE',
  'CONFIRMACION_PROCEDENCIA_VENCIMIENTO',
  'FECHA_SOLICITUD_AUDIENCIA_CONTROL',
  'FECHA_REALIZACION_AUDIENCIA',
  'FECHA_PRESENTACION_SOLICITUD_AUTORIDAD',
  'FECHA_DECISION_AUTORIDAD',
  'FECHA_RADICACION_UTILIDAD',
  'SENTIDO_DECISION',
  'INSISTENCIAS',
  'FECHA_INSISTENCIA_1',
  'FECHA_INSISTENCIA_2',
  'FECHA_INSISTENCIA_3',
  'FECHA_INSISTENCIA_4',
  'FECHA_INSISTENCIA_5',
  'MOTIVO_DECISION_NEGATIVA',
  'SE_PRESENTA_RECURSO',
  'FECHA_RECURSO_DESFAVORABLE',
  'FECHA_PRESENTACION_RECURSO',
  'FECHA_DECISION_RECURSO',
  'SENTIDO_DECISION_RESUELVE_RECURSO',
  'CIERRE_CASO',
  'FECHA_REGISTRO',
]);

function safeSequenceName(name) {
  const value = String(name || '').trim();
  if (!value) return '';
  if (!/^[A-Za-z0-9_$.]+$/.test(value)) {
    throw new Error(`Nombre de secuencia Oracle invalido: ${value}`);
  }
  return value;
}

async function listBySituacion(idSituacion) {
  const sql = `
    SELECT *
      FROM DNDP.GESTION_JURIDICA
     WHERE ID_SITUACION = :idSituacion
     ORDER BY FECHA_REGISTRO ASC NULLS LAST, ID_GESTION ASC
  `;
  const result = await execute(sql, { idSituacion: Number(idSituacion) }, { operation: 'gestion.listBySituacion' });
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function getLatestBySituacion(idSituacion) {
  const sql = `
    SELECT *
      FROM DNDP.GESTION_JURIDICA
     WHERE ID_SITUACION = :idSituacion
     ORDER BY FECHA_REGISTRO DESC NULLS LAST, ID_GESTION DESC
     FETCH FIRST 1 ROWS ONLY
  `;
  const result = await execute(sql, { idSituacion: Number(idSituacion) }, { operation: 'gestion.getLatestBySituacion' });
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  return rows[0] || null;
}

async function getById(idGestion, idSituacion = null) {
  const hasSituacion = Number.isFinite(Number(idSituacion));
  const sql = `
    SELECT *
      FROM DNDP.GESTION_JURIDICA
     WHERE ID_GESTION = :idGestion
       ${hasSituacion ? 'AND ID_SITUACION = :idSituacion' : ''}
  `;

  const binds = {
    idGestion: Number(idGestion),
    ...(hasSituacion ? { idSituacion: Number(idSituacion) } : {}),
  };

  const result = await execute(sql, binds, { operation: 'gestion.getById' });
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  return rows[0] || null;
}

async function getNextGestionIdFromMax() {
  const result = await execute(
    'SELECT NVL(MAX(ID_GESTION), 0) + 1 AS NEXT_ID FROM DNDP.GESTION_JURIDICA',
    {},
    { operation: 'gestion.getNextGestionIdFromMax' }
  );
  const row = Array.isArray(result?.rows) ? result.rows[0] : null;
  return Number(row?.NEXT_ID || 0);
}

async function getNextGestionIdFromSequence(sequenceName) {
  const safe = safeSequenceName(sequenceName);
  if (!safe) return null;
  const sql = `SELECT ${safe}.NEXTVAL AS NEXT_ID FROM dual`;
  const result = await execute(sql, {}, { operation: 'gestion.getNextGestionIdFromSequence' });
  const row = Array.isArray(result?.rows) ? result.rows[0] : null;
  return Number(row?.NEXT_ID || 0);
}

function toGestionFields(fields = {}) {
  const out = {};
  Object.entries(fields || {}).forEach(([column, value]) => {
    const col = String(column || '').toUpperCase();
    if (!GESTION_COLUMNS.has(col)) return;
    out[col] = value;
  });
  return out;
}

async function insertGestion(idSituacion, fields = {}, options = {}) {
  const oracledb = getOracleDriver();
  const cleanFields = toGestionFields(fields);

  if (!Object.prototype.hasOwnProperty.call(cleanFields, 'FECHA_REGISTRO')) {
    cleanFields.FECHA_REGISTRO = new Date();
  }

  const sequenceName = String(options?.sequenceName || '').trim();

  async function doInsertWithId(explicitId = null) {
    const columns = ['ID_SITUACION'];
    const placeholders = [':idSituacion'];
    const binds = { idSituacion: Number(idSituacion) };

    if (Number.isFinite(Number(explicitId)) && Number(explicitId) > 0) {
      columns.push('ID_GESTION');
      placeholders.push(':idGestion');
      binds.idGestion = Number(explicitId);
    }

    Object.entries(cleanFields).forEach(([column, value], idx) => {
      const bindKey = `v${idx}`;
      columns.push(column);
      placeholders.push(`:${bindKey}`);
      binds[bindKey] = value;
    });

    const sql = `
      INSERT INTO DNDP.GESTION_JURIDICA (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING ID_GESTION INTO :outId
    `;

    binds.outId = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };

    const result = await execute(sql, binds, {
      autoCommit: true,
      operation: 'gestion.insertGestion',
    });

    const outId = Number(result?.outBinds?.outId?.[0] ?? result?.outBinds?.outId);
    return Number.isFinite(outId) ? outId : null;
  }

  try {
    if (sequenceName) {
      const nextId = await getNextGestionIdFromSequence(sequenceName);
      return await doInsertWithId(nextId);
    }

    return await doInsertWithId(null);
  } catch (err) {
    const message = String(err?.message || '');
    const shouldFallbackToMax = message.includes('ORA-01400') || message.includes('ORA-00001');
    if (!shouldFallbackToMax) throw err;

    const fallbackId = await getNextGestionIdFromMax();
    return doInsertWithId(fallbackId);
  }
}

async function updateGestionById(idGestion, fields = {}) {
  const updates = Object.entries(toGestionFields(fields));
  if (!updates.length) return 0;

  const setClauses = [];
  const binds = { idGestion: Number(idGestion) };

  updates.forEach(([column, value], idx) => {
    const bindKey = `v${idx}`;
    setClauses.push(`${column} = :${bindKey}`);
    binds[bindKey] = value;
  });

  const sql = `
    UPDATE DNDP.GESTION_JURIDICA
       SET ${setClauses.join(', ')}
     WHERE ID_GESTION = :idGestion
  `;

  const result = await execute(sql, binds, {
    autoCommit: true,
    operation: 'gestion.updateGestionById',
  });

  return Number(result?.rowsAffected || 0);
}

module.exports = {
  listBySituacion,
  getLatestBySituacion,
  getById,
  insertGestion,
  updateGestionById,
  GESTION_COLUMNS,
};
