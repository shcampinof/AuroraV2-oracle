const assert = require('assert/strict');
const pplRouter = require('../routes/ppl');

const contract = pplRouter.condenadosContract;
assert(contract, 'La ruta PPL debe exponer su contrato interno para validación.');

function activeRawRow() {
  return {
    S_ACTIVO: 1,
    FUENTE_SITUACION: 'SISIPEC',
    FECHA_CORTE_SITUACION: new Date('2026-07-07T00:00:00.000Z'),
    TOTAL_SITUACIONES: 2,
    MIN_ACTIVO_HISTORICO: 0,
    MAX_ACTIVO_HISTORICO: 1,
    ESTADO_CODIGO: 'ENTREVISTAR_USUARIO',
    'Numero de identificacion': '1000123456',
    Nombre: 'USUARIO PRUEBA',
    'Nombre del lugar de privacion de la libertad': 'CPAMS EL BARNÉ',
    'Departamento del lugar de privacion de la libertad': 'BOYACÁ',
    'Distrito/municipio del lugar de privacion de la libertad': 'CÓMBITA',
    'Autoridad a cargo': 'JUZGADO PRUEBA',
    'Numero de proceso': 'PROCESO-1',
    'Situacion Juridica': 'Condenado',
    'Defensor(a) Publico(a) Asignado para tramitar la solicitud': 'DEFENSOR PRUEBA',
    DEFENSOR_ID: '123456',
    'Fecha de analisis juridico del caso': new Date('2026-01-01T00:00:00.000Z'),
    'Resumen del analisis del caso': 'Resumen cargado',
    'Accion a realizar': 'Texto histórico distinto',
    CATEGORIA_POTENCIAL_SUBROGADO: 'potenciales_beneficiarios',
  };
}

function testEveryColumnHasMappedDataContract() {
  const mapped = contract.mapRow(activeRawRow());
  contract.columns.forEach((column) => {
    assert(Object.prototype.hasOwnProperty.call(mapped, column), `Falta campo mapeado para columna ${column}`);
  });
  assert.equal(mapped.situacionActiva, true);
  assert.equal(mapped.numeroIdentificacion, '1000123456');
  assert.equal(mapped.nombreUsuario, 'USUARIO PRUEBA');
  assert.equal(mapped.lugarReclusion, 'CPAMS EL BARNE');
  assert.equal(mapped.lugarReclusionOriginal, 'CPAMS EL BARNÉ');
  assert.equal(mapped.centroId, 'INPEC_150');
  assert.equal(mapped.centroHomologado, true);
  assert.equal(mapped.departamentoLugarReclusion, 'BOYACÁ');
  assert.equal(mapped.municipioLugarReclusion, 'CÓMBITA');
  assert.equal(mapped.autoridadCargo, 'JUZGADO PRUEBA');
  assert.equal(mapped.numeroProceso, 'PROCESO-1');
  assert.equal(mapped.situacionJuridica, 'Condenado');
  assert.equal(mapped.defensorAsignado, 'DEFENSOR PRUEBA');
  assert.equal(mapped.defensorId, '123456');
  assert.equal(mapped.fuenteInformacion, 'SISIPEC');
  assert.equal(mapped.fechaCorte, '2026-07-07');
  assert.equal(mapped.totalSituaciones, 2);
  assert.equal(mapped.tieneHistorialActivoInactivo, true);
  assert.equal(mapped.estadoCodigo, 'ENTREVISTAR_USUARIO');
  assert.equal(mapped.estadoEtiqueta, 'Entrevistar al usuario');
  assert.equal(mapped.accionPendiente.codigo, 'REALIZAR_ENTREVISTA');
  assert.equal(mapped.accionPendiente.homologada, false);
  assert.equal(mapped.accionPendiente.valorOriginal, 'Texto histórico distinto');
  assert.equal(mapped['Acción a impulsar'], 'Entrevistar al usuario');
  assert.equal(mapped.categoriaPotencialSubrogado, 'potenciales_beneficiarios');
  assert.equal(mapped.esPotencialSubrogado, true);
  assert.equal(mapped.estadoSource['Resumen del análisis del caso'], 'Resumen cargado');
  assert.equal(mapped['Estado del caso'], 'Entrevistar al usuario');
}

function testInactiveRowsCloseStateAndAction() {
  const mapped = contract.mapRow({ ...activeRawRow(), S_ACTIVO: 0, ESTADO_CODIGO: 'ANALIZAR_CASO' });
  assert.equal(mapped.situacionActiva, false);
  assert.equal(mapped.estadoCodigo, 'CASO_CERRADO');
  assert.equal(mapped.accionImpulsar, 'Caso cerrado');
  assert.equal(mapped['Acción a impulsar'], 'Caso cerrado');
  assert.equal(mapped.accionPendiente.codigo, 'SIN_ACCION_PENDIENTE');
  assert.equal(mapped.accionPendiente.homologada, true);
  assert.equal(mapped.estadoSource['Acción a impulsar'], 'Caso cerrado');
}

function testAllApiFiltersAreParsedAndTrimmed() {
  const keys = [
    'defensor',
    'defensorId',
    'nombre',
    'documento',
    'lugar',
    'centroId',
    'departamento',
    'municipio',
    'estadoAccion',
    'estadoCodigo',
    'estado',
    'accionCodigo',
    'accion',
    'potencialSubrogado',
    'asignacionEstado',
    'incluirFueraPrision',
  ];
  const input = Object.fromEntries(keys.map((key) => [key, `  ${key}  `]));
  input.incluirFueraPrision = 'true';
  const parsed = contract.parseFilters(input);
  assert.deepEqual(Object.keys(parsed), keys);
  keys.filter((key) => key !== 'incluirFueraPrision').forEach((key) => assert.equal(parsed[key], key));
  assert.equal(parsed.incluirFueraPrision, '1');
  assert.equal(contract.hasFilters(parsed), true);
  assert.equal(contract.hasFilters(contract.parseFilters({})), false);
}

function testLegacyInMemoryFiltersRemainNormalized() {
  const mapped = contract.mapRow(activeRawRow());
  assert.equal(
    contract.matchesFilters(mapped, {
      documento: '1000',
      nombre: 'usuario',
      defensor: 'defensor',
      lugar: 'cpams el barne',
      departamento: 'boyaca',
      municipio: 'combita',
      estadoAccion: 'entrevistar',
      estado: 'Entrevistar al usuario',
      potencialSubrogado: 'potenciales_beneficiarios',
    }),
    true
  );
}

function testInactiveRowsRequireExplicitFilter() {
  const inactive = contract.mapRow({ ...activeRawRow(), S_ACTIVO: 0 });
  assert.equal(contract.matchesFilters(inactive, { documento: '1000' }), false);
  assert.equal(
    contract.matchesFilters(inactive, { documento: '1000', incluirFueraPrision: '1' }),
    true
  );
}

function testCenterCatalogPolicyDependsOnBusinessFlow() {
  const rawPlaces = ['CPAMS EL BARNE', 'CPAMS EL BARNÉ', 'CDT MUNICIPAL DE PRUEBA'];
  const condenados = contract.buildCentrosFiltro(rawPlaces, 'condenado');
  const assignedUsers = contract.buildCentrosFiltro(rawPlaces, 'all');

  assert.deepEqual(condenados.map((item) => item.id), ['INPEC_150']);
  assert.equal(condenados[0].valoresOriginales.length, 2);
  assert.equal(assignedUsers.length, 2);
  assert(assignedUsers.some((item) => item.id.startsWith('LEGACY_CENTRO_')));
}

testEveryColumnHasMappedDataContract();
testInactiveRowsCloseStateAndAction();
testAllApiFiltersAreParsedAndTrimmed();
testLegacyInMemoryFiltersRemainNormalized();
testInactiveRowsRequireExplicitFilter();
testCenterCatalogPolicyDependsOnBusinessFlow();
console.log('OK assigned-users-contract.test');
