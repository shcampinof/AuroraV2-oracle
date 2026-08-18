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

async function capturePagedSearch(filters, { tipo = 'condenado', limit = 50, offset = 0 } = {}) {
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
    await repository.listCondenadosSummary({ tipo, filters, limit, offset, includeExactCounts: true });
    return captured;
  } finally {
    oraclePool.execute = originalExecute;
    delete require.cache[repositoryPath];
  }
}

async function captureAssignedCasesReport(params, rows = []) {
  const oraclePoolPath = require.resolve('../db/oraclePool');
  const repositoryPath = require.resolve('../repositories/oracle/personaRepository');
  const oraclePool = require(oraclePoolPath);
  const originalExecute = oraclePool.execute;
  let captured = null;

  oraclePool.execute = async (sql, binds, options) => {
    captured = { sql, binds, options };
    return { rows };
  };
  delete require.cache[repositoryPath];

  try {
    const repository = require(repositoryPath);
    const result = await repository.listAssignedCasesForReport(params);
    return { captured, result };
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

async function testCanonicalDefenderIdKeepsHistoricalNameFallback() {
  const captured = await captureStateSearch({
    defensor: 'Nombre histÃ³rico',
    defensorId: '123456',
    estadoCodigo: 'ENTREVISTAR_USUARIO',
  });

  assert.strictEqual(captured.binds.defensorId, '123456');
  assert.strictEqual(captured.binds.defensorFilter, 'NOMBRE HISTORICO');
  assert.strictEqual(captured.binds.estadoCodigo, 'ENTREVISTAR_USUARIO');
  assert.match(
    captured.sql,
    /TO_CHAR\(a\.CEDULA_DEFENSOR\) = :defensorId\s+OR \(\s*a\.CEDULA_DEFENSOR IS NULL[\s\S]+a\.NOMBRE_DEFENSOR[\s\S]+= :defensorFilter/
  );
  assert.doesNotMatch(captured.sql, /LIKE :defensorFilter/);
}

async function testTypedDefenderWithoutIdRemainsAPrefixSearch() {
  const captured = await captureStateSearch({ defensor: 'LUBIANA' }, 'all');
  assert.strictEqual(captured.binds.defensorFilter, 'LUBIANA%');
  assert.match(captured.sql, /LIKE :defensorFilter/);
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

async function testAssignedUsersDefaultAlwaysRequiresActiveSituation() {
  for (const filters of [
    { estadoCodigo: 'CASO_CERRADO' },
    { accionCodigo: 'SIN_ACCION_PENDIENTE' },
    { departamento: 'BOGOTA D.C.' },
    { documento: '1000221818' },
    { defensor: 'NANCY LANUZA' },
    { defensorId: '123456' },
    { nombre: 'MARIA ALEJANDRA' },
  ]) {
    const captured = await captureStateSearch(filters, 'all');
    assert.match(captured.sql, /AND NVL\(s\.ACTIVO, 0\) = 1/);
    assert.doesNotMatch(captured.sql, /historical_s/);
    assert.doesNotMatch(captured.sql, /historical_a/);
  }
}

async function testAssignedUsersCheckboxExplicitlyIncludesInactiveSituations() {
  for (const filters of [
    { incluirFueraPrision: '1' },
    { documento: '1000221818', incluirFueraPrision: '1' },
    { defensor: 'NANCY LANUZA', incluirFueraPrision: true },
    { nombre: 'MARIA ALEJANDRA', incluirFueraPrision: 'true' },
    { departamento: 'BOGOTA D.C.', incluirFueraPrision: 'si' },
    { estadoCodigo: 'CASO_CERRADO', incluirFueraPrision: 'sí' },
  ]) {
    const captured = await captureStateSearch(filters, 'all');
    assert.doesNotMatch(captured.sql, /AND NVL\(s\.ACTIVO, 0\) = 1/);
    assert.doesNotMatch(captured.sql, /TRIM\(s\.SITUACION\) IS NOT NULL/);
  }
}

async function testAssignedUsersClosedFilterDoesNotControlInactiveUniverse() {
  const activeOnly = await captureStateSearch({
    defensor: 'LUBIANA',
    estadoCodigo: 'CASO_CERRADO',
  }, 'all');
  const withInactive = await captureStateSearch({
    defensor: 'LUBIANA',
    estadoCodigo: 'CASO_CERRADO',
    incluirFueraPrision: '1',
  }, 'all');

  assert.strictEqual(activeOnly.binds.defensorFilter, 'LUBIANA%');
  assert.strictEqual(withInactive.binds.defensorFilter, 'LUBIANA%');
  assert.strictEqual(withInactive.binds.estadoCodigo, 'CASO_CERRADO');
  assert.match(activeOnly.sql, /AND NVL\(s\.ACTIVO, 0\) = 1/);
  assert.doesNotMatch(withInactive.sql, /AND NVL\(s\.ACTIVO, 0\) = 1/);
}

async function testPagClosedFilterKeepsMandatoryActiveRuleWithoutHistoricalExpansion() {
  const captured = await captureStateSearch({ estadoCodigo: 'CASO_CERRADO' }, 'condenado');
  assert.match(captured.sql, /NVL\(s\.ACTIVO, 0\) = 1/);
  assert.doesNotMatch(captured.sql, /historical_s/);
  assert.doesNotMatch(captured.sql, /historical_a/);
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

async function testPlaceholderAnswersRemainEmptyInDerivedState() {
  const captured = await captureStateSearch({ documento: '123456' });
  assert.match(captured.sql, /TRIM\(TO_CHAR\(g\.DECISION_USUARIO\)\) NOT IN \('-', '--'\)/);
  assert.match(captured.sql, /OTRAS_SOLICITUDES_TRAMITAR[\s\S]*IN \(\s*'',\s*'-',\s*'--',\s*'NINGUNA'/);
  assert.match(captured.sql, /OTRAS_SOLICITUDES_TRAMITAR[\s\S]*= 'NINGUNA'/);
  assert.match(captured.sql, /HAS_POSITIVE_ANALYSIS_OUTCOME|REGEXP_REPLACE/);
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

async function testPagFiltersActiveAndAssignmentStateBeforePagination() {
  const assignment = await capturePagedSearch({ asignacionEstado: 'sin_defensor' }, { offset: 100 });
  assert.match(assignment.sql, /NVL\(s\.ACTIVO, 0\) = 1/);
  assert.match(assignment.sql, /a\.CEDULA_DEFENSOR IS NULL AND TRIM\(a\.NOMBRE_DEFENSOR\) IS NULL/);
  assert.match(assignment.sql, /COUNT\(\*\) OVER\(\) AS TOTAL_MATCHED/);
  assert.match(assignment.sql, /WHERE ROWNUM <= :endRow[\s\S]*WHERE PAGE_ROW_NUMBER > :offsetRows/);
  assert.strictEqual(assignment.binds.endRow, 150);
  assert.strictEqual(assignment.binds.offsetRows, 100);

  const reassignment = await capturePagedSearch({ asignacionEstado: 'con_defensor' });
  assert.match(reassignment.sql, /a\.CEDULA_DEFENSOR IS NOT NULL OR TRIM\(a\.NOMBRE_DEFENSOR\) IS NOT NULL/);
}

async function testReportUsesTheSameAssignedUsersUniverseAndState() {
  const { captured, result } = await captureAssignedCasesReport(
    {
      defensorCedula: '1.234.567',
      defensorNombre: 'Lubiána HistÃ³rica',
    },
    [{ ESTADO_CODIGO: 'CASO_CERRADO', ACTIVO: 0 }]
  );

  assert.strictEqual(captured.options.operation, 'reportes.atenciones.listAssignedCases');
  assert.strictEqual(captured.binds.defensorCedula, '1234567');
  assert.strictEqual(captured.binds.defensorNombre, 'LUBIANA HISTORICA');
  assert.match(captured.sql, /PARTITION BY a\.ID_PERSONA[\s\S]+a\.FECHA_ASIGNACION DESC NULLS LAST/);
  assert.match(captured.sql, /a\.RN = 1[\s\S]+TO_CHAR\(a\.CEDULA_DEFENSOR\) = :defensorCedula/);
  assert.match(captured.sql, /a\.CEDULA_DEFENSOR IS NULL[\s\S]+a\.NOMBRE_DEFENSOR[\s\S]+= :defensorNombre/);
  assert.match(captured.sql, /CASE[\s\S]+NVL\(s\.ACTIVO, 0\) <> 1 THEN 'CASO_CERRADO'/);
  assert.match(captured.sql, /CASE WHEN ESTADO_CODIGO = 'CASO_CERRADO' THEN 0 ELSE 1 END AS ACTIVO/);
  assert.doesNotMatch(captured.sql, /TRIM\(s\.SITUACION\) IS NOT NULL/);
  assert.deepStrictEqual(result, [{ ESTADO_CODIGO: 'CASO_CERRADO', ACTIVO: 0, ESTADO: 'Caso cerrado' }]);
}

async function testReportWithoutDefenderIdentityFailsClosed() {
  const { captured } = await captureAssignedCasesReport({});
  assert.match(captured.sql, /WHERE 1=0/);
  assert.deepStrictEqual(captured.binds, {});
}

(async () => {
  await testEstadoUsesDerivedWorkflowMilestones();
  await testLugarKeepsPrefixFilterAlongsideEstado();
  await testCanonicalDefenderIdKeepsHistoricalNameFallback();
  await testTypedDefenderWithoutIdRemainsAPrefixSearch();
  await testFilterOptionsExposeDefenderIdentity();
  await testFilterOptionsOnlyUseActivePrisonSituations();
  await testUnknownStateNeverFallsBackToUnfilteredResults();
  await testQueryContainsBothBusinessFlows();
  await testAssignedUsersDefaultAlwaysRequiresActiveSituation();
  await testAssignedUsersCheckboxExplicitlyIncludesInactiveSituations();
  await testAssignedUsersClosedFilterDoesNotControlInactiveUniverse();
  await testPagClosedFilterKeepsMandatoryActiveRuleWithoutHistoricalExpansion();
  await testCanonicalCenterUsesControlledAliases();
  await testOtherActiveLocationsExcludeOfficialAliases();
  await testActionCodeFiltersThroughCanonicalStateIdentity();
  await testEveryActionFiltersThroughItsCanonicalStates();
  await testUpdatedLegalSituationGovernsFlowAndTypeFilter();
  await testAuroraFilterUsesTheRadicationDateForTheSelectedFlow();
  await testPlaceholderAnswersRemainEmptyInDerivedState();
  await testEverySupportedFilterBuildsAnEffectivePredicate();
  await testInvalidIdentityFiltersFailClosed();
  await testPagFiltersActiveAndAssignmentStateBeforePagination();
  await testReportUsesTheSameAssignedUsersUniverseAndState();
  await testReportWithoutDefenderIdentityFailsClosed();
  console.log('OK condenados-filter-state.test');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
