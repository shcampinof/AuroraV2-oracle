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
