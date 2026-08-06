const assert = require('assert');

async function captureStateSearch(filters, tipo = 'all') {
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
      tipo,
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

async function testFilterOptionsOnlyUseActivePrisonSituations() {
  const oraclePoolPath = require.resolve('../db/oraclePool');
  const repositoryPath = require.resolve('../repositories/oracle/personaRepository');
  const oraclePool = require(oraclePoolPath);
  const originalExecute = oraclePool.execute;
  const capturedSql = [];

  oraclePool.execute = async (sql) => {
    capturedSql.push(sql);
    return { rows: [] };
  };
  delete require.cache[repositoryPath];

  try {
    const repository = require(repositoryPath);
    await repository.listDistinctCondenadosFilterOptions({ tipo: 'all' });
    assert.strictEqual(capturedSql.length, 4);
    capturedSql.forEach((sql) => {
      assert.match(sql, /WHERE\s+s\.RN\s*=\s*1\s+AND\s+NVL\(s\.ACTIVO,\s*0\)\s*=\s*1/i);
      assert.match(sql, /s\.RN\s*=\s*1/i);
    });

    capturedSql.length = 0;
    await repository.listCondenadosHomologationValues({ tipo: 'all' });
    assert.strictEqual(capturedSql.length, 2);
    capturedSql.forEach((sql) => {
      assert.match(sql, /WHERE\s+s\.RN\s*=\s*1\s+AND\s+NVL\(s\.ACTIVO,\s*0\)\s*=\s*1/i);
      assert.match(sql, /s\.RN\s*=\s*1/i);
    });
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
  assert.match(captured.sql, /NVL\(s\.ACTIVO, 0\) = 1/);
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
    centroId: 'INPEC_150',
    lugar: 'Texto que no debe gobernar la consulta',
  });
  assert.strictEqual(captured.binds.centroAlias0, 'CPAMS EL BARNE');
  assert(!Object.prototype.hasOwnProperty.call(captured.binds, 'lugarFilter'));
  assert.match(captured.sql, /s\.ESTABLECIMIENTO/);
  assert.match(captured.sql, /NVL\(s\.ACTIVO, 0\) = 1/);
}

async function testOtherActiveLocationsExcludeOfficialAliases() {
  const captured = await captureStateSearch({ centroId: 'CATEGORIA_OTROS_LUGARES_ACTIVOS' });
  assert.strictEqual(captured.binds.centroOficial0, 'EPMSC LETICIA');
  assert(!Object.prototype.hasOwnProperty.call(captured.binds, 'lugarFilter'));
  assert.match(captured.sql, /NOT IN \(:centroOficial0/);
  assert.match(captured.sql, /NVL\(s\.ACTIVO, 0\) = 1/);
}

async function testActionCodeFiltersThroughCanonicalStateIdentity() {
  const captured = await captureStateSearch({ accionCodigo: 'REALIZAR_ENTREVISTA' });
  assert.strictEqual(captured.binds.accionEstado0, 'ENTREVISTAR_USUARIO');
  assert.match(captured.sql, /ESTADO_CODIGO IN \(:accionEstado0\)/);
}

async function testEveryActionFiltersThroughItsCanonicalStates() {
  const { listAcciones } = require('../domain/catalogosHomologacion');
  for (const action of listAcciones()) {
    const captured = await captureStateSearch({ accionCodigo: action.codigo });
    assert(captured, `La acción ${action.codigo} debe ejecutar SQL.`);
    action.estadoCodigos.forEach((estadoCodigo, index) => {
      assert.strictEqual(captured.binds[`accionEstado${index}`], estadoCodigo);
    });
    assert.match(captured.sql, /ESTADO_CODIGO IN \(:accionEstado0/);
  }
}

async function testUpdatedLegalSituationGovernsFlowAndTypeFilter() {
  const condenado = await captureStateSearch({}, 'condenado');
  const sindicado = await captureStateSearch({}, 'sindicado');

  [condenado, sindicado].forEach((captured) => {
    assert.match(
      captured.sql,
      /COALESCE\(\s*NULLIF\(TRIM\(TO_CHAR\(s\.SITUACION_JURIDICA_ACTUALIZADA\)\), ''\),\s*TO_CHAR\(s\.SITUACION\)\s*\)/
    );
  });
  assert.match(condenado.sql, /LIKE '%condenad%'/);
  assert.match(sindicado.sql, /LIKE '%sindicad%'/);
}

async function testAuroraFilterUsesTheRadicationDateForTheSelectedFlow() {
  const captured = await captureStateSearch({ estadoCodigo: 'PENDIENTE_DECISION' });
  assert.match(captured.sql, /WHEN .*ACTUACION_ADELANTAR.*LIKE '%UTILIDAD PUBLICA%'.*THEN g\.FECHA_RADICACION_UTILIDAD/s);
  assert.match(captured.sql, /ELSE g\.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD/);
  assert.match(captured.sql, /DECISION_USUARIO.*LIKE 'SI%'/s);
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
  await testFilterOptionsOnlyUseActivePrisonSituations();
  await testUnknownStateNeverFallsBackToUnfilteredResults();
  await testQueryContainsBothBusinessFlows();
  await testCanonicalCenterUsesControlledAliases();
  await testOtherActiveLocationsExcludeOfficialAliases();
  await testActionCodeFiltersThroughCanonicalStateIdentity();
  await testEveryActionFiltersThroughItsCanonicalStates();
  await testUpdatedLegalSituationGovernsFlowAndTypeFilter();
  await testAuroraFilterUsesTheRadicationDateForTheSelectedFlow();
  await testEverySupportedFilterBuildsAnEffectivePredicate();
  await testInvalidIdentityFiltersFailClosed();
  console.log('OK condenados-filter-state.test');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
