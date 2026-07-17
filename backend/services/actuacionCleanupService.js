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

function expectedConfirmation(count) {
  return `ELIMINAR ${Number(count)} ACTUACIONES`;
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
    confirmation: expectedConfirmation(result.totalActuaciones),
    truncated: result.actuaciones.length < result.totalActuaciones,
  };
}

async function executeCleanup({ defensor: value, expectedCount, confirmation, user }) {
  const defensor = assertAllowedDefensor(value);
  const count = Number(expectedCount);
  if (!Number.isInteger(count) || count <= 0) {
    const err = new Error('La cantidad esperada de actuaciones no es valida. Actualice la vista previa.');
    err.status = 400;
    err.code = 'ACTUACIONES_CLEANUP_INVALID_COUNT';
    throw err;
  }
  if (String(confirmation || '').trim() !== expectedConfirmation(count)) {
    const err = new Error(`Escriba exactamente: ${expectedConfirmation(count)}`);
    err.status = 400;
    err.code = 'ACTUACIONES_CLEANUP_CONFIRMATION_REQUIRED';
    throw err;
  }

  const before = await cleanupRepo.previewByActiveDefensor(defensor, { limit: 1000 });
  if (before.totalActuaciones !== count) {
    const err = new Error('Las actuaciones cambiaron desde la vista previa. Actualice y confirme nuevamente.');
    err.status = 409;
    err.code = 'ACTUACIONES_CLEANUP_PREVIEW_CHANGED';
    throw err;
  }

  const deleted = await cleanupRepo.deleteByActiveDefensor(defensor, count);
  if (deleted !== count) {
    const err = new Error('Las actuaciones cambiaron durante la operacion. No se elimino ningun registro.');
    err.status = 409;
    err.code = 'ACTUACIONES_CLEANUP_CONCURRENT_CHANGE';
    throw err;
  }

  const auditEntry = {
    timestamp: new Date().toISOString(),
    action: 'delete_actuaciones_by_active_defensor',
    defensor,
    deleted,
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

  return { defensor, deleted, totalPersonas: before.totalPersonas };
}

module.exports = {
  cleanupDefensor,
  expectedConfirmation,
  previewCleanup,
  executeCleanup,
  normalizeText,
};
