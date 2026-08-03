const assert = require('assert');

async function captureStateSearch(filters) {
  const oraclePoolPath = require.resolve('../db/oraclePool');
  const repositoryPath = require.resolve('../repositories/oracle/personaRepository');
  const oraclePool = require(oraclePoolPath);
  const originalExecute = oraclePool.execute;
  let captured = null;

  oraclePool.execute = async (sql, binds, options) => {
    captured = { sql, binds, options };
    return { rows: [] };
  };
  delete require.cache[repositoryPath];

  try {
    const repository = require(repositoryPath);
    await repository.listCondenadosSummary({
      tipo: 'all',
      filters,
      limit: 10,
      includeExactCounts: false,
    });
    return captured;
  } finally {
    oraclePool.execute = originalExecute;
    delete require.cache[repositoryPath];
  }
}

async function testEstadoUsesDerivedWorkflowMilestones() {
  const captured = await captureStateSearch({
    defensor: 'PEDRO PABLO DIAZ CRISTANCHO',
    estado: 'Entrevistar al usuario',
  });

  assert(captured, 'La búsqueda combinada debe ejecutar SQL.');
  assert.strictEqual(captured.binds.estadoCodigo, 'ENTREVISTAR_USUARIO');
  assert.strictEqual(captured.binds.defensorFilter, 'PEDRO PABLO DIAZ CRISTANCHO%');
  assert.match(captured.sql, /g\.FECHA_ANALISIS IS NOT NULL/);
  assert.match(captured.sql, /g\.RESUMEN_ANALISIS_CASO IS NOT NULL/);
  assert.match(captured.sql, /g\.FECHA_ENTREVISTA IS NOT NULL/);
  assert.match(captured.sql, /g\.ACTUACION_ADELANTAR IS NOT NULL/);
  assert.match(captured.sql, /THEN 'ENTREVISTAR_USUARIO'/);
  assert.match(captured.sql, /= :estadoCodigo/);
}

async function testCanonicalCodesAndDefenderIdsAvoidTextMatching() {
  const captured = await captureStateSearch({
    defensor: 'Nombre histÃ³rico',
    defensorId: '123456',
    estadoCodigo: 'ENTREVISTAR_USUARIO',
  });

  assert.strictEqual(captured.binds.defensorId, '123456');
  assert.strictEqual(captured.binds.estadoCodigo, 'ENTREVISTAR_USUARIO');
  assert(!Object.prototype.hasOwnProperty.call(captured.binds, 'defensorFilter'));
  assert.match(captured.sql, /TO_CHAR\(a\.CEDULA_DEFENSOR\) = :defensorId/);
}

async function testFilterOptionsExposeDefenderIdentity() {
  const oraclePoolPath = require.resolve('../db/oraclePool');
  const repositoryPath = require.resolve('../repositories/oracle/personaRepository');
  const oraclePool = require(oraclePoolPath);
  const originalExecute = oraclePool.execute;

  oraclePool.execute = async (_sql, _binds, options) => {
    if (options?.operation === 'persona.listFilterOptions.DEFENSOR_OPTIONS') {
      return {
        rows: [{ DEFENSOR_ID: '123456', DEFENSOR: 'DEFENSOR CANÓNICO' }],
      };
    }
    return { rows: [] };
  };
  delete require.cache[repositoryPath];

  try {
    const repository = require(repositoryPath);
    const result = await repository.listDistinctCondenadosFilterOptions({ tipo: 'all' });
    assert.deepStrictEqual(result.defensorOptions, [
      { id: '123456', label: 'DEFENSOR CANÓNICO' },
    ]);
    assert.deepStrictEqual(result.defensores, ['DEFENSOR CANÓNICO']);
  } finally {
    oraclePool.execute = originalExecute;
    delete require.cache[repositoryPath];
  }
}

async function testLugarKeepsPrefixFilterAlongsideEstado() {
  const captured = await captureStateSearch({
    defensor: 'PEDRO PABLO DIAZ CRISTANCHO',
    lugar: '  CPAMS\u00a0 EL   BARNÉ ',
    estado: 'Entrevistar al usuario',
  });

  assert.strictEqual(captured.binds.lugarFilter, 'CPAMS EL BARNE%');
  assert.match(captured.sql, /s\.ESTABLECIMIENTO/);
  assert.match(captured.sql, /REGEXP_REPLACE/);
  assert.match(captured.sql, /UNISTR\('\\00A0'\)/);
}

async function testUnknownStateNeverFallsBackToUnfilteredResults() {
  const captured = await captureStateSearch({ estadoCodigo: 'ESTADO_INEXISTENTE' });
  assert.match(captured.sql, /WHERE 1=0/);
  assert(!Object.prototype.hasOwnProperty.call(captured.binds, 'estadoCodigo'));
}

async function testQueryContainsBothBusinessFlows() {
  const captured = await captureStateSearch({ estadoCodigo: 'PENDIENTE_AUDIENCIA' });
  assert.match(captured.sql, /LIKE '%SINDICAD%'/);
  assert.match(captured.sql, /THEN 'PENDIENTE_AUDIENCIA'/);
  assert.match(captured.sql, /THEN 'ENTREVISTAR_USUARIO'/);
  assert.match(captured.sql, /THEN 'CASO_CERRADO'/);
}

async function testCanonicalCenterUsesControlledAliases() {
  const captured = await captureStateSearch({
    centroId: 'CENTRO_CPAMS_EL_BARNE',
    lugar: 'Texto que no debe gobernar la consulta',
  });
  assert.strictEqual(captured.binds.centroAlias0, 'CPAMS EL BARNE');
  assert(!Object.prototype.hasOwnProperty.call(captured.binds, 'lugarFilter'));
  assert.match(captured.sql, /s\.ESTABLECIMIENTO/);
}

async function testActionCodeFiltersThroughCanonicalStateIdentity() {
  const captured = await captureStateSearch({ accionCodigo: 'REALIZAR_ENTREVISTA' });
  assert.strictEqual(captured.binds.accionEstado0, 'ENTREVISTAR_USUARIO');
  assert.match(captured.sql, /ESTADO_CODIGO IN \(:accionEstado0\)/);
}

async function testEverySupportedFilterBuildsAnEffectivePredicate() {
  const captured = await captureStateSearch({
    defensor: 'DEFENSOR EJEMPLO',
    nombre: 'NOMBRE EJEMPLO',
    documento: '123',
    lugar: 'CENTRO EJEMPLO',
    departamento: 'BOYACA',
    municipio: 'TUNJA',
    estadoAccion: 'ANALIZAR_CASO',
    potencialSubrogado: 'potenciales_beneficiarios',
  });
  assert.strictEqual(captured.binds.defensorFilter, 'DEFENSOR EJEMPLO%');
  assert.strictEqual(captured.binds.nombreFilter, '%NOMBRE EJEMPLO%');
  assert.strictEqual(captured.binds.documentoPrefix, '123%');
  assert.strictEqual(captured.binds.lugarFilter, 'CENTRO EJEMPLO%');
  assert.strictEqual(captured.binds.departamentoFilter, 'BOYACA%');
  assert.strictEqual(captured.binds.municipioFilter, 'TUNJA%');
  assert.strictEqual(captured.binds.estadoAccionFilter, '%ANALIZAR_CASO%');
  assert.strictEqual(captured.binds.potencialSubrogado, 'potenciales_beneficiarios');
}

async function testInvalidIdentityFiltersFailClosed() {
  for (const filters of [
    { documento: 'SIN-DIGITOS' },
    { defensorId: 'ID-INVALIDO' },
    { centroId: 'CENTRO_DESCONOCIDO' },
    { potencialSubrogado: 'categoria_desconocida' },
  ]) {
    const captured = await captureStateSearch(filters);
    assert.match(captured.sql, /\b1=0\b/);
  }
}

(async () => {
  await testEstadoUsesDerivedWorkflowMilestones();
  await testLugarKeepsPrefixFilterAlongsideEstado();
  await testCanonicalCodesAndDefenderIdsAvoidTextMatching();
  await testFilterOptionsExposeDefenderIdentity();
  await testUnknownStateNeverFallsBackToUnfilteredResults();
  await testQueryContainsBothBusinessFlows();
  await testCanonicalCenterUsesControlledAliases();
  await testActionCodeFiltersThroughCanonicalStateIdentity();
  await testEverySupportedFilterBuildsAnEffectivePredicate();
  await testInvalidIdentityFiltersFailClosed();
  console.log('OK condenados-filter-state.test');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
