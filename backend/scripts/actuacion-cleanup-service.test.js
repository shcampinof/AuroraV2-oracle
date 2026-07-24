const assert = require('assert');

const {
  cleanupDefensor,
  expectedConfirmation,
  normalizeText,
} = require('../services/actuacionCleanupService');

function testConfirmationIncludesExactCount() {
  assert.equal(expectedConfirmation(12), 'ELIMINAR 12 ACTUACIONES');
  assert.equal(expectedConfirmation('3'), 'ELIMINAR 3 ACTUACIONES');
  assert.equal(expectedConfirmation(4, 9), 'ELIMINAR 4 ACTUACIONES Y 9 ASIGNACIONES');
}

function testDefensorNormalization() {
  assert.equal(normalizeText('  Prueba   Piloto '), 'PRUEBA PILOTO');
  assert.equal(normalizeText('PRUÉBA PILÓTO'), 'PRUEBA PILOTO');
}

function testConfiguredDefensor() {
  const previous = process.env.CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR;
  process.env.CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR = 'DEFENSOR CONTROLADO';
  try {
    assert.equal(cleanupDefensor(), 'DEFENSOR CONTROLADO');
  } finally {
    if (previous == null) delete process.env.CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR;
    else process.env.CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR = previous;
  }
}

testConfirmationIncludesExactCount();
testDefensorNormalization();
testConfiguredDefensor();

console.log('actuacion-cleanup-service.test.js OK');
