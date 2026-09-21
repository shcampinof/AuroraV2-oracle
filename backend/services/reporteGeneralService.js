const fs = require('fs');
const path = require('path');
const reporteGeneralRepo = require('../repositories/oracle/reporteGeneralRepository');

const REPORT_TIME_ZONE = 'America/Bogota';
const REPORT_REFRESH_HOUR = 22;
const REPORT_REFRESH_INTERVAL_MS = 60 * 1000;
const REPORT_FILE_NAME = 'reporte-general.json';

let currentSnapshot = null;
let refreshPromise = null;
let scheduler = null;
let lastScheduledRunDate = '';

function getReportStorageDir() {
  const configured = String(process.env.AURORA_REPORTES_DIR || '').trim();
  return configured ? path.resolve(configured) : path.join(__dirname, '..', 'storage', 'reportes');
}

function getReportFilePath() {
  return path.join(getReportStorageDir(), REPORT_FILE_NAME);
}

function bogotaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function bogotaDateKey(date = new Date()) {
  const parts = bogotaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
}

function percentage(count, previousCount, first = false) {
  if (first) return count > 0 ? 100 : 0;
  if (!previousCount) return 0;
  return Math.round((count / previousCount) * 100);
}

function buildSnapshot(metrics = {}, now = new Date()) {
  const counts = {
    asignados: toCount(metrics.USUARIOS_ASIGNADOS),
    analisis: toCount(metrics.ANALISIS_REALIZADOS),
    procede: toCount(metrics.PROCEDE_SOLICITUD),
    entrevistas: toCount(metrics.USUARIOS_ENTREVISTADOS),
    solicitan: toCount(metrics.USUARIOS_SOLICITAN_ATENCION),
    radicadas: toCount(metrics.SOLICITUDES_RADICADAS),
    decisiones: toCount(metrics.DECISIONES_JUDICIALES),
  };
  const favorables = toCount(metrics.DECISIONES_FAVORABLES);
  const noFavorables = toCount(metrics.DECISIONES_NO_FAVORABLES);

  const definitions = [
    ['asignados', 'Usuarios asignados', 'Usuarios asignados', 'Total de usuarios activos que cuentan con defensor público asignado.'],
    ['analisis', 'Análisis jurídico realizado', 'Análisis jurídico realizado', 'Usuarios asignados que cuentan con fecha de análisis jurídico.'],
    ['procede', 'Procede solicitud', 'Procede solicitud', 'Casos analizados con al menos una procedencia favorable registrada.'],
    ['entrevistas', 'Usuarios entrevistados', 'Usuarios entrevistados', 'Entrevistas realizadas a usuarios con procedencia.'],
    ['solicitan', 'Usuarios que solicitan atención', 'Usuarios que solicitan atención', 'Usuarios entrevistados que manifestaron su voluntad de continuar con la solicitud.'],
    ['radicadas', 'Solicitudes radicadas', 'Solicitudes radicadas', 'Usuarios con solicitud registrada ante la autoridad correspondiente.'],
    ['decisiones', 'Decisiones judiciales', 'Decisiones judiciales', 'Usuarios con solicitud radicada y decisión judicial registrada.'],
  ];

  const stages = definitions.map(([key, label, shortLabel, detail], index) => {
    const count = counts[key];
    const previousCount = index === 0 ? count : counts[definitions[index - 1][0]];
    const pending = index === 0 ? 0 : Math.max(0, previousCount - count);
    let observation = index === 0 ? '' : `Pendientes en esta etapa: ${pending}`;
    if (key === 'decisiones') {
      observation = `Favorables: ${favorables} · No favorables: ${noFavorables}`;
    }
    return {
      key,
      label,
      shortLabel,
      count,
      percentage: percentage(count, previousCount, index === 0),
      detail,
      observation,
    };
  });

  return {
    version: 1,
    metadata: {
      titulo: 'Reporte general de avance AURORA 2.0',
      alcance: 'Consolidado nacional',
      corte: bogotaDateKey(now),
      generadoEn: now.toISOString(),
      zonaHoraria: REPORT_TIME_ZONE,
      actualizacionDiaria: '22:00',
      fuente: 'snapshot-diario',
    },
    stages,
    resumen: {
      ...counts,
      decisionesFavorables: favorables,
      decisionesNoFavorables: noFavorables,
    },
  };
}

function isValidSnapshot(value) {
  return Boolean(value && value.version === 1 && value.metadata?.generadoEn && Array.isArray(value.stages));
}

function loadSnapshotFromDisk() {
  try {
    const parsed = JSON.parse(fs.readFileSync(getReportFilePath(), 'utf8'));
    if (!isValidSnapshot(parsed)) throw new Error('Formato de snapshot no reconocido.');
    currentSnapshot = parsed;
    const parts = bogotaParts(new Date(parsed.metadata.generadoEn));
    if (Number(parts.hour) >= REPORT_REFRESH_HOUR) lastScheduledRunDate = `${parts.year}-${parts.month}-${parts.day}`;
    return currentSnapshot;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('[reporte-general] No fue posible leer el snapshot guardado:', error?.message || error);
    }
    return null;
  }
}

function persistSnapshot(snapshot) {
  const directory = getReportStorageDir();
  const destination = getReportFilePath();
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, destination);
}

async function refreshGeneralReport(reason = 'manual') {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const metrics = await reporteGeneralRepo.getGeneralMetrics();
    const snapshot = buildSnapshot(metrics, new Date());
    persistSnapshot(snapshot);
    currentSnapshot = snapshot;
    console.log(`[reporte-general] Snapshot actualizado (${reason}, corte ${snapshot.metadata.corte}).`);
    return snapshot;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function schedulerTick(now = new Date()) {
  const parts = bogotaParts(now);
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  if (Number(parts.hour) < REPORT_REFRESH_HOUR || lastScheduledRunDate === dateKey) return false;
  lastScheduledRunDate = dateKey;
  try {
    await refreshGeneralReport('programado-22h');
    return true;
  } catch (error) {
    console.error('[reporte-general] Falló la actualización programada; se conserva el snapshot anterior:', error?.message || error);
    return false;
  }
}

function startGeneralReportScheduler() {
  if (scheduler) return;
  loadSnapshotFromDisk();
  if (!currentSnapshot) {
    refreshGeneralReport('inicial').catch((error) => {
      console.error('[reporte-general] No fue posible crear el snapshot inicial:', error?.message || error);
    });
  }
  schedulerTick().catch(() => {});
  scheduler = setInterval(() => schedulerTick(), REPORT_REFRESH_INTERVAL_MS);
  scheduler.unref?.();
}

function stopGeneralReportScheduler() {
  if (scheduler) clearInterval(scheduler);
  scheduler = null;
}

function getGeneralReportSnapshot() {
  return currentSnapshot;
}

function resetForTests() {
  stopGeneralReportScheduler();
  currentSnapshot = null;
  refreshPromise = null;
  lastScheduledRunDate = '';
}

module.exports = {
  REPORT_TIME_ZONE,
  REPORT_REFRESH_HOUR,
  bogotaDateKey,
  buildSnapshot,
  getGeneralReportSnapshot,
  loadSnapshotFromDisk,
  refreshGeneralReport,
  schedulerTick,
  startGeneralReportScheduler,
  stopGeneralReportScheduler,
  resetForTests,
};
