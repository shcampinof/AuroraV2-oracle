const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { listCargas, listSources, safeFileName, SOURCE_DEFINITIONS } = require('../services/cargaBdService');

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

function testCorruptRegistryDoesNotBreakList() {
  const previous = process.env.AURORA_CARGAS_DIR;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-cargas-test-'));
  try {
    process.env.AURORA_CARGAS_DIR = tmpDir;
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'cargas.json'), '[{"id":"truncado","originalName":"archivo.xlsx"');

    assert.deepEqual(listCargas(), []);
    const backups = fs.readdirSync(tmpDir).filter((name) => name.startsWith('cargas.json.corrupt-'));
    assert.equal(backups.length, 1);
  } finally {
    if (previous == null) delete process.env.AURORA_CARGAS_DIR;
    else process.env.AURORA_CARGAS_DIR = previous;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

testSourcesMetadata();
testAuroraToggle();
testSafeFileName();
testCorruptRegistryDoesNotBreakList();

console.log('carga-bd-service.test.js OK');
