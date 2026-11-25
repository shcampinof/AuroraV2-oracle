const assert = require('assert/strict');
const { closures, getAutomaticBlock3Closure, applyAutomaticBlock3Closure } = require('../domain/auroraCaseClosures');

const transfer = {
  LIBERTAD_CONDICIONAL: closures.traslado.respuesta,
  PRISION_DOMICILIARIA_MITAD_PENA: closures.traslado.respuesta,
  UTILIDAD_PUBLICA: 'No cumple requisitos objetivos',
  PROCEDENCIA_PENA_CUMPLIDA: 'No', PROCEDENCIA_ACUMULACION_PENAS: 'No',
  OTRAS_SOLICITUDES_TRAMITAR: 'Ninguna',
};

async function run() {
  for (const field of ['LIBERTAD_CONDICIONAL', 'PRISION_DOMICILIARIA_MITAD_PENA']) {
    assert.equal(getAutomaticBlock3Closure({ [field]: `4. ${closures.libertad.respuesta}`, UTILIDAD_PUBLICA: 'Sí cumple requisitos objetivos' }), closures.libertad.motivo);
  }
  assert.equal(getAutomaticBlock3Closure(transfer), closures.traslado.motivo);
  for (const [field, value] of [
    ['UTILIDAD_PUBLICA', 'Sí cumple requisitos objetivos'], ['PROCEDENCIA_PENA_CUMPLIDA', 'Sí'],
    ['PROCEDENCIA_ACUMULACION_PENAS', 'Sí'], ['OTRAS_SOLICITUDES_TRAMITAR', 'Redención de pena'],
    ['PROCEDENCIA_PENA_CUMPLIDA', ''], ['PRISION_DOMICILIARIA_MITAD_PENA', 'No aplica'],
  ]) assert.equal(getAutomaticBlock3Closure({ ...transfer, [field]: value }), '');

  const partial = { PRISION_DOMICILIARIA_MITAD_PENA: `16. ${closures.traslado.respuesta}` };
  applyAutomaticBlock3Closure(partial, { ...transfer, PRISION_DOMICILIARIA_MITAD_PENA: '' });
  assert.equal(partial.CIERRE_CASO, closures.traslado.motivo);
  const correction = { LIBERTAD_CONDICIONAL: 'Sí procede solicitud de libertad condicional' };
  applyAutomaticBlock3Closure(correction, { LIBERTAD_CONDICIONAL: closures.libertad.respuesta, CIERRE_CASO: closures.libertad.motivo });
  assert.equal(correction.CIERRE_CASO, null, 'Corregir la respuesta retira el motivo automático anterior');
  const manual = { LIBERTAD_CONDICIONAL: 'No aplica' };
  applyAutomaticBlock3Closure(manual, { CIERRE_CASO: 'Otro motivo.' });
  assert(!Object.hasOwn(manual, 'CIERRE_CASO'), 'Conserva los cierres manuales');

  // Ejercita el servicio con autoguardados parciales de una gestión existente.
  const persona = require('../repositories/oracle/personaRepository');
  const gestion = require('../repositories/oracle/gestionRepository');
  const originals = { persona: { ...persona }, gestion: { ...gestion } };
  let stored = { ID_GESTION: 30, ...transfer, PRISION_DOMICILIARIA_MITAD_PENA: '' };
  let inserted = 0;
  persona.findActiveContextByDocumento = async () => ({ P_ID_PERSONA: 10, S_ID_SITUACION: 20, S_ACTIVO: 1, S_SITUACION: 'Condenado' });
  persona.listRowsWithActiveSituacionAndGestiones = async () => [{ P_NUMERO: 123, S_ID_SITUACION: 20, S_ACTIVO: 1, S_SITUACION: 'Condenado', G_ID_GESTION: 30 }];
  persona.reconcileGestionActionById = async () => ({});
  gestion.getById = async () => stored;
  gestion.updateGestionById = async (_id, updates) => { stored = { ...stored, ...updates }; return 1; };
  gestion.insertGestion = async () => { inserted += 1; return 31; };
  try {
    const service = require('../services/pplService');
    await service.updateByDocumento('123', { rowIndex: 30, data: {
      'Procedencia de prisión domiciliaria de mitad de pena': closures.traslado.respuesta,
    } });
    assert.equal(stored.CIERRE_CASO, closures.traslado.motivo);
    assert.equal(inserted, 0, 'El traslado informado en el formulario solo cierra, sin crear caso');
    await service.updateByDocumento('123', { rowIndex: 30, data: {
      'Procedencia de libertad condicional': closures.libertad.respuesta,
    } });
    assert.equal(stored.CIERRE_CASO, closures.libertad.motivo);
    await service.updateByDocumento('123', { rowIndex: 30, data: {
      'Procedencia de libertad condicional': 'Sí procede solicitud de libertad condicional',
    } });
    assert.equal(stored.CIERRE_CASO, null);
  } finally {
    Object.assign(persona, originals.persona);
    Object.assign(gestion, originals.gestion);
  }
  console.log('OK: cierres automáticos por pena cumplida y traslado, autoguardado parcial y correcciones.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
