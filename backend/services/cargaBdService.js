const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const pplService = require('./pplService');

function configuredSchema() {
  return String(process.env.ORACLE_SCHEMA || process.env.ORACLE_USER || 'DNDP').trim().toUpperCase() || 'DNDP';
}

function qualifiedTable(table) {
  return `${configuredSchema()}.${table}`;
}

const SOURCE_DEFINITIONS = {
  aurora_10: {
    id: 'aurora_10',
    label: 'Aurora 1.0',
    expectedFile: 'Aurora_1_0.xlsx',
    table: qualifiedTable('AURORA_10'),
    enabledEnv: 'CARGUEBD_AURORA10_ENABLED',
    defaultEnabled: true,
  },
  sisipec: {
    id: 'sisipec',
    label: 'SISIPEC',
    expectedFile: 'Consolidado_SISIPEC.xlsx',
    table: qualifiedTable('SISIPEC'),
    defaultEnabled: true,
  },
  ponal: {
    id: 'ponal',
    label: 'PONAL',
    expectedFile: 'CONSOLIDADO_PPL_REGIONES.xlsx',
    table: qualifiedTable('PONAL'),
    defaultEnabled: true,
  },
};

const RUNNING_JOBS = new Map();
const DEFAULT_PUBLIC_ERROR_MAX_LENGTH = 1000;
const MAX_PUBLIC_ERROR_LENGTH = 2000;
const DEFAULT_REGISTRY_RETENTION_DAYS = 2;
const DEFAULT_REGISTRY_MAX_RECORDS = 50;

function boolEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return fallback;
  return !['false', '0', 'no', 'off'].includes(String(raw).trim().toLowerCase());
}

function getBaseDir() {
  return path.resolve(process.env.AURORA_CARGAS_DIR || path.join(__dirname, '..', 'storage', 'cargas_bd'));
}

function getPaths() {
  const baseDir = getBaseDir();
  return {
    baseDir,
    uploadsDir: path.join(baseDir, 'uploads'),
    logsDir: path.join(baseDir, 'logs'),
    registryPath: path.join(baseDir, 'cargas.json'),
  };
}

function ensureStorage() {
  const paths = getPaths();
  fs.mkdirSync(paths.uploadsDir, { recursive: true });
  fs.mkdirSync(paths.logsDir, { recursive: true });
  return paths;
}

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `${stamp}-${crypto.randomBytes(4).toString('hex')}`;
}

function createCorruptRegistryBackup(registryPath, raw) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${registryPath}.corrupt-${stamp}.bak`;
  try {
    fs.writeFileSync(backupPath, raw);
  } catch {
    // El respaldo es diagnostico; si falla, igual protegemos la pantalla de cargas.
  }
  return backupPath;
}

function createRegistryBackup(registryPath, raw, reason = 'backup') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${registryPath}.${reason}-${stamp}.bak`;
  fs.writeFileSync(backupPath, raw);
  return backupPath;
}

function getPublicErrorMaxLength() {
  const configured = Number(process.env.CARGUEBD_PUBLIC_ERROR_MAX_LENGTH || DEFAULT_PUBLIC_ERROR_MAX_LENGTH);
  if (!Number.isFinite(configured) || configured < 100) return DEFAULT_PUBLIC_ERROR_MAX_LENGTH;
  return Math.min(MAX_PUBLIC_ERROR_LENGTH, Math.floor(configured));
}

function boundedIntegerEnv(name, fallback, min, max) {
  const configured = Number(process.env[name]);
  if (!Number.isFinite(configured)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(configured)));
}

function getRegistryRetentionDays() {
  return boundedIntegerEnv('CARGUEBD_REGISTRY_RETENTION_DAYS', DEFAULT_REGISTRY_RETENTION_DAYS, 1, 30);
}

function getRegistryMaxRecords() {
  return boundedIntegerEnv('CARGUEBD_REGISTRY_MAX_RECORDS', DEFAULT_REGISTRY_MAX_RECORDS, 1, 200);
}

function publicError(value) {
  const text = String(value || '');
  const maxLength = getPublicErrorMaxLength();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function recordTimestamp(record) {
  const value = record?.updatedAt || record?.finishedAt || record?.createdAt;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compactRegistry(records, referenceTime = Date.now()) {
  const retentionMs = getRegistryRetentionDays() * 24 * 60 * 60 * 1000;
  const cutoff = referenceTime - retentionMs;
  const maxRecords = getRegistryMaxRecords();

  return records
    .filter((record) => record && typeof record === 'object' && !Array.isArray(record))
    .filter((record) => {
      if (['recibido', 'en_ejecucion'].includes(record.status)) return true;
      const timestamp = recordTimestamp(record);
      return timestamp == null || timestamp >= cutoff;
    })
    .slice(0, maxRecords)
    .map((record) => ({
      ...record,
      error: publicError(record.error),
    }));
}

function parseRegistry(raw) {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return { records: parsed, legacyFormat: false };
  if (parsed && Array.isArray(parsed.cargas)) return { records: parsed.cargas, legacyFormat: true };
  return { records: [], legacyFormat: true };
}

function safeFileName(name) {
  const ext = path.extname(String(name || '')).toLowerCase() || '.xlsx';
  const base = path
    .basename(String(name || 'archivo'), ext)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return `${base || 'archivo'}${ext}`;
}

function readRegistry() {
  const { registryPath } = ensureStorage();
  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    const { records, legacyFormat } = parseRegistry(raw);
    const compacted = compactRegistry(records);
    const changed =
      legacyFormat ||
      compacted.length !== records.length ||
      compacted.some((record, index) => record.error !== records[index]?.error);
    if (changed) writeRegistry(compacted);
    return compacted;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    if (err instanceof SyntaxError) {
      const raw = fs.readFileSync(registryPath, 'utf8');
      const backupPath = createCorruptRegistryBackup(registryPath, raw);
      writeRegistry([]);
      console.error(
        `[cargas_bd] Registro de cargas corrupto en ${registryPath}. ` +
          `Se reinicio automaticamente y se guardo respaldo en ${backupPath}: ${err.message}`
      );
      return [];
    }
    throw err;
  }
}

function writeRegistry(records) {
  const { registryPath } = ensureStorage();
  const tmpPath = `${registryPath}.${process.pid}-${crypto.randomBytes(6).toString('hex')}.tmp`;
  const payload = `${JSON.stringify(compactRegistry(records), null, 2)}\n`;
  let descriptor;
  try {
    descriptor = fs.openSync(tmpPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, payload, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(tmpPath, registryPath);
  } finally {
    if (descriptor != null) fs.closeSync(descriptor);
    try {
      fs.unlinkSync(tmpPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

function repairRegistryOnStartup() {
  const shouldClear = boolEnv('CARGUEBD_CLEAR_REGISTRY_ON_START', false);

  const { registryPath } = ensureStorage();
  let raw = '';
  try {
    raw = fs.readFileSync(registryPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { changed: false, reason: 'missing' };
    throw err;
  }

  if (shouldClear) {
    const backupPath = createRegistryBackup(registryPath, raw, 'cleared');
    writeRegistry([]);
    console.warn(`[cargas_bd] Historial de cargas limpiado por CARGUEBD_CLEAR_REGISTRY_ON_START. Respaldo: ${backupPath}`);
    return { changed: true, reason: 'cleared', backupPath };
  }

  try {
    const { records, legacyFormat } = parseRegistry(raw);
    const compacted = compactRegistry(records);
    const changed =
      legacyFormat ||
      compacted.length !== records.length ||
      compacted.some((record, index) => record.error !== records[index]?.error);
    if (changed) writeRegistry(compacted);
    return { changed, reason: changed ? 'compacted' : 'valid' };
  } catch (err) {
    const backupPath = createCorruptRegistryBackup(registryPath, raw);
    writeRegistry([]);
    console.warn(
      `[cargas_bd] Historial de cargas corrupto reparado automaticamente. ` +
        `Respaldo: ${backupPath}: ${err.message}`
    );
    return { changed: true, reason: 'repaired', backupPath };
  }
}

function saveRecord(record) {
  const records = readRegistry();
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.unshift(record);
  writeRegistry(records);
  return record;
}

function updateRecord(id, patch) {
  const records = readRegistry();
  const index = records.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next = { ...records[index], ...patch, updatedAt: nowIso() };
  records[index] = next;
  writeRegistry(records);
  return next;
}

function listSources() {
  return Object.values(SOURCE_DEFINITIONS).map((source) => ({
    ...source,
    enabled: source.enabledEnv ? boolEnv(source.enabledEnv, source.defaultEnabled) : source.defaultEnabled,
  }));
}

function assertSource(sourceId) {
  const id = String(sourceId || '').trim().toLowerCase();
  const source = SOURCE_DEFINITIONS[id];
  if (!source) {
    const err = new Error('Fuente de carga no soportada.');
    err.status = 400;
    throw err;
  }

  const enabled = source.enabledEnv ? boolEnv(source.enabledEnv, source.defaultEnabled) : source.defaultEnabled;
  if (!enabled) {
    const err = new Error(`La fuente ${source.label} esta deshabilitada por configuracion.`);
    err.status = 409;
    throw err;
  }

  return source;
}

function createLogWriter(logPath) {
  return (chunk) => {
    fs.appendFileSync(logPath, chunk);
  };
}

function getPythonExecutable() {
  return process.env.CARGUEBD_PYTHON || process.env.PYTHON || 'python3';
}

function getLoaderScriptPath() {
  return path.resolve(process.env.CARGUEBD_SCRIPT_PATH || path.join(__dirname, '..', '..', 'scripts/cargas_bd', 'loader_service.py'));
}

function getPythonDependencyCheckArgs() {
  return [
    '-c',
    'import pandas, openpyxl, oracledb; print("Dependencias Python OK")',
  ];
}

function checkPythonRuntime(python, script) {
  if (!fs.existsSync(script)) {
    return `No existe el servicio Python de carga: ${script}`;
  }

  const result = spawnSync(python, getPythonDependencyCheckArgs(), {
    cwd: path.dirname(script),
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
    },
    encoding: 'utf8',
    timeout: 30000,
  });

  if (result.error) {
    return `No fue posible ejecutar ${python}: ${result.error.message}`;
  }

  if (result.status !== 0) {
    const detail = `${result.stderr || result.stdout || ''}`.trim();
    if (detail.includes("No module named 'pandas'")) {
      return 'Falta instalar dependencia Python: pandas. Ejecute pip install -r scripts/cargas_bd/requirements.txt o configure CARGUEBD_PYTHON con un entorno que la tenga.';
    }
    if (detail.includes("No module named 'openpyxl'")) {
      return 'Falta instalar dependencia Python: openpyxl. Ejecute pip install -r scripts/cargas_bd/requirements.txt o configure CARGUEBD_PYTHON con un entorno que la tenga.';
    }
    if (detail.includes("No module named 'oracledb'")) {
      return 'Falta instalar dependencia Python: oracledb. Ejecute pip install -r scripts/cargas_bd/requirements.txt o configure CARGUEBD_PYTHON con un entorno que la tenga.';
    }
    return `El entorno Python de cargas no esta listo: ${detail || `codigo ${result.status}`}`;
  }

  return '';
}

function summarizePythonFailure(logPath, fallback) {
  try {
    const logText = fs.readFileSync(logPath, 'utf8').slice(-12000);
    const identifierMatch = logText.match(/PLS-00201:\s*identifier\s+'([^']+)'\s+must\s+be\s+declared/i);
    if (identifierMatch) {
      return `El objeto Oracle ${identifierMatch[1]} no existe, no es visible o falta permiso EXECUTE. Revise el procedimiento ETL en la base de datos.`;
    }

    const missingProcedureMatch = logText.match(
      /El procedimiento Oracle ([A-Z0-9_.]+) no existe, no es visible o falta permiso EXECUTE/i
    );
    if (missingProcedureMatch) {
      return `El procedimiento Oracle ${missingProcedureMatch[1]} no existe, no es visible o falta permiso EXECUTE para el usuario configurado.`;
    }

    const invalidProcedureMatch = logText.match(
      /El procedimiento Oracle ([A-Z0-9_.]+) existe pero esta en estado ([A-Z]+)/i
    );
    if (invalidProcedureMatch) {
      return `El procedimiento Oracle ${invalidProcedureMatch[1]} existe pero esta en estado ${invalidProcedureMatch[2].toUpperCase()}. Solicite recompilacion al DBA.`;
    }

    const missingModuleMatch = logText.match(/ModuleNotFoundError:\s+No module named '([^']+)'/i);
    if (missingModuleMatch) {
      return `Falta instalar dependencia Python: ${missingModuleMatch[1]}. Ejecute pip install -r scripts/cargas_bd/requirements.txt o configure CARGUEBD_PYTHON.`;
    }

    const oracleLines = logText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .map((line) => {
        const match = line.match(/((?:ORA|PLS)-\d+:\s+.*)$/i);
        return match ? match[1] : '';
      })
      .filter(Boolean)
      .slice(0, 3);
    if (oracleLines.length) {
      return oracleLines.join(' ');
    }
  } catch {
    // Si el log no esta disponible, conservamos el mensaje generico.
  }

  return fallback;
}

function invalidatePplCachesAfterSuccessfulCarga(record, log = () => {}) {
  const version = pplService.invalidateDataCache();
  log(
    `[${nowIso()}] Cache de consultas PPL invalidada despues del cargue ` +
      `${String(record?.sourceId || 'desconocido')} (version ${version})\n`
  );
  return version;
}

async function reconcilePplStateAfterSuccessfulCarga(record, log = () => {}, { skipEtl = false } = {}) {
  let reconciliation = { updated: 0, skipped: skipEtl };
  if (skipEtl) {
    log(`[${nowIso()}] Recalculo de acciones omitido porque el cargue se ejecuto con --no-etl.\n`);
  } else {
    log(`[${nowIso()}] Recalculando acciones vigentes con las reglas actuales de Aurora.\n`);
    reconciliation = {
      ...(await pplService.reconcileCurrentGestionActions()),
      skipped: false,
    };
    log(
      `[${nowIso()}] Recalculo finalizado: ` +
        `${Number(reconciliation.updated || 0)} gestion(es) vigente(s) actualizada(s).\n`
    );
  }
  const dataVersion = invalidatePplCachesAfterSuccessfulCarga(record, log);
  return { ...reconciliation, dataVersion };
}

function startCargaJob(record) {
  if (RUNNING_JOBS.has(record.id)) return;

  const log = createLogWriter(record.logPath);
  const python = getPythonExecutable();
  const script = getLoaderScriptPath();
  const runtimeError = checkPythonRuntime(python, script);
  if (runtimeError) {
    log(`[${nowIso()}] ERROR de entorno: ${runtimeError}\n`);
    updateRecord(record.id, {
      status: 'fallido',
      startedAt: nowIso(),
      finishedAt: nowIso(),
      exitCode: null,
      error: runtimeError,
    });
    return;
  }

  const args = ['-u', script, '--fuente', record.sourceId, '--archivo', record.filePath];
  const skipEtl = boolEnv('CARGUEBD_SKIP_ETL', false);
  if (skipEtl) args.push('--no-etl');

  log(`[${nowIso()}] Iniciando carga ${record.id}\n`);
  log(`Comando: ${python} ${args.map((arg) => JSON.stringify(arg)).join(' ')}\n\n`);
  updateRecord(record.id, {
    status: 'en_ejecucion',
    startedAt: nowIso(),
    command: `${python} loader_service.py --fuente ${record.sourceId} --archivo ${record.originalName}`,
  });

  const child = spawn(python, args, {
    cwd: path.dirname(script),
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  RUNNING_JOBS.set(record.id, child);

  child.stdout.on('data', (chunk) => log(chunk.toString()));
  child.stderr.on('data', (chunk) => log(chunk.toString()));

  child.on('error', (err) => {
    RUNNING_JOBS.delete(record.id);
    log(`\n[${nowIso()}] ERROR iniciando proceso: ${err.message}\n`);
    updateRecord(record.id, {
      status: 'fallido',
      finishedAt: nowIso(),
      exitCode: null,
      error: err.message,
    });
  });

  child.on('close', async (code) => {
    const fallbackError = `El proceso Python termino con codigo ${code}. Revise el log.`;
    log(`\n[${nowIso()}] Proceso finalizado con codigo ${code}\n`);
    if (code !== 0) {
      RUNNING_JOBS.delete(record.id);
      updateRecord(record.id, {
        status: 'fallido',
        finishedAt: nowIso(),
        exitCode: code,
        error: summarizePythonFailure(record.logPath, fallbackError),
      });
      return;
    }

    try {
      const reconciliation = await reconcilePplStateAfterSuccessfulCarga(record, log, { skipEtl });
      updateRecord(record.id, {
        status: 'exitoso',
        finishedAt: nowIso(),
        exitCode: code,
        error: '',
        reconciledActions: Number(reconciliation.updated || 0),
        dataVersion: reconciliation.dataVersion,
      });
    } catch (error) {
      const message =
        `El ETL termino, pero no fue posible recalcular las acciones vigentes: ` +
        `${String(error?.message || error)}`;
      log(`[${nowIso()}] ERROR: ${message}\n`);
      const dataVersion = invalidatePplCachesAfterSuccessfulCarga(record, log);
      updateRecord(record.id, {
        status: 'fallido',
        finishedAt: nowIso(),
        exitCode: code,
        error: message,
        dataVersion,
      });
    } finally {
      RUNNING_JOBS.delete(record.id);
    }
  });
}

function createCarga({ sourceId, tempPath, originalName, size, uploadedBy }) {
  const source = assertSource(sourceId);
  const paths = ensureStorage();
  const id = createId();
  const createdAt = nowIso();
  const folder = path.join(paths.uploadsDir, id);
  fs.mkdirSync(folder, { recursive: true });

  const storedName = safeFileName(originalName);
  const filePath = path.join(folder, storedName);
  try {
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    fs.copyFileSync(tempPath, filePath);
    fs.unlinkSync(tempPath);
  }

  const logPath = path.join(paths.logsDir, `${id}.log`);
  const record = saveRecord({
    id,
    sourceId: source.id,
    sourceLabel: source.label,
    table: source.table,
    status: 'recibido',
    originalName,
    storedName,
    size,
    filePath,
    logPath,
    uploadedBy: uploadedBy || null,
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    error: '',
  });

  startCargaJob(record);
  return getCarga(id);
}

function publicRecord(record) {
  if (!record) return null;
  const error =
    record.status === 'fallido'
      ? summarizePythonFailure(record.logPath, record.error || 'La carga fallo. Revise el log.')
      : record.error;
  return {
    id: record.id,
    sourceId: record.sourceId,
    sourceLabel: record.sourceLabel,
    table: record.table,
    status: record.status,
    originalName: record.originalName,
    storedName: record.storedName,
    size: record.size,
    uploadedBy: record.uploadedBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    exitCode: record.exitCode,
    reconciledActions: Number(record.reconciledActions || 0),
    dataVersion: Number(record.dataVersion || 0),
    error: publicError(error),
    running: RUNNING_JOBS.has(record.id),
  };
}

function listCargas() {
  const records = readRegistry();
  let changed = false;
  const normalized = records.map((record) => {
    const mayBeInterrupted =
      ['recibido', 'en_ejecucion'].includes(record.status) &&
      !RUNNING_JOBS.has(record.id) &&
      record.startedAt &&
      !record.finishedAt;
    if (!mayBeInterrupted) return record;
    changed = true;
    return {
      ...record,
      status: 'fallido',
      finishedAt: nowIso(),
      updatedAt: nowIso(),
      error: 'La ejecucion fue interrumpida antes de finalizar. Reintente la carga.',
    };
  });
  if (changed) writeRegistry(normalized);
  return normalized.map(publicRecord);
}

function getCarga(id) {
  const record = readRegistry().find((item) => item.id === id);
  return publicRecord(record);
}

function getRawCarga(id) {
  return readRegistry().find((item) => item.id === id) || null;
}

function readLog(id) {
  const record = getRawCarga(id);
  if (!record) return null;
  try {
    return fs.readFileSync(record.logPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
}

function retryCarga(id) {
  const record = getRawCarga(id);
  if (!record) return null;
  if (RUNNING_JOBS.has(id)) return publicRecord(record);
  const reset = updateRecord(id, {
    status: 'recibido',
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    error: '',
  });
  fs.appendFileSync(record.logPath, `\n\n[${nowIso()}] Reintento solicitado\n`);
  startCargaJob({ ...record, ...reset });
  return getCarga(id);
}

function shutdownCargaJobs(reason = 'shutdown') {
  const closedAt = nowIso();
  for (const [id, child] of RUNNING_JOBS.entries()) {
    const record = getRawCarga(id);
    if (record) {
      fs.appendFileSync(record.logPath, `\n[${closedAt}] Carga interrumpida por ${reason}\n`);
      updateRecord(id, {
        status: 'fallido',
        finishedAt: closedAt,
        exitCode: null,
        error: `La ejecucion fue interrumpida por ${reason}. Reintente la carga.`,
      });
    }
    try {
      child.kill('SIGTERM');
    } catch {
      // El proceso puede haber terminado entre la lectura del mapa y el kill.
    }
    RUNNING_JOBS.delete(id);
  }
}

module.exports = {
  SOURCE_DEFINITIONS,
  createCarga,
  getCarga,
  listCargas,
  listSources,
  readLog,
  repairRegistryOnStartup,
  retryCarga,
  safeFileName,
  shutdownCargaJobs,
  invalidatePplCachesAfterSuccessfulCarga,
  reconcilePplStateAfterSuccessfulCarga,
};
