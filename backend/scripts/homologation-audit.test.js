const assert = require('assert');
const { buildHomologationAudit, suggestCenter, textualSimilarity } = require('../services/homologationAuditService');

function testAuditPrioritizesWithoutAutomaticallyMerging() {
  const report = buildHomologationAudit({
    centerRows: [
      { valor: 'CPAMS EL BARNE', cantidad: 10 },
      { valor: 'CPAMS EL BARNÉ', cantidad: 5 },
      { valor: 'CPAMS EL BARNEE', cantidad: 7 },
      { valor: 'CENTRO HISTÓRICO X', cantidad: 3 },
    ],
    actionRows: [
      { estadoCodigo: 'ENTREVISTAR_USUARIO', valorOriginal: 'Entrevistar al usuario', cantidad: 8 },
      { estadoCodigo: 'ENTREVISTAR_USUARIO', valorOriginal: 'Entrevistar al usuari0', cantidad: 2 },
      { estadoCodigo: 'ESTADO_LEGACY', valorOriginal: 'Acción histórica', cantidad: 1 },
      { estadoCodigo: 'ENTREVISTAR_USUARIO', valorOriginal: '', cantidad: 4 },
    ],
    pendingLimit: 10,
    now: new Date('2026-07-31T12:00:00.000Z'),
  });

  assert.strictEqual(report.readOnly, true);
  assert.strictEqual(report.generatedAt, '2026-07-31T12:00:00.000Z');
  assert.strictEqual(report.centers.summary.identities, 3);
  assert.strictEqual(report.centers.summary.homologatedOccurrences, 15);
  assert.strictEqual(report.centers.summary.pendingOccurrences, 10);
  assert.strictEqual(report.centers.summary.occurrenceCoveragePercent, 60);
  assert.strictEqual(report.centers.pending[0].label, 'CPAMS EL BARNEE');
  assert.strictEqual(report.centers.pending[0].suggestion.id, 'CENTRO_CPAMS_EL_BARNE');
  assert.strictEqual(report.centers.pending[0].suggestion.requiresApproval, true);
  assert.strictEqual(report.actions.summary.homologatedOccurrences, 8);
  assert.strictEqual(report.actions.summary.pendingOccurrences, 3);
  assert.strictEqual(report.actions.summary.records, 15);
  assert.strictEqual(report.actions.summary.missingSourceTextOccurrences, 4);
  assert.strictEqual(report.actions.summary.canonicalDerivedOccurrences, 14);
  assert.strictEqual(report.actions.pending[0].reason, 'estado_texto_inconsistente');
  assert.strictEqual(report.actions.pending[0].expectedAction.codigo, 'REALIZAR_ENTREVISTA');
}

function testSimilarityIsOnlyAdvisory() {
  assert(textualSimilarity('CPAMS EL BARNEE', 'CPAMS EL BARNE') >= 0.92);
  assert.strictEqual(suggestCenter('CPAMS EL BARNEE')?.requiresApproval, true);
  assert.strictEqual(suggestCenter('CENTRO X'), null);
}

async function testRepositoryAuditQueriesAreReadOnly() {
  const oraclePoolPath = require.resolve('../db/oraclePool');
  const repositoryPath = require.resolve('../repositories/oracle/personaRepository');
  const oraclePool = require(oraclePoolPath);
  const originalExecute = oraclePool.execute;
  const captured = [];
  oraclePool.execute = async (sql, binds, options) => {
    captured.push({ sql, binds, options });
    if (options?.operation === 'persona.listHomologationValues.CENTERS') {
      return { rows: [{ LUGAR: 'CPAMS EL BARNE', TOTAL: 4 }] };
    }
    if (options?.operation === 'persona.listHomologationValues.ACTIONS') {
      return { rows: [{ ESTADO_CODIGO: 'ANALIZAR_CASO', ACCION_ORIGINAL: 'Analizar el caso', TOTAL: 3 }] };
    }
    return { rows: [] };
  };
  delete require.cache[repositoryPath];

  try {
    const repository = require(repositoryPath);
    const values = await repository.listCondenadosHomologationValues({ tipo: 'all', maxPerField: 25 });
    assert.deepStrictEqual(values.centros, [{ valor: 'CPAMS EL BARNE', cantidad: 4 }]);
    assert.deepStrictEqual(values.acciones, [
      { estadoCodigo: 'ANALIZAR_CASO', valorOriginal: 'Analizar el caso', cantidad: 3 },
    ]);
    assert.strictEqual(captured.length, 2);
    for (const query of captured) {
      assert.strictEqual(query.binds.maxRows, 25);
      assert.match(query.sql, /^\s*WITH\b/i);
      assert(!/\b(?:INSERT|UPDATE|DELETE|MERGE|COMMIT)\b/i.test(query.sql));
    }
  } finally {
    oraclePool.execute = originalExecute;
    delete require.cache[repositoryPath];
  }
}

(async () => {
  testAuditPrioritizesWithoutAutomaticallyMerging();
  testSimilarityIsOnlyAdvisory();
  await testRepositoryAuditQueriesAreReadOnly();
  console.log('OK homologation-audit.test');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
