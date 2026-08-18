export const ESTADO_RECLUSION_ACTIVO = 'EN PRISIÓN';
export const ESTADO_RECLUSION_INACTIVO = 'FUERA DE PRISIÓN';
export const SITUACION_JURIDICA_INACTIVA = 'FUERA DE PRISIÓN (REGISTRO HISTÓRICO)';

export function isSituacionActiva(source) {
  if (!source || typeof source !== 'object') return true;

  if (typeof source.situacionActiva === 'boolean') return source.situacionActiva;
  if (typeof source.__situacionActiva === 'boolean') return source.__situacionActiva;

  const raw = source.__activoSituacion ?? source.S_ACTIVO ?? source.ACTIVO;
  if (raw === null || raw === undefined || String(raw).trim() === '') return true;
  return Number(raw) === 1;
}

export function getEstadoReclusion(source) {
  return isSituacionActiva(source) ? ESTADO_RECLUSION_ACTIVO : ESTADO_RECLUSION_INACTIVO;
}
