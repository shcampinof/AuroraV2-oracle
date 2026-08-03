const assert = require('assert/strict');
const pplRouter = require('../routes/ppl');

const contract = pplRouter.condenadosContract;
assert(contract, 'La ruta PPL debe exponer su contrato interno para validación.');

function activeRawRow() {
  return {
    S_ACTIVO: 1,
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
  assert.equal(mapped.estadoReclusion, 'EN PRISIÓN');
  assert.equal(mapped.numeroIdentificacion, '1000123456');
  assert.equal(mapped.nombreUsuario, 'USUARIO PRUEBA');
  assert.equal(mapped.lugarReclusion, 'CPAMS EL BARNE');
  assert.equal(mapped.lugarReclusionOriginal, 'CPAMS EL BARNÉ');
  assert.equal(mapped.centroId, 'CENTRO_CPAMS_EL_BARNE');
  assert.equal(mapped.centroHomologado, true);
  assert.equal(mapped.departamentoLugarReclusion, 'BOYACÁ');
  assert.equal(mapped.municipioLugarReclusion, 'CÓMBITA');
  assert.equal(mapped.autoridadCargo, 'JUZGADO PRUEBA');
  assert.equal(mapped.numeroProceso, 'PROCESO-1');
  assert.equal(mapped.situacionJuridica, 'Condenado');
  assert.equal(mapped.defensorAsignado, 'DEFENSOR PRUEBA');
  assert.equal(mapped.defensorId, '123456');
  assert.equal(mapped.estadoCodigo, 'ENTREVISTAR_USUARIO');
  assert.equal(mapped.estadoEtiqueta, 'Entrevistar al usuario');
  assert.equal(mapped.accionPendiente.codigo, 'REALIZAR_ENTREVISTA');
  assert.equal(mapped.accionPendiente.homologada, false);
  assert.equal(mapped.accionPendiente.valorOriginal, 'Texto histórico distinto');
  assert.equal(mapped.categoriaPotencialSubrogado, 'potenciales_beneficiarios');
  assert.equal(mapped.esPotencialSubrogado, true);
  assert.equal(mapped.estadoSource['Resumen del análisis del caso'], 'Resumen cargado');
  assert.equal(mapped['Estado del caso'], 'Entrevistar al usuario');
}

function testInactiveRowsCloseStateAndAction() {
  const mapped = contract.mapRow({ ...activeRawRow(), S_ACTIVO: 0, ESTADO_CODIGO: 'ANALIZAR_CASO' });
  assert.equal(mapped.situacionActiva, false);
  assert.equal(mapped.estadoReclusion, 'FUERA DE PRISIÓN');
  assert.equal(mapped.estadoCodigo, 'CASO_CERRADO');
  assert.equal(mapped.accionPendiente.codigo, 'SIN_ACCION_PENDIENTE');
  assert.equal(mapped.accionPendiente.homologada, true);
  assert.equal(mapped.estadoSource['Acción a realizar'], 'Persona fuera de prisión — caso cerrado');
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
  ];
  const parsed = contract.parseFilters(Object.fromEntries(keys.map((key) => [key, `  ${key}  `])));
  assert.deepEqual(Object.keys(parsed), keys);
  keys.forEach((key) => assert.equal(parsed[key], key));
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

testEveryColumnHasMappedDataContract();
testInactiveRowsCloseStateAndAction();
testAllApiFiltersAreParsedAndTrimmed();
testLegacyInMemoryFiltersRemainNormalized();
console.log('OK assigned-users-contract.test');
