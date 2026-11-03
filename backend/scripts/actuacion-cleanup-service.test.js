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

async function testSelectiveCleanup() {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const repo = require('../repositories/oracle/actuacionCleanupRepository');
  const { executeCleanup, previewCleanup } = require('../services/actuacionCleanupService');
  const originals = { ...repo };
  const auditDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-cleanup-'));
  const previousDir = process.env.AURORA_CARGAS_DIR;
  process.env.AURORA_CARGAS_DIR = auditDir;
  const previousDefensor = process.env.CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR;
  delete process.env.CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR;
  let deletes = 0;
  const payload = { defensor: 'PRUEBA PILOTO', mode: 'selected', gestionIds: [10, 20], expectedCount: 2,
    expectedAssignments: 0, confirmation: 'ELIMINAR 2 ACTUACIONES' };
  try {
    repo.previewSelected = async (_defensor, ids) => ({ totalActuaciones: ids.length, totalAsignaciones: 0, totalPersonas: 1,
      actuaciones: ids.map((id) => ({ ID_GESTION: id })) });
    repo.deleteSelected = async (_defensor, ids) => { deletes += 1; assert.deepEqual(ids, [10, 20]); return { deleted: 2, assignmentsDeleted: 0 }; };
    repo.deleteByActiveDefensor = async () => { throw new Error('La selección no debe ejecutar la eliminación total.'); };
    for (const invalid of [[], [10, 10], [10, -2], ['10'], Array(1001).fill(10)]) {
      await assert.rejects(executeCleanup({ ...payload, gestionIds: invalid }), (err) => err.status === 400);
    }
    await assert.rejects(executeCleanup({ ...payload, mode: 'all' }), (err) => err.status === 400);
    await assert.rejects(executeCleanup({ ...payload, defensor: 'DEFENSOR REAL' }), (err) => err.status === 400);
    await assert.rejects(executeCleanup({ ...payload, confirmation: '' }), (err) => err.status === 400);
    const result = await executeCleanup(payload);
    assert.equal(result.assignmentsDeleted, 0);
    assert.equal(deletes, 1);
    const audit = JSON.parse(fs.readFileSync(path.join(auditDir, 'actuaciones-cleanup.jsonl'), 'utf8'));
    assert.deepEqual(audit.gestionIds, [10, 20]);
    repo.previewSelected = async () => ({ totalActuaciones: 1, totalAsignaciones: 0 });
    await assert.rejects(executeCleanup(payload), (err) => err.status === 409);
    assert.equal(deletes, 1, 'Un ID ajeno, reasignado o eliminado debe cancelar toda la selección.');
    repo.previewSelected = originals.previewSelected;
    repo.previewByActiveDefensor = async (_defensor, options) => {
      assert.equal(options.offset, 500);
      return { totalActuaciones: 501, totalAsignaciones: 2, actuaciones: [{ ID_GESTION: 501 }] };
    };
    const page = await previewCleanup('PRUEBA PILOTO', { offset: 500 });
    assert.equal(page.truncated, false);
    assert.equal(page.offset, 500);
  } finally {
    Object.assign(repo, originals);
    if (previousDir == null) delete process.env.AURORA_CARGAS_DIR;
    else process.env.AURORA_CARGAS_DIR = previousDir;
    if (previousDefensor == null) delete process.env.CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR;
    else process.env.CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR = previousDefensor;
    fs.rmSync(auditDir, { recursive: true, force: true });
  }
}

testSelectiveCleanup().then(() => console.log('actuacion-cleanup-service.test.js OK')).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
