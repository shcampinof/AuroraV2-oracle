const { normalizeComparisonText } = require('../utils/textNormalization');
const { getAutomaticBlock3Closure } = require('./auroraCaseClosures');

const normalize = value => normalizeComparisonText(value).toLowerCase().trim();
const filled = value => !['', '-', '--', 'null', 'undefined', 'seleccione'].includes(normalize(value));
const negative = value => /^(no$|no aplica\b|no cumple\b)/.test(normalize(value).replace(/^\d+\s*[.)-]?\s*/, ''));

function requiresAnalysisReview(row = {}) {
  const required = ['LIBERTAD_CONDICIONAL', 'PRISION_DOMICILIARIA_MITAD_PENA',
    'PROCEDENCIA_PENA_CUMPLIDA', 'PROCEDENCIA_ACUMULACION_PENAS'];
  if (!required.every(column => negative(row[column]))) return false;
  if (filled(row.UTILIDAD_PUBLICA) && !negative(row.UTILIDAD_PUBLICA)) return false;
  let selections = row.OTRAS_SOLICITUDES_TRAMITAR;
  try { selections = JSON.parse(selections); } catch { /* Formato histórico. */ }
  if ((Array.isArray(selections) ? selections.map(normalize).join('|') : normalize(selections)) !== 'ninguna') return false;
  if (filled(row.CIERRE_CASO) || getAutomaticBlock3Closure(row)) return false;
  // Un recurso pendiente conserva su flujo, aunque existan respuestas antiguas.
  if (normalize(row.SE_PRESENTA_RECURSO).startsWith('si') && !filled(row.SENTIDO_DECISION_RESUELVE_RECURSO)
      && /^(no concede|niega)/.test(normalize(row.SENTIDO_DECISION))) return false;
  return true;
}

function nextAnalysisDate(value) {
  if (value instanceof Date && Number.isNaN(value.getTime())) return null;
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 6);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}

function applyAnalysisReview(updates, stored = {}, { sindicado = false, now = new Date() } = {}) {
  if (!Object.keys(updates).length) return;
  const merged = { ...stored, ...updates };
  if (!sindicado && requiresAnalysisReview(merged)) {
    const selected = merged.NUEVA_FECHA_ANALISIS;
    const iso = selected instanceof Date && !Number.isNaN(selected.getTime())
      ? selected.toISOString().slice(0, 10) : String(selected || '');
    const { bogotaDate } = require('../utils/analysisReviewDate');
    const min = bogotaDate(now);
    const max = nextAnalysisDate(min).toISOString().slice(0, 10);
    const date = new Date(`${iso}T00:00:00.000Z`);
    const missing = !selected;
    if (missing || !/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== iso || iso < min || iso > max) {
      const err = new Error(missing
        ? 'Debe seleccionar la nueva fecha de análisis; es obligatoria.'
        : `La nueva fecha de análisis debe estar entre ${min} y ${max} (máximo seis meses desde hoy).`);
      err.code = missing ? 'PPL_FECHA_ANALISIS_REQUERIDA' : 'PPL_FECHA_ANALISIS_FUERA_RANGO';
      err.status = 400;
      throw err;
    }
    updates.NUEVA_FECHA_ANALISIS = date;
  } else if (stored.NUEVA_FECHA_ANALISIS != null || Object.hasOwn(updates, 'NUEVA_FECHA_ANALISIS')) {
    updates.NUEVA_FECHA_ANALISIS = null;
  }
}

module.exports = { requiresAnalysisReview, nextAnalysisDate, applyAnalysisReview };
