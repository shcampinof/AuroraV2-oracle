const assert = require('assert');

async function testRepositoryUsesDatabaseClock() {
  const oraclePoolPath = require.resolve('../db/oraclePool');
  const repositoryPath = require.resolve('../repositories/oracle/asignacionRepository');
  const oraclePool = require(oraclePoolPath);
  const originalExecute = oraclePool.execute;
  let captured = null;

  oraclePool.execute = async (sql, binds, options) => {
    captured = { sql, binds, options };
    return { rowsAffected: 1 };
  };
  delete require.cache[repositoryPath];

  try {
    const repository = require(repositoryPath);
    await repository.replaceActiveAssignmentByPersona(10, {
      defensorNombre: 'DEFENSOR PRUEBA',
      defensorCedula: '20',
      pagCedula: '30',
      pagNombre: 'PAG PRUEBA',
      fechaAsignacion: new Date('2000-01-01T00:00:00Z'),
    });

    assert(captured, 'La operación de asignación debe ejecutar SQL.');
    assert.match(captured.sql, /SET FECHA_FIN = SYSDATE/);
    assert.match(captured.sql, /ID_ASIGNACION/);
    assert.match(captured.sql, /DNDP\.SEQ_ASIGNACION\.NEXTVAL/);
    assert.match(captured.sql, /:nombrePag,\s*SYSDATE\s*\)/);
    assert(!Object.prototype.hasOwnProperty.call(captured.binds, 'fechaAsignacion'));
    assert.strictEqual(captured.options.autoCommit, true);
  } finally {
    oraclePool.execute = originalExecute;
    delete require.cache[repositoryPath];
  }
}

async function testGenericDefenderChangeCreatesFreshAssignment() {
  const personaRepo = require('../repositories/oracle/personaRepository');
  const gestionRepo = require('../repositories/oracle/gestionRepository');
  const asignacionRepo = require('../repositories/oracle/asignacionRepository');
  const servicePath = require.resolve('../services/pplService');

  const originals = {
    findActiveContextByDocumento: personaRepo.findActiveContextByDocumento,
    listRowsWithActiveSituacionAndGestiones: personaRepo.listRowsWithActiveSituacionAndGestiones,
    getLatestBySituacion: gestionRepo.getLatestBySituacion,
    replaceActiveAssignmentByPersona: asignacionRepo.replaceActiveAssignmentByPersona,
  };
  const assignmentWrites = [];

  personaRepo.findActiveContextByDocumento = async () => ({
    P_ID_PERSONA: 10,
    S_ID_SITUACION: 20,
    S_ACTIVO: 1,
    G_DEFENSOR: 'DEFENSOR ACTUAL',
  });
  personaRepo.listRowsWithActiveSituacionAndGestiones = async () => [
    {
      P_ID_PERSONA: 10,
      P_NUMERO: '123',
      S_ID_SITUACION: 20,
      S_SITUACION: 'Condenado',
      G_ID_GESTION: 30,
      G_DEFENSOR: 'DEFENSOR ACTUAL',
    },
  ];
  gestionRepo.getLatestBySituacion = async () => ({ ID_GESTION: 30 });
  asignacionRepo.replaceActiveAssignmentByPersona = async (idPersona, assignment) => {
    assignmentWrites.push({ idPersona, assignment });
    return 1;
  };
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    const updated = await service.updateByDocumento('123', {
      data: {
        'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'DEFENSOR DISTINTO',
        'Fecha de asignación del PAG': '2000-01-01',
      },
    });

    assert(updated, 'La actualización general debe seguir respondiendo con el registro actual.');
    assert.strictEqual(assignmentWrites.length, 1, 'Un defensor distinto debe crear una nueva asignación.');
    assert.strictEqual(assignmentWrites[0].idPersona, 10);
    assert.strictEqual(assignmentWrites[0].assignment.defensorNombre, 'DEFENSOR DISTINTO');
    assert(!Object.prototype.hasOwnProperty.call(assignmentWrites[0].assignment, 'fechaAsignacion'));
    assert.strictEqual(updated.defensorAsignado, 'DEFENSOR ACTUAL');

    await service.updateByDocumento('123', {
      data: {
        'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'DEFENSOR ACTUAL',
        'Fecha de asignación del PAG': '2000-01-01',
      },
    });
    assert.strictEqual(assignmentWrites.length, 1, 'El mismo defensor no debe renovar la fecha de asignación.');
  } finally {
    personaRepo.findActiveContextByDocumento = originals.findActiveContextByDocumento;
    personaRepo.listRowsWithActiveSituacionAndGestiones = originals.listRowsWithActiveSituacionAndGestiones;
    gestionRepo.getLatestBySituacion = originals.getLatestBySituacion;
    asignacionRepo.replaceActiveAssignmentByPersona = originals.replaceActiveAssignmentByPersona;
    delete require.cache[servicePath];
  }
}

async function testInactivePrisonRecordRejectsUpdates() {
  const personaRepo = require('../repositories/oracle/personaRepository');
  const servicePath = require.resolve('../services/pplService');
  const originalFindContext = personaRepo.findActiveContextByDocumento;

  personaRepo.findActiveContextByDocumento = async () => ({
    P_ID_PERSONA: 10,
    S_ID_SITUACION: 20,
    S_ACTIVO: 0,
  });
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await assert.rejects(
      () => service.updateByDocumento('123', { data: {} }),
      (error) => error?.code === 'PPL_SITUACION_INACTIVA' && error?.status === 409
    );
    await assert.rejects(
      () => service.createActuacionByDocumento('123', { data: {} }),
      (error) => error?.code === 'PPL_SITUACION_INACTIVA' && error?.status === 409
    );
  } finally {
    personaRepo.findActiveContextByDocumento = originalFindContext;
    delete require.cache[servicePath];
  }
}

async function testNewActuacionAlwaysPersistsCanonicalAction() {
  const personaRepo = require('../repositories/oracle/personaRepository');
  const gestionRepo = require('../repositories/oracle/gestionRepository');
  const servicePath = require.resolve('../services/pplService');
  const originals = {
    findActiveContextByDocumento: personaRepo.findActiveContextByDocumento,
    listRowsWithActiveSituacionAndGestiones: personaRepo.listRowsWithActiveSituacionAndGestiones,
    insertGestion: gestionRepo.insertGestion,
  };
  const writes = [];

  personaRepo.findActiveContextByDocumento = async () => ({
    P_ID_PERSONA: 10,
    S_ID_SITUACION: 20,
    S_ACTIVO: 1,
  });
  personaRepo.listRowsWithActiveSituacionAndGestiones = async () => [{
    P_ID_PERSONA: 10,
    P_NUMERO: '123',
    S_ID_SITUACION: 20,
    S_ACTIVO: 1,
    S_SITUACION: 'Condenado',
    G_ID_GESTION: 31,
    G_ACCION_REALIZAR: 'Presentar solicitud',
  }];
  gestionRepo.insertGestion = async (idSituacion, fields) => {
    writes.push({ idSituacion, fields });
    return 31;
  };
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await service.createActuacionByDocumento('123', {
      data: {
        'Acción a realizar': 'Valor legado que no debe prevalecer',
        'Acción a impulsar': 'Presentar solicitud',
      },
    });
    assert.strictEqual(writes[0].fields.ACCION_REALIZAR, 'Presentar solicitud');

    await service.createActuacionByDocumento('123', { data: {} });
    assert.strictEqual(writes[1].fields.ACCION_REALIZAR, 'Analizar el caso');
  } finally {
    personaRepo.findActiveContextByDocumento = originals.findActiveContextByDocumento;
    personaRepo.listRowsWithActiveSituacionAndGestiones = originals.listRowsWithActiveSituacionAndGestiones;
    gestionRepo.insertGestion = originals.insertGestion;
    delete require.cache[servicePath];
  }
}

function testUpdatedLegalSituationHasPriority() {
  const service = require('../services/pplService');
  assert.strictEqual(
    service.computeTipo({
      'Situación Jurídica': 'Sindicado',
      'Situación Jurídica actualizada (de conformidad con la rama judicial)': 'Condenado',
    }),
    'condenado'
  );
  assert.strictEqual(
    service.computeTipo({
      'Situación Jurídica': 'Condenado',
      'Situación Jurídica actualizada (de conformidad con la rama judicial)': 'Sindicado',
    }),
    'sindicado'
  );
}

(async () => {
  await testRepositoryUsesDatabaseClock();
  await testGenericDefenderChangeCreatesFreshAssignment();
  await testInactivePrisonRecordRejectsUpdates();
  await testNewActuacionAlwaysPersistsCanonicalAction();
  testUpdatedLegalSituationHasPriority();
  console.log('OK asignacion-safety.test');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
