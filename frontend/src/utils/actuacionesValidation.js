export function shouldBlockNuevaActuacion({ flow, actuaciones, hasInfoDesdePregunta29 }) {
  if (flow !== 'condenado') return false;

  const rows = Array.isArray(actuaciones) ? actuaciones : [];
  if (rows.length === 0) return false;

  const ultimaActuacion = rows[rows.length - 1];
  const registro = ultimaActuacion?.registro;
  if (!registro || typeof registro !== 'object') return true;

  return !hasInfoDesdePregunta29(registro);
}

export function shouldShowVirtualPendingActuacion(actuaciones, registro) {
  const rows = Array.isArray(actuaciones) ? actuaciones : [];
  return rows.length === 0 && Boolean(registro && typeof registro === 'object');
}
