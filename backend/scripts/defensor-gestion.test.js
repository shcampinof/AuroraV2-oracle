const assert = require('assert/strict');

async function testActuacionesKeepTheirOwnDefensor() {
  const personaRepo = require('../repositories/oracle/personaRepository');
  const servicePath = require.resolve('../services/pplService');
  const originalList = personaRepo.listRowsWithActiveSituacionAndGestiones;

  personaRepo.listRowsWithActiveSituacionAndGestiones = async () => [
    {
      P_ID_PERSONA: 10,
      P_NUMERO: '123',
      P_NOMBRE: 'PPL PRUEBA',
      S_ID_SITUACION: 20,
      S_ACTIVO: 1,
      S_SITUACION: 'Condenado',
      G_ID_GESTION: 30,
      G_DEFENSOR: 'DEFENSOR ACTIVO',
      G_DEFENSOR_GESTION: 'DEFENSOR HISTORICO',
      G_FECHA_REGISTRO: new Date('2026-01-01T00:00:00Z'),
    },
    {
      P_ID_PERSONA: 10,
      P_NUMERO: '123',
      P_NOMBRE: 'PPL PRUEBA',
      S_ID_SITUACION: 20,
      S_ACTIVO: 1,
      S_SITUACION: 'Condenado',
      G_ID_GESTION: 31,
      G_DEFENSOR: 'DEFENSOR ACTIVO',
      G_DEFENSOR_GESTION: 'DEFENSOR ACTIVO',
      G_FECHA_REGISTRO: new Date('2026-02-01T00:00:00Z'),
    },
  ];
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    const actuaciones = await service.getActuacionesByDocumento('123');
    assert.equal(actuaciones.length, 2);
    assert.equal(actuaciones[0].registro.defensorGestion, 'DEFENSOR HISTORICO');
    assert.equal(
      actuaciones[0].registro['Defensor(a) Público(a) Asignado para tramitar la solicitud'],
      'DEFENSOR HISTORICO'
    );
    assert.equal(actuaciones[1].registro.defensorGestion, 'DEFENSOR ACTIVO');
  } finally {
    personaRepo.listRowsWithActiveSituacionAndGestiones = originalList;
    delete require.cache[servicePath];
  }
}

async function testNewActuacionSnapshotsActiveDefensor() {
  const personaRepo = require('../repositories/oracle/personaRepository');
  const gestionRepo = require('../repositories/oracle/gestionRepository');
  const servicePath = require.resolve('../services/pplService');
  const originals = {
    find: personaRepo.findActiveContextByDocumento,
    list: personaRepo.listRowsWithActiveSituacionAndGestiones,
    reconcile: personaRepo.reconcileGestionActionById,
    insert: gestionRepo.insertGestion,
  };
  let insertedFields = null;

  personaRepo.findActiveContextByDocumento = async () => ({
    P_ID_PERSONA: 10,
    S_ID_SITUACION: 20,
    S_ACTIVO: 1,
    G_DEFENSOR: 'DEFENSOR ACTIVO',
  });
  gestionRepo.insertGestion = async (_idSituacion, fields) => {
    insertedFields = fields;
    return 30;
  };
  personaRepo.reconcileGestionActionById = async () => ({ updated: 1 });
  personaRepo.listRowsWithActiveSituacionAndGestiones = async () => [{
    P_ID_PERSONA: 10,
    P_NUMERO: '123',
    S_ID_SITUACION: 20,
    S_ACTIVO: 1,
    S_SITUACION: 'Condenado',
    G_ID_GESTION: 30,
    G_DEFENSOR: 'DEFENSOR ACTIVO',
    G_DEFENSOR_GESTION: 'DEFENSOR ACTIVO',
  }];
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await service.createActuacionByDocumento('123', { data: {} });
    assert.equal(insertedFields.DEFENSOR_GESTION, 'DEFENSOR ACTIVO');
  } finally {
    personaRepo.findActiveContextByDocumento = originals.find;
    personaRepo.listRowsWithActiveSituacionAndGestiones = originals.list;
    personaRepo.reconcileGestionActionById = originals.reconcile;
    gestionRepo.insertGestion = originals.insert;
    delete require.cache[servicePath];
  }
}

async function testNewActuacionUsesNewDefensorWhenReassigned() {
  const personaRepo = require('../repositories/oracle/personaRepository');
  const gestionRepo = require('../repositories/oracle/gestionRepository');
  const asignacionRepo = require('../repositories/oracle/asignacionRepository');
  const defensoresRepo = require('../repositories/oracle/defensoresRepository');
  const servicePath = require.resolve('../services/pplService');
  const originals = {
    find: personaRepo.findActiveContextByDocumento,
    list: personaRepo.listRowsWithActiveSituacionAndGestiones,
    reconcile: personaRepo.reconcileGestionActionById,
    insert: gestionRepo.insertGestion,
    replace: asignacionRepo.replaceActiveAssignmentByPersona,
    findDefensor: defensoresRepo.findUniqueByNombre,
  };
  let insertedFields = null;
  let assignment = null;

  personaRepo.findActiveContextByDocumento = async () => ({
    P_ID_PERSONA: 10,
    S_ID_SITUACION: 20,
    S_ACTIVO: 1,
    G_DEFENSOR: 'DEFENSOR ANTERIOR',
  });
  gestionRepo.insertGestion = async (_idSituacion, fields) => {
    insertedFields = fields;
    return 30;
  };
  asignacionRepo.replaceActiveAssignmentByPersona = async (_idPersona, nextAssignment) => {
    assignment = nextAssignment;
    return 1;
  };
  defensoresRepo.findUniqueByNombre = async () => ({
    cedula: '200',
    nombre: 'DEFENSOR NUEVO',
  });
  personaRepo.reconcileGestionActionById = async () => ({ updated: 1 });
  personaRepo.listRowsWithActiveSituacionAndGestiones = async () => [{
    P_ID_PERSONA: 10,
    P_NUMERO: '123',
    S_ID_SITUACION: 20,
    S_ACTIVO: 1,
    S_SITUACION: 'Condenado',
    G_ID_GESTION: 30,
    G_DEFENSOR: 'DEFENSOR NUEVO',
    G_DEFENSOR_GESTION: 'DEFENSOR NUEVO',
  }];
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await service.createActuacionByDocumento('123', {
      data: {
        'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'DEFENSOR NUEVO',
      },
    });
    assert.equal(insertedFields.DEFENSOR_GESTION, 'DEFENSOR NUEVO');
    assert.equal(assignment.defensorNombre, 'DEFENSOR NUEVO');
    assert.equal(assignment.idSituacion, 20);
  } finally {
    personaRepo.findActiveContextByDocumento = originals.find;
    personaRepo.listRowsWithActiveSituacionAndGestiones = originals.list;
    personaRepo.reconcileGestionActionById = originals.reconcile;
    gestionRepo.insertGestion = originals.insert;
    asignacionRepo.replaceActiveAssignmentByPersona = originals.replace;
    defensoresRepo.findUniqueByNombre = originals.findDefensor;
    delete require.cache[servicePath];
  }
}

async function run() {
  await testActuacionesKeepTheirOwnDefensor();
  await testNewActuacionSnapshotsActiveDefensor();
  await testNewActuacionUsesNewDefensorWhenReassigned();
  console.log('OK defensor-gestion.test');
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { run };
