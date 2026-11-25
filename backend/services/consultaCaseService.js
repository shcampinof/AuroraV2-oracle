const consolidado = require('../db/oracleConsolidado.repo');
const personaRepo = require('../repositories/oracle/personaRepository');
const { normalizeRoles } = require('./authService');
const { findUser, listUsers, updateManagedUser } = require('./userDirectoryService');

const isConsulta = (user) => normalizeRoles(user?.roles, []).includes('consulta');
const caseId = (record) => String(record?.__oracleIdSituacion || '');
const currentDefensor = (record) => String(record?.defensorActivo ?? record?.defensorAsignado ?? '').trim();

function failure(message, status = 403, code = 'CONSULTA_CASE_FORBIDDEN') {
  return Object.assign(new Error(message), { status, code });
}

function canEditCase(user, record) {
  return Boolean(record && currentDefensor(record) && caseId(record) && user?.enabled !== false &&
    isConsulta(user) && user.consultaCases?.some((grant) => grant.situacionId === caseId(record)));
}

function withConsultaAccess(record, user) {
  if (!record || !isConsulta(user)) return record;
  return { ...record, __consultaPuedeEditar: canEditCase(findUser(user), record) };
}

function describeCase(record) {
  return {
    situacionId: caseId(record),
    documento: String(record.numeroIdentificacion || record['Número de identificación'] || ''),
    nombre: String(record.Nombre || ''),
    proceso: String(record['Número de proceso'] || record.Proceso || ''),
    defensor: currentDefensor(record),
  };
}

function collaborator(id) {
  const user = listUsers().find((item) => item.id === id);
  if (!user) throw failure('Usuario no encontrado.', 404);
  if (!isConsulta(user)) throw failure('Seleccione un usuario con rol Consulta.', 400);
  return user;
}

async function searchCases(query) {
  const filters = Object.fromEntries(['documento', 'nombre', 'defensor', 'regional']
    .map((key) => [key, String(query[key] || '').trim().slice(0, 200)]));
  if (!Object.values(filters).some(Boolean)) throw failure('Ingrese al menos un filtro para buscar casos.', 400);
  const page = Math.max(1, Math.min(10000, Number.parseInt(query.page, 10) || 1));
  const pageSize = 25;
  const result = await personaRepo.listCondenadosSummary({
    tipo: 'all', filters: { ...filters, incluirSindicados: true, incluirNoAsignados: false },
    limit: pageSize, offset: (page - 1) * pageSize, includeExactCounts: false,
  });
  return {
    cases: (result.rows || []).slice(0, pageSize).map((row) => ({
      situacionId: String(row.ID_SITUACION),
      documento: String(consolidado.getValue(row, 'numero', '')),
      nombre: String(consolidado.getValue(row, 'Nombre', '')),
      proceso: String(consolidado.getValue(row, 'Proceso', '')),
      defensor: String(consolidado.getValue(row, 'Defensor', '')),
    })),
    page, hasMore: Boolean(result.truncated),
  };
}

async function getPermissions(id) {
  const user = collaborator(id);
  const cases = [];
  const grants = user.consultaCases || [];
  // Limita las lecturas simultáneas al revisar permisos existentes.
  for (let start = 0; start < grants.length; start += 8) {
    cases.push(...await Promise.all(grants.slice(start, start + 8).map(async (grant) => {
      const record = await consolidado.getByDocumento(grant.documento);
      const matches = record && caseId(record) === grant.situacionId;
      return { ...grant, ...(matches ? describeCase(record) : {}),
        disponible: Boolean(matches && currentDefensor(record)),
      };
    })));
  }
  return { cases };
}

async function changePermissions(id, body, actor) {
  const initial = collaborator(id);
  const action = body?.action;
  if (!['grant', 'revoke'].includes(action) || !Array.isArray(body.cases) || !body.cases.length || body.cases.length > 100) {
    throw failure('Seleccione entre 1 y 100 casos y una acción válida.', 400);
  }
  if (action === 'grant' && initial.enabled === false) throw failure('El colaborador está deshabilitado.', 400);
  const validated = [];
  for (const selected of body.cases) {
    const situacionId = String(selected?.situacionId || '');
    if (!/^[1-9]\d*$/.test(situacionId)) throw failure('Identificador de caso no válido.', 400);
    if (action === 'revoke') { validated.push({ situacionId }); continue; }
    const documento = String(selected?.documento || '');
    if (!/^\d+$/.test(documento)) throw failure('Documento no válido.', 400);
    const record = await consolidado.getByDocumento(documento);
    if (!record || caseId(record) !== situacionId || !currentDefensor(record)) {
      throw failure('El caso cambió o ya no tiene defensor. Actualice la búsqueda.', 409);
    }
    validated.push({ ...describeCase(record), autorizadoPor: actor.email || actor.id,
      autorizadoEn: new Date().toISOString() });
  }
  // Vuelve a leer tras las consultas: no sobrescribe permisos de otra solicitud.
  const latest = collaborator(id);
  if (action === 'grant' && latest.enabled === false) throw failure('El colaborador está deshabilitado.', 400);
  const grants = new Map((latest.consultaCases || []).map((grant) => [grant.situacionId, grant]));
  for (const grant of validated) {
    if (action === 'grant') { if (!grants.has(grant.situacionId)) grants.set(grant.situacionId, grant); }
    else grants.delete(grant.situacionId);
  }
  if (grants.size > 500) throw failure('El colaborador admite hasta 500 casos autorizados.', 400);
  updateManagedUser(id, { consultaCases: [...grants.values()] });
  console.info('[consulta:permissions]', JSON.stringify({ at: new Date().toISOString(), action,
    actor: actor.id, collaborator: id, cases: validated.map((grant) => grant.situacionId) }));
  return { ok: true };
}

function auditCaseEdit(req, action, record) {
  if (!isConsulta(req.user)) return;
  console.info('[consulta:edit]', JSON.stringify({ at: new Date().toISOString(), action,
    actor: req.user.id, documento: req.params.documento, situacionId: caseId(record),
    gestionId: record?.__oracleIdGestion || null }));
}

const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
const protectedField = (key) => {
  const normalized = normalize(key);
  return ['defensor', 'defensorasignado', 'defensor asignado', 'defensoractivo', 'defensorgestion',
    'defensor a publico a asignado para tramitar la solicitud', 'defensor a p blico a asignado para tramitar la solicitud',
    'pag', 'cedula pag'].includes(normalized);
};

async function requireConsultaCaseEdit(req, res, next) {
  if (!isConsulta(req.user)) return next();
  try {
    const record = await consolidado.getByDocumento(req.params.documento);
    if (!canEditCase(findUser(req.user), record)) {
      throw failure('Solo puede editar casos autorizados para su cuenta que tengan defensor asignado.');
    }
    const body = req.body || {};
    let selected = record;
    const targetId = Number.isInteger(body.rowIndex) && body.rowIndex > 0
      ? body.rowIndex : Number(String(body.actuacionId || '').match(/-(\d+)$/)?.[1] || 0);
    if (req.method === 'PUT' && targetId) {
      const actuaciones = await consolidado.getActuacionesByDocumento(req.params.documento);
      selected = actuaciones.find((item) => Number(item.rowIndex) === targetId)?.registro;
      if (!selected || caseId(selected) !== caseId(record)) throw failure('La gestión no pertenece al caso autorizado.');
    }
    const source = body.data && typeof body.data === 'object' ? body.data : body;
    if (source.__desasignarDefensor === true || body.__desasignarDefensor === true) {
      throw failure('El permiso de edición no permite retirar al defensor.');
    }
    for (const [key, value] of Object.entries(source)) {
      if (!protectedField(key)) continue;
      // Conserva las identidades guardadas, incluso en gestiones históricas.
      const normalizedKey = normalize(key);
      if (req.method === 'POST' && normalizedKey === 'defensorgestion' && !String(value || '').trim()) continue;
      let stored = req.method === 'POST' && normalizedKey.startsWith('defensor')
        ? currentDefensor(record)
        : Object.entries(selected).find(([storedKey]) => normalize(storedKey) === normalizedKey)?.[1];
      const legacyDefensorAlias = normalizedKey === 'defensor' || normalizedKey === 'defensor asignado' ||
        normalizedKey.startsWith('defensor a ');
      if (!String(stored || '').trim() && legacyDefensorAlias) {
        stored = selected.defensorGestion || currentDefensor(record);
      }
      if (normalize(value) !== normalize(stored)) throw failure('El permiso de edición no permite cambiar al defensor ni al PAG.');
    }
    const clean = Object.fromEntries(Object.entries(source).filter(([key]) => !protectedField(key)));
    req.body = source === body ? clean : { ...body, data: clean };
    return next();
  } catch (error) {
    if (!error.status) return next(error);
    return res.status(error.status).json({ message: error.message, code: error.code });
  }
}

module.exports = { withConsultaAccess, searchCases, getPermissions, changePermissions, requireConsultaCaseEdit, auditCaseEdit };
