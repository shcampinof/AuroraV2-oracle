// 1.7 cuenta gestiones distintas: una gestión puede aportar varios eventos.
export function calculateTotalActuaciones(resumen = {}) {
  const value = Number(resumen?.totalActuaciones);
  return Number.isFinite(value) ? value : 0;
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
