const closures = require('../../shared/aurora-case-closures.json');

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/^\s*\d+\s*[.)-]?\s*/, '').replace(/\s+/g, ' ').trim();
}

function isNegative(value) {
  return /^(no$|no aplica\b|no cumple\b)/.test(normalize(value));
}

function getAutomaticBlock3Closure(gestion) {
  const responses = [gestion.LIBERTAD_CONDICIONAL, gestion.PRISION_DOMICILIARIA_MITAD_PENA];
  if (responses.some((value) => normalize(value) === normalize(closures.libertad.respuesta))) {
    return closures.libertad.motivo;
  }
  const utilidad = normalize(gestion.UTILIDAD_PUBLICA);
  const ninguna = normalize(gestion.OTRAS_SOLICITUDES_TRAMITAR);
  if (responses.every((value) => normalize(value) === normalize(closures.traslado.respuesta))
      && isNegative(gestion.PROCEDENCIA_PENA_CUMPLIDA)
      && isNegative(gestion.PROCEDENCIA_ACUMULACION_PENAS)
      && (['', '-', '--'].includes(utilidad) || isNegative(gestion.UTILIDAD_PUBLICA))
      && ninguna === 'ninguna') {
    return closures.traslado.motivo;
  }
  return '';
}

function applyAutomaticBlock3Closure(updates, stored = {}) {
  const motivo = getAutomaticBlock3Closure({ ...stored, ...updates });
  if (motivo) updates.CIERRE_CASO = motivo;
  else if (Object.values(closures).some(({ motivo: automatic }) =>
    (updates.CIERRE_CASO ?? stored.CIERRE_CASO) === automatic)) updates.CIERRE_CASO = null;
}

module.exports = { closures, getAutomaticBlock3Closure, applyAutomaticBlock3Closure };
