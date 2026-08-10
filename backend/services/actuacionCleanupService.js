const fs = require('fs');
const path = require('path');

const cleanupRepo = require('../repositories/oracle/actuacionCleanupRepository');

function cleanupDefensor() {
  return String(process.env.CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR || 'PRUEBA PILOTO').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function assertAllowedDefensor(value) {
  const configured = cleanupDefensor();
  if (normalizeText(value) !== normalizeText(configured)) {
    const err = new Error(`La depuracion solo esta habilitada para el defensor ${configured}.`);
    err.status = 400;
    err.code = 'ACTUACIONES_CLEANUP_DEFENSOR_NOT_ALLOWED';
    throw err;
  }
  return configured;
}

function expectedConfirmation(count, assignments) {
  const actuaciones = Number(count);
  const asignaciones = Number(assignments);
  if (Number.isFinite(asignaciones)) {
    return `ELIMINAR ${actuaciones} ACTUACIONES Y ${asignaciones} ASIGNACIONES`;
  }
  return `ELIMINAR ${actuaciones} ACTUACIONES`;
}

function auditPath() {
  const baseDir = process.env.AURORA_CARGAS_DIR
    ? path.resolve(process.env.AURORA_CARGAS_DIR)
    : path.join(__dirname, '..', 'storage', 'cargas-bd');
  fs.mkdirSync(baseDir, { recursive: true });
  return path.join(baseDir, 'actuaciones-cleanup.jsonl');
}

function appendAudit(entry) {
  fs.appendFileSync(auditPath(), `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
}

async function previewCleanup(value) {
  const defensor = assertAllowedDefensor(value);
  const result = await cleanupRepo.previewByActiveDefensor(defensor);
  return {
    defensor,
    ...result,
    confirmation: expectedConfirmation(result.totalActuaciones, result.totalAsignaciones),
    truncated: result.actuaciones.length < result.totalActuaciones,
  };
}

async function executeCleanup({ defensor: value, expectedCount, expectedAssignments, confirmation, user }) {
  const defensor = assertAllowedDefensor(value);
  const count = Number(expectedCount);
  const assignmentCount = Number(expectedAssignments);
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(assignmentCount) || assignmentCount <= 0) {
    const err = new Error('La cantidad esperada de actuaciones no es valida. Actualice la vista previa.');
    err.status = 400;
    err.code = 'ACTUACIONES_CLEANUP_INVALID_COUNT';
    throw err;
  }
  if (String(confirmation || '').trim() !== expectedConfirmation(count, assignmentCount)) {
    const err = new Error(`Escriba exactamente: ${expectedConfirmation(count, assignmentCount)}`);
    err.status = 400;
    err.code = 'ACTUACIONES_CLEANUP_CONFIRMATION_REQUIRED';
    throw err;
  }

  const before = await cleanupRepo.previewByActiveDefensor(defensor, { limit: 1000 });
  if (before.totalActuaciones !== count || before.totalAsignaciones !== assignmentCount) {
    const err = new Error('Las actuaciones cambiaron desde la vista previa. Actualice y confirme nuevamente.');
    err.status = 409;
    err.code = 'ACTUACIONES_CLEANUP_PREVIEW_CHANGED';
    throw err;
  }

  let cleanupResult;
  try {
    cleanupResult = await cleanupRepo.deleteByActiveDefensor(defensor, count, assignmentCount);
  } catch (err) {
    if (/ORA-2000[123]|registros cambiaron|cambio concurrente/i.test(String(err?.message || ''))) {
      const concurrentError = new Error(
        'Las actuaciones o asignaciones cambiaron durante la operacion. No se elimino ningun registro.'
      );
      concurrentError.status = 409;
      concurrentError.code = 'ACTUACIONES_CLEANUP_CONCURRENT_CHANGE';
      throw concurrentError;
    }
    throw err;
  }
  const deleted = cleanupResult.deleted;
  const assignmentsDeleted = cleanupResult.assignmentsDeleted;

  const auditEntry = {
    timestamp: new Date().toISOString(),
    action: 'delete_actuaciones_by_active_defensor',
    defensor,
    deleted,
    assignmentsDeleted,
    totalPersonas: before.totalPersonas,
    gestionIds: before.actuaciones.map((row) => Number(row.ID_GESTION)).filter(Number.isFinite),
    performedBy: {
      id: user?.id || null,
      name: user?.name || null,
      email: user?.email || null,
      username: user?.username || null,
      provider: user?.provider || null,
    },
  };
  try {
    appendAudit(auditEntry);
  } catch (err) {
    console.error('[actuaciones:cleanup:audit] No fue posible escribir auditoria:', err?.message || err);
  }

  return { defensor, deleted, assignmentsDeleted, totalPersonas: before.totalPersonas };
}

module.exports = {
  cleanupDefensor,
  expectedConfirmation,
  previewCleanup,
  executeCleanup,
  normalizeText,
};
