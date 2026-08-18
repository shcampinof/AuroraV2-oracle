export function buildAsignacionBackendFilters(currentTab, filtros) {
  const safe = filtros && typeof filtros === 'object' ? filtros : {};
  const gestionaAsignacionesExistentes =
    currentTab === 'reasignacion' || currentTab === 'eliminarAsignaciones';

  return {
    documento: String(safe.documento || '').trim(),
    departamento: String(safe.departamento || '').trim(),
    municipio: String(safe.municipio || '').trim(),
    lugar: String(safe.lugar || '').trim(),
    centroId: String(safe.centroId || '').trim(),
    potencialSubrogado: String(safe.potencialSubrogado || '').trim(),
    defensor: gestionaAsignacionesExistentes ? String(safe.defensorActual || '').trim() : '',
    asignacionEstado: gestionaAsignacionesExistentes ? 'con_defensor' : 'sin_defensor',
  };
}
