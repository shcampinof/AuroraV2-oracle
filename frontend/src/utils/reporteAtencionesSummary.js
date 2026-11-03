const ACTUACION_SUMMARY_FIELDS = Object.freeze([
  'casosAnalizados',
  'entrevistasRealizadas',
  'solicitudesPresentadas',
  'reiteracionesPresentadas',
  'recursosPresentados',
]);

export function calculateTotalActuaciones(resumen = {}) {
  return ACTUACION_SUMMARY_FIELDS.reduce((total, field) => {
    const value = Number(resumen?.[field]);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function isReporteSinRegional({ regional = '' } = {}) {
  return regional.trim().toLowerCase() === 'sin regional identificada';
}

export function getReporteAtencionesScopeNote(metadata = {}) {
  if (!metadata.regional) return '';
  if (isReporteSinRegional(metadata)) {
    return 'Casos de personas condenadas y sindicadas sin regional identificada. Se consultan por separado y no se suman a ninguna regional.';
  }
  return metadata.lugar?.trim()
    ? 'Casos de personas condenadas y sindicadas asociados al ERON seleccionado de la regional.'
    : 'Casos de personas condenadas y sindicadas asociados a la regional seleccionada.';
}
