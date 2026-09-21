const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const repository = require('../repositories/oracle/reporteGeneralRepository');
const service = require('../services/reporteGeneralService');

async function run() {
  const originalStorageDir = process.env.AURORA_REPORTES_DIR;
  const originalGetGeneralMetrics = repository.getGeneralMetrics;
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-reporte-general-'));

  try {
    process.env.AURORA_REPORTES_DIR = storageDir;
    service.resetForTests();

    const snapshot = service.buildSnapshot({
      USUARIOS_ASIGNADOS: 100,
      ANALISIS_REALIZADOS: 80,
      PROCEDE_SOLICITUD: 40,
      USUARIOS_ENTREVISTADOS: 30,
      USUARIOS_SOLICITAN_ATENCION: 24,
      SOLICITUDES_RADICADAS: 12,
      DECISIONES_JUDICIALES: 9,
      DECISIONES_FAVORABLES: 6,
      DECISIONES_NO_FAVORABLES: 3,
    }, new Date('2026-09-08T23:30:00Z'));

    assert.strictEqual(snapshot.metadata.corte, '2026-09-08');
    assert.deepStrictEqual(snapshot.stages.map((stage) => stage.count), [100, 80, 40, 30, 24, 12, 9]);
    assert.deepStrictEqual(snapshot.stages.map((stage) => stage.percentage), [100, 80, 50, 75, 80, 50, 75]);
    assert.match(snapshot.stages[6].observation, /Favorables: 6 .* No favorables: 3/);

    let queryCount = 0;
    repository.getGeneralMetrics = async () => {
      queryCount += 1;
      return {
        USUARIOS_ASIGNADOS: 10,
        ANALISIS_REALIZADOS: 8,
        PROCEDE_SOLICITUD: 4,
      };
    };

    await service.refreshGeneralReport('prueba');
    assert.strictEqual(queryCount, 1);
    const persistedPath = path.join(storageDir, 'reporte-general.json');
    assert.ok(fs.existsSync(persistedPath), 'el snapshot debe persistirse fuera de memoria');
    assert.strictEqual(JSON.parse(fs.readFileSync(persistedPath, 'utf8')).stages[0].count, 10);
    assert.strictEqual(service.getGeneralReportSnapshot().stages[1].count, 8);

    const refreshedAtTen = await service.schedulerTick(new Date('2026-09-09T03:00:00Z'));
    const duplicateAtTen = await service.schedulerTick(new Date('2026-09-09T03:30:00Z'));
    assert.strictEqual(refreshedAtTen, true, '03:00 UTC equivale a las 22:00 en Bogotá');
    assert.strictEqual(duplicateAtTen, false, 'el programador no debe consultar dos veces en el mismo corte');
    assert.strictEqual(queryCount, 2);

    assert.match(repository.GENERAL_REPORT_SQL, /WITH ranked_situacion/);
    assert.match(repository.GENERAL_REPORT_SQL, /COUNT\(DISTINCT CASE WHEN TIENE_ANALISIS = 1/);
    assert.match(repository.GENERAL_REPORT_SQL, /DECISIONES_JUDICIALES/);
    assert.match(repository.GENERAL_REPORT_SQL, /DESFAVORABLE%/);

    console.log('OK reporte-general.test');
  } finally {
    service.resetForTests();
    repository.getGeneralMetrics = originalGetGeneralMetrics;
    if (originalStorageDir === undefined) delete process.env.AURORA_REPORTES_DIR;
    else process.env.AURORA_REPORTES_DIR = originalStorageDir;
    fs.rmSync(storageDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
