const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  invalidatePplCachesAfterSuccessfulCarga,
  listCargas,
  listSources,
  reconcilePplStateAfterSuccessfulCarga,
  repairRegistryOnStartup,
  safeFileName,
  SOURCE_DEFINITIONS,
} = require('../services/cargaBdService');
const pplService = require('../services/pplService');

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
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmpDir, 'cargas.json'), 'utf8')), []);
    const backups = fs.readdirSync(tmpDir).filter((name) => name.startsWith('cargas.json.corrupt-'));
    assert.equal(backups.length, 1);
  } finally {
    if (previous == null) delete process.env.AURORA_CARGAS_DIR;
    else process.env.AURORA_CARGAS_DIR = previous;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function testLegacyRegistryIsMigratedAndErrorsAreBoundedOnDisk() {
  const previousDir = process.env.AURORA_CARGAS_DIR;
  const previousMax = process.env.CARGUEBD_PUBLIC_ERROR_MAX_LENGTH;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-cargas-legacy-test-'));
  try {
    process.env.AURORA_CARGAS_DIR = tmpDir;
    process.env.CARGUEBD_PUBLIC_ERROR_MAX_LENGTH = '120';
    fs.writeFileSync(
      path.join(tmpDir, 'cargas.json'),
      JSON.stringify({
        cargas: [
          {
            id: 'legacy',
            status: 'fallido',
            createdAt: new Date().toISOString(),
            error: `ORA-01400: ${'X'.repeat(500)}`,
          },
        ],
      })
    );

    const [carga] = listCargas();
    const persisted = JSON.parse(fs.readFileSync(path.join(tmpDir, 'cargas.json'), 'utf8'));

    assert.equal(carga.id, 'legacy');
    assert.ok(carga.error.length <= 123);
    assert.ok(Array.isArray(persisted));
    assert.ok(persisted[0].error.length <= 123);
    assert.equal(fs.readdirSync(tmpDir).filter((name) => name.endsWith('.tmp')).length, 0);
  } finally {
    if (previousDir == null) delete process.env.AURORA_CARGAS_DIR;
    else process.env.AURORA_CARGAS_DIR = previousDir;
    if (previousMax == null) delete process.env.CARGUEBD_PUBLIC_ERROR_MAX_LENGTH;
    else process.env.CARGUEBD_PUBLIC_ERROR_MAX_LENGTH = previousMax;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function testRegistryRetentionKeepsOnlyRecentEntries() {
  const previousDir = process.env.AURORA_CARGAS_DIR;
  const previousDays = process.env.CARGUEBD_REGISTRY_RETENTION_DAYS;
  const previousRecords = process.env.CARGUEBD_REGISTRY_MAX_RECORDS;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-cargas-retention-test-'));
  try {
    process.env.AURORA_CARGAS_DIR = tmpDir;
    process.env.CARGUEBD_REGISTRY_RETENTION_DAYS = '2';
    process.env.CARGUEBD_REGISTRY_MAX_RECORDS = '2';
    fs.writeFileSync(
      path.join(tmpDir, 'cargas.json'),
      JSON.stringify([
        { id: 'reciente-1', status: 'exitoso', updatedAt: new Date().toISOString(), error: '' },
        { id: 'reciente-2', status: 'fallido', updatedAt: new Date().toISOString(), error: '' },
        { id: 'antiguo', status: 'exitoso', updatedAt: '2020-01-01T00:00:00.000Z', error: '' },
      ])
    );

    assert.deepEqual(listCargas().map((record) => record.id), ['reciente-1', 'reciente-2']);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(tmpDir, 'cargas.json'), 'utf8')).map((record) => record.id),
      ['reciente-1', 'reciente-2']
    );
  } finally {
    if (previousDir == null) delete process.env.AURORA_CARGAS_DIR;
    else process.env.AURORA_CARGAS_DIR = previousDir;
    if (previousDays == null) delete process.env.CARGUEBD_REGISTRY_RETENTION_DAYS;
    else process.env.CARGUEBD_REGISTRY_RETENTION_DAYS = previousDays;
    if (previousRecords == null) delete process.env.CARGUEBD_REGISTRY_MAX_RECORDS;
    else process.env.CARGUEBD_REGISTRY_MAX_RECORDS = previousRecords;
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
    process.env.CARGUEBD_PUBLIC_ERROR_MAX_LENGTH = '999999';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'cargas.json'),
      JSON.stringify([
        {
          id: 'error-largo',
          status: 'fallido',
          error: `ORA-01400: ${'X'.repeat(5000)}`,
        },
      ])
    );

    const [carga] = listCargas();

    assert.ok(carga.error.length <= 2003);
    assert.ok(carga.error.endsWith('...'));
  } finally {
    if (previousDir == null) delete process.env.AURORA_CARGAS_DIR;
    else process.env.AURORA_CARGAS_DIR = previousDir;
    if (previousMax == null) delete process.env.CARGUEBD_PUBLIC_ERROR_MAX_LENGTH;
    else process.env.CARGUEBD_PUBLIC_ERROR_MAX_LENGTH = previousMax;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function testSuccessfulCargaInvalidatesPplCaches() {
  const previousVersion = pplService.getDataVersion();
  const logLines = [];

  const nextVersion = invalidatePplCachesAfterSuccessfulCarga(
    { sourceId: 'sisipec' },
    (line) => logLines.push(line)
  );

  assert.equal(nextVersion, previousVersion + 1);
  assert.equal(pplService.getDataVersion(), previousVersion + 1);
  assert.ok(logLines.join('').includes('Cache de consultas PPL invalidada'));
  assert.ok(logLines.join('').includes('sisipec'));
}

async function testSuccessfulCargaReconcilesBeforeInvalidatingCaches() {
  const originalReconcile = pplService.reconcileCurrentGestionActions;
  const previousVersion = pplService.getDataVersion();
  const calls = [];
  const logLines = [];

  pplService.reconcileCurrentGestionActions = async () => {
    calls.push('reconcile');
    return { updated: 12 };
  };
  try {
    const result = await reconcilePplStateAfterSuccessfulCarga(
      { sourceId: 'aurora_10' },
      (line) => logLines.push(line)
    );

    assert.deepStrictEqual(calls, ['reconcile']);
    assert.equal(result.updated, 12);
    assert.equal(result.skipped, false);
    assert.equal(result.dataVersion, previousVersion + 1);
    assert.ok(logLines.join('').includes('Recalculando acciones vigentes'));
    assert.ok(logLines.join('').includes('12 gestion(es) vigente(s) actualizada(s)'));
  } finally {
    pplService.reconcileCurrentGestionActions = originalReconcile;
  }
}

(async () => {
  testSourcesMetadata();
  testAuroraToggle();
  testSafeFileName();
  testCorruptRegistryDoesNotBreakList();
  testLegacyRegistryIsMigratedAndErrorsAreBoundedOnDisk();
  testRegistryRetentionKeepsOnlyRecentEntries();
  testRegistryClearOnStartupWithBackup();
  testLongErrorIsTruncatedForPublicList();
  testSuccessfulCargaInvalidatesPplCaches();
  await testSuccessfulCargaReconcilesBeforeInvalidatingCaches();

  console.log('carga-bd-service.test.js OK');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
