const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  listCargas,
  listSources,
  repairRegistryOnStartup,
  safeFileName,
  SOURCE_DEFINITIONS,
} = require('../services/cargaBdService');

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

function testRegistryClearOnStartupWithBackup() {
  const previousDir = process.env.AURORA_CARGAS_DIR;
  const previousClear = process.env.CARGUEBD_CLEAR_REGISTRY_ON_START;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-cargas-clear-test-'));
  try {
    process.env.AURORA_CARGAS_DIR = tmpDir;
    process.env.CARGUEBD_CLEAR_REGISTRY_ON_START = 'true';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'cargas.json'), JSON.stringify([{ id: 'previo' }]));

    const result = repairRegistryOnStartup();

    assert.equal(result.changed, true);
    assert.equal(result.reason, 'cleared');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmpDir, 'cargas.json'), 'utf8')), []);
    const backups = fs.readdirSync(tmpDir).filter((name) => name.startsWith('cargas.json.cleared-'));
    assert.equal(backups.length, 1);
  } finally {
    if (previousDir == null) delete process.env.AURORA_CARGAS_DIR;
    else process.env.AURORA_CARGAS_DIR = previousDir;
    if (previousClear == null) delete process.env.CARGUEBD_CLEAR_REGISTRY_ON_START;
    else process.env.CARGUEBD_CLEAR_REGISTRY_ON_START = previousClear;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function testLongErrorIsTruncatedForPublicList() {
  const previousDir = process.env.AURORA_CARGAS_DIR;
  const previousMax = process.env.CARGUEBD_PUBLIC_ERROR_MAX_LENGTH;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-cargas-error-test-'));
  try {
    process.env.AURORA_CARGAS_DIR = tmpDir;
    process.env.CARGUEBD_PUBLIC_ERROR_MAX_LENGTH = '120';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'cargas.json'),
      JSON.stringify([
        {
          id: 'error-largo',
          status: 'fallido',
          error: `ORA-01400: ${'X'.repeat(500)}`,
        },
      ])
    );

    const [carga] = listCargas();

    assert.ok(carga.error.length <= 123);
    assert.ok(carga.error.endsWith('...'));
  } finally {
    if (previousDir == null) delete process.env.AURORA_CARGAS_DIR;
    else process.env.AURORA_CARGAS_DIR = previousDir;
    if (previousMax == null) delete process.env.CARGUEBD_PUBLIC_ERROR_MAX_LENGTH;
    else process.env.CARGUEBD_PUBLIC_ERROR_MAX_LENGTH = previousMax;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

testSourcesMetadata();
testAuroraToggle();
testSafeFileName();
testCorruptRegistryDoesNotBreakList();
testRegistryClearOnStartupWithBackup();
testLongErrorIsTruncatedForPublicList();

console.log('carga-bd-service.test.js OK');
