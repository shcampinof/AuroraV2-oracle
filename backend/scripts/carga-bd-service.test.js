const assert = require('assert');

const { listSources, safeFileName, SOURCE_DEFINITIONS } = require('../services/cargaBdService');

function testSourcesMetadata() {
  assert.ok(SOURCE_DEFINITIONS.aurora_10, 'Debe existir fuente aurora_10');
  assert.ok(SOURCE_DEFINITIONS.sisipec, 'Debe existir fuente sisipec');
  assert.ok(SOURCE_DEFINITIONS.ponal, 'Debe existir fuente ponal');

  const sources = listSources();
  assert.equal(sources.length, 3);
  assert.deepEqual(
    sources.map((source) => source.id).sort(),
    ['aurora_10', 'ponal', 'sisipec']
  );
}

function testAuroraToggle() {
  const previous = process.env.CARGUEBD_AURORA10_ENABLED;
  process.env.CARGUEBD_AURORA10_ENABLED = 'false';
  try {
    const aurora = listSources().find((source) => source.id === 'aurora_10');
    assert.equal(aurora.enabled, false);
  } finally {
    if (previous == null) delete process.env.CARGUEBD_AURORA10_ENABLED;
    else process.env.CARGUEBD_AURORA10_ENABLED = previous;
  }
}

function testSafeFileName() {
  assert.equal(safeFileName('CONSOLIDADO PPL REGIONES.xlsx'), 'CONSOLIDADO_PPL_REGIONES.xlsx');
  assert.equal(safeFileName('../../Consolidado SISIPEC.xlsx'), 'Consolidado_SISIPEC.xlsx');
  assert.equal(safeFileName('áéíóú.xlsx'), 'aeiou.xlsx');
}

testSourcesMetadata();
testAuroraToggle();
testSafeFileName();

console.log('carga-bd-service.test.js OK');
