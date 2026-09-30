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

async function testGestionUpdateIsScopedToSituation() {
  const oraclePoolPath = require.resolve('../db/oraclePool');
  const repositoryPath = require.resolve('../repositories/oracle/gestionRepository');
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
    await repository.updateGestionById(77, { RESUMEN_ANALISIS_CASO: 'Resumen' }, 20);
    assert.match(captured.sql, /WHERE ID_GESTION = :idGestion\s+AND ID_SITUACION = :idSituacion/);
    assert.strictEqual(captured.binds.idGestion, 77);
    assert.strictEqual(captured.binds.idSituacion, 20);
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
  const defensoresRepo = require('../repositories/oracle/defensoresRepository');
  const servicePath = require.resolve('../services/pplService');

  const originals = {
    findActiveContextByDocumento: personaRepo.findActiveContextByDocumento,
    listRowsWithActiveSituacionAndGestiones: personaRepo.listRowsWithActiveSituacionAndGestiones,
    reconcileGestionActionById: personaRepo.reconcileGestionActionById,
    updatePersonaById: personaRepo.updatePersonaById,
    getLatestBySituacion: gestionRepo.getLatestBySituacion,
    replaceActiveAssignmentByPersona: asignacionRepo.replaceActiveAssignmentByPersona,
    endActiveAssignmentByPersona: asignacionRepo.endActiveAssignmentByPersona,
    findUniqueByNombre: defensoresRepo.findUniqueByNombre,
  };
  const assignmentWrites = [];
  const assignmentEnds = [];
  const personaWrites = [];

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
  personaRepo.reconcileGestionActionById = async () => ({ updated: 1 });
  personaRepo.updatePersonaById = async (...args) => {
    personaWrites.push(args);
    return 1;
  };
  gestionRepo.getLatestBySituacion = async () => ({ ID_GESTION: 30 });
  asignacionRepo.replaceActiveAssignmentByPersona = async (idPersona, assignment) => {
    assignmentWrites.push({ idPersona, assignment });
    return 1;
  };
  asignacionRepo.endActiveAssignmentByPersona = async (idPersona) => {
    assignmentEnds.push(idPersona);
    return 1;
  };
  defensoresRepo.findUniqueByNombre = async (nombre) => (
    String(nombre || '').trim() === 'DEFENSOR DISTINTO'
      ? { cedula: '20', nombre: 'DEFENSOR DISTINTO' }
      : null
  );
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
    assert.strictEqual(assignmentWrites[0].assignment.defensorCedula, '20');
    assert(!Object.prototype.hasOwnProperty.call(assignmentWrites[0].assignment, 'fechaAsignacion'));
    assert.strictEqual(updated.defensorAsignado, 'DEFENSOR ACTUAL');

    await service.updateByDocumento('123', {
      data: {
        'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'DEFENSOR ACTUAL',
        'Fecha de asignación del PAG': '2000-01-01',
      },
    });
    assert.strictEqual(assignmentWrites.length, 1, 'El mismo defensor no debe renovar la fecha de asignación.');

    await assert.rejects(
      () => service.updateByDocumento('123', {
        data: {
          Nombre: 'NO DEBE ESCRIBIRSE',
          'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'NOMBRE INVENTADO',
        },
      }),
      (error) => error?.code === 'DEFENSOR_NOT_IN_CATALOG' && error?.status === 400
    );
    assert.strictEqual(assignmentWrites.length, 1, 'Un nombre fuera del catálogo no debe crear asignaciones.');
    assert.strictEqual(personaWrites.length, 0, 'Un defensor inválido debe rechazarse antes de modificar PERSONA.');

    await service.updateByDocumento('123', {
      data: {
        'Defensor(a) Público(a) Asignado para tramitar la solicitud': '',
        __desasignarDefensor: true,
      },
    });
    assert.deepStrictEqual(assignmentEnds, [10], 'La señal explícita debe cerrar la asignación activa.');
    assert.strictEqual(assignmentWrites.length, 1, 'Desasignar no debe crear una asignación nueva.');
  } finally {
    personaRepo.findActiveContextByDocumento = originals.findActiveContextByDocumento;
    personaRepo.listRowsWithActiveSituacionAndGestiones = originals.listRowsWithActiveSituacionAndGestiones;
    personaRepo.reconcileGestionActionById = originals.reconcileGestionActionById;
    personaRepo.updatePersonaById = originals.updatePersonaById;
    gestionRepo.getLatestBySituacion = originals.getLatestBySituacion;
    asignacionRepo.replaceActiveAssignmentByPersona = originals.replaceActiveAssignmentByPersona;
    asignacionRepo.endActiveAssignmentByPersona = originals.endActiveAssignmentByPersona;
    defensoresRepo.findUniqueByNombre = originals.findUniqueByNombre;
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

async function testBulkUnassignmentClosesOnlyEligibleActiveAssignments() {
  const personaRepo = require('../repositories/oracle/personaRepository');
  const asignacionRepo = require('../repositories/oracle/asignacionRepository');
  const servicePath = require.resolve('../services/pplService');
  const originalFindContext = personaRepo.findActiveContextByDocumento;
  const originalEndAssignment = asignacionRepo.endActiveAssignmentByPersona;
  const endedAssignments = [];

  personaRepo.findActiveContextByDocumento = async (documento) => ({
    111: { P_ID_PERSONA: 10, S_ID_SITUACION: 20, S_ACTIVO: 1 },
    222: { P_ID_PERSONA: 11, S_ID_SITUACION: 21, S_ACTIVO: 0 },
    333: { P_ID_PERSONA: 12, S_ID_SITUACION: null, S_ACTIVO: 1 },
  }[documento] || null);
  asignacionRepo.endActiveAssignmentByPersona = async (idPersona) => {
    endedAssignments.push(idPersona);
    return 1;
  };
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    const updated = await service.unassignDefensor(['111', '111', '222', '333', '']);

    assert.strictEqual(updated, 1);
    assert.deepStrictEqual(
      endedAssignments,
      [10],
      'Solo debe cerrarse la asignación de una persona con situación activa.'
    );
  } finally {
    personaRepo.findActiveContextByDocumento = originalFindContext;
    asignacionRepo.endActiveAssignmentByPersona = originalEndAssignment;
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
    reconcileGestionActionById: personaRepo.reconcileGestionActionById,
    insertGestion: gestionRepo.insertGestion,
  };
  const writes = [];
  const reconciled = [];

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
  personaRepo.reconcileGestionActionById = async (idGestion) => {
    reconciled.push(idGestion);
    return { updated: 1 };
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
    assert(!Object.prototype.hasOwnProperty.call(writes[0].fields, 'ACCION_REALIZAR'));

    await service.createActuacionByDocumento('123', { data: {} });
    assert(!Object.prototype.hasOwnProperty.call(writes[1].fields, 'ACCION_REALIZAR'));
    assert.deepStrictEqual(reconciled, [31, 31]);
  } finally {
    personaRepo.findActiveContextByDocumento = originals.findActiveContextByDocumento;
    personaRepo.listRowsWithActiveSituacionAndGestiones = originals.listRowsWithActiveSituacionAndGestiones;
    personaRepo.reconcileGestionActionById = originals.reconcileGestionActionById;
    gestionRepo.insertGestion = originals.insertGestion;
    delete require.cache[servicePath];
  }
}

async function testBothBlock5VariantsPersistEveryFieldInOneSave() {
  const personaRepo = require('../repositories/oracle/personaRepository');
  const gestionRepo = require('../repositories/oracle/gestionRepository');
  const servicePath = require.resolve('../services/pplService');
  const originals = {
    findActiveContextByDocumento: personaRepo.findActiveContextByDocumento,
    listRowsWithActiveSituacionAndGestiones: personaRepo.listRowsWithActiveSituacionAndGestiones,
    reconcileGestionActionById: personaRepo.reconcileGestionActionById,
    getById: gestionRepo.getById,
    updateGestionById: gestionRepo.updateGestionById,
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
    G_ID_GESTION: 77,
  }];
  personaRepo.reconcileGestionActionById = async () => ({ updated: 1 });
  gestionRepo.getById = async (idGestion, idSituacion) => (
    Number(idGestion) === 77 && Number(idSituacion) === 20 ? { ID_GESTION: 77, ID_SITUACION: 20 } : null
  );
  gestionRepo.updateGestionById = async (idGestion, fields, idSituacion) => {
    writes.push({ idGestion, fields, idSituacion });
    return 1;
  };
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await service.updateByDocumento('123', {
      actuacionId: '123-77',
      data: {
        'Fecha de entrevista psicosocial': '2026-09-10',
        'Cumple el requisito de marginalidad': 'Sí',
        'Cumple el requisito de jefatura de hogar': 'Sí',
        'Se requiere misión de trabajo': 'Sí',
        'Fecha de solicitud de misión de trabajo': '2026-09-11',
        'Fecha de asignación de investigador': '2026-09-12',
        'Fecha en la que se reciben todas las pruebas': '2026-09-13',
        'Fecha de radicación de solicitud de utilidad pública': '2026-09-14',
        'Fecha de decisión de la autoridad': '',
        'Sentido de la decisión': '',
        'Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad pública':
          'Caso cerrado: en las preguntas 30 a 34 no se marcó procedencia para la solicitud.',
      },
    });

    const utilidad = writes[0].fields;
    assert.strictEqual(writes[0].idGestion, 77);
    assert.strictEqual(writes[0].idSituacion, 20);
    assert(utilidad.FECHA_ENTREVISTA_PSICOSOCIAL instanceof Date);
    assert.strictEqual(utilidad.CUMPLE_REQUISITO_MARGINALIDAD, 'Sí');
    assert.strictEqual(utilidad.CUMPLE_REQUISITO_JEFATURA_HOGAR, 'Sí');
    assert.strictEqual(utilidad.REQUIERE_MISION_TRABAJO, 'Sí');
    assert(utilidad.FECHA_SOLICITUD_MISION_TRABAJO instanceof Date);
    assert(utilidad.FECHA_ASIGNACION_INVESTIGADOR instanceof Date);
    assert(utilidad.FECHA_RECEPCION_TODAS_PRUEBAS instanceof Date);
    assert(utilidad.FECHA_RADICACION_UTILIDAD instanceof Date);
    assert.strictEqual(utilidad.CIERRE_CASO, null, 'Un cierre automático legado debe limpiarse.');

    await service.updateByDocumento('123', {
      actuacionId: '123-77',
      data: {
        'Fecha de recepción de pruebas aportadas por el usuario (si aplica)': '2026-09-10',
        'Fecha de solicitud de documentos al Inpec (si aplica)': '2026-09-11',
        'Fecha de presentación de la solicitud a la autoridad': '2026-09-12',
        'Número de insistencias': '2',
        'Fecha de insistencia 1': '2026-09-13',
        'Fecha de insistencia 2': '2026-09-14',
        'Fecha de decisión de la autoridad': '',
        'Sentido de la decisión': '',
      },
    });

    const normal = writes[1].fields;
    assert(normal.FECHA_RECEPCION_PRUEBAS_USUARIO instanceof Date);
    assert(normal.FECHA_SOLICITUD_DOCS_INPEC instanceof Date);
    assert(normal.FECHA_PRESENTACION_SOLICITUD_AUTORIDAD instanceof Date);
    assert.strictEqual(normal.INSISTENCIAS, 2);
    assert(normal.FECHA_INSISTENCIA_1 instanceof Date);
    assert(normal.FECHA_INSISTENCIA_2 instanceof Date);

    await service.updateByDocumento('123', {
      actuacionId: '123-77',
      data: {
        'Cierre del caso por imposibilidad de avanzar (si aplica)': 'Otro motivo.',
      },
    });
    assert.strictEqual(writes[2].fields.CIERRE_CASO, 'Otro motivo.');
  } finally {
    personaRepo.findActiveContextByDocumento = originals.findActiveContextByDocumento;
    personaRepo.listRowsWithActiveSituacionAndGestiones = originals.listRowsWithActiveSituacionAndGestiones;
    personaRepo.reconcileGestionActionById = originals.reconcileGestionActionById;
    gestionRepo.getById = originals.getById;
    gestionRepo.updateGestionById = originals.updateGestionById;
    delete require.cache[servicePath];
  }
}

async function testExplicitGestionMustBelongToCurrentSituationBeforeWriting() {
  const personaRepo = require('../repositories/oracle/personaRepository');
  const situacionRepo = require('../repositories/oracle/situacionRepository');
  const gestionRepo = require('../repositories/oracle/gestionRepository');
  const servicePath = require.resolve('../services/pplService');
  const originals = {
    findActiveContextByDocumento: personaRepo.findActiveContextByDocumento,
    updatePersonaById: personaRepo.updatePersonaById,
    updateSituacionById: situacionRepo.updateSituacionById,
    getById: gestionRepo.getById,
    updateGestionById: gestionRepo.updateGestionById,
  };
  const writes = [];

  personaRepo.findActiveContextByDocumento = async () => ({
    P_ID_PERSONA: 10,
    S_ID_SITUACION: 20,
    S_ACTIVO: 1,
  });
  personaRepo.updatePersonaById = async (...args) => writes.push(['persona', ...args]);
  situacionRepo.updateSituacionById = async (...args) => writes.push(['situacion', ...args]);
  gestionRepo.getById = async (idGestion, idSituacion) => {
    assert.strictEqual(idGestion, 999);
    assert.strictEqual(idSituacion, 20);
    return null;
  };
  gestionRepo.updateGestionById = async (...args) => writes.push(['gestion', ...args]);
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await assert.rejects(
      () => service.updateByDocumento('123', {
        rowIndex: 999,
        data: {
          Nombre: 'NO DEBE ESCRIBIRSE',
          'Fecha de análisis jurídico del caso': '2026-09-30',
        },
      }),
      (error) => error?.code === 'PPL_GESTION_MISMATCH' && error?.status === 409
    );
    assert.deepStrictEqual(writes, [], 'Una actuación ajena debe rechazarse antes de cualquier escritura.');
  } finally {
    personaRepo.findActiveContextByDocumento = originals.findActiveContextByDocumento;
    personaRepo.updatePersonaById = originals.updatePersonaById;
    situacionRepo.updateSituacionById = originals.updateSituacionById;
    gestionRepo.getById = originals.getById;
    gestionRepo.updateGestionById = originals.updateGestionById;
    delete require.cache[servicePath];
  }
}

async function testApiAlwaysExposesOracleDerivedStateAsAction() {
  const personaRepo = require('../repositories/oracle/personaRepository');
  const servicePath = require.resolve('../services/pplService');
  const originalList = personaRepo.listRowsWithActiveSituacionAndGestiones;
  personaRepo.listRowsWithActiveSituacionAndGestiones = async () => [{
    P_NUMERO: '123',
    S_ACTIVO: 1,
    S_SITUACION: 'Condenado',
    G_ID_GESTION: 77,
    G_ACCION_REALIZAR: 'Caso cerrado',
    ESTADO_CODIGO: 'PENDIENTE_DECISION',
  }];
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    const record = await service.getByDocumento('123');
    assert.strictEqual(record['Estado del trámite'], 'Pendiente de decisión');
    assert.strictEqual(record['Acción a impulsar'], 'Pendiente de decisión');
    assert.strictEqual(record['Acción a realizar'], 'Pendiente de decisión');
  } finally {
    personaRepo.listRowsWithActiveSituacionAndGestiones = originalList;
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
  for (const field of [
    'Procedencia de utilidad pública (solo para mujeres)',
    'Procedencia de libertad condicional',
    'Procedencia de prisión domiciliaria de mitad de pena',
    'Procedencia de pena cumplida',
    'Procedencia de acumulación de penas',
  ]) {
    assert.strictEqual(service.computeTipo({ [field]: 'No aplica porque ya hay solicitud en trámite' }), 'condenado');
  }
  assert.strictEqual(
    service.computeTipo({
      'Situación Jurídica': 'Sindicado',
      'Procedencia de utilidad pública (solo para mujeres)': 'Sí cumple requisitos objetivos',
    }),
    'sindicado'
  );
  assert.strictEqual(service.computeTipo({}), 'sindicado');
  assert.strictEqual(service.computeTipo({ 'Procedencia de utilidad pública (solo para mujeres)': '-' }), 'sindicado');
  assert.strictEqual(service.computeTipo({ 'Procedencia de libertad condicional': '—' }), 'sindicado');
  for (const placeholder of ['', '--', ' null ', 'undefined', 'Sin información']) {
    assert.strictEqual(
      service.computeTipo({ 'Procedencia de utilidad pública (solo para mujeres)': placeholder }),
      'sindicado'
    );
  }
}

function testNewDefenderNameIsUppercaseAndAccentFree() {
  const defensoresRepo = require('../repositories/oracle/defensoresRepository');
  assert.strictEqual(
    defensoresRepo.normalizeNombre('  María José   Muñoz  '),
    'MARIA JOSE MUNOZ'
  );
}

(async () => {
  await testRepositoryUsesDatabaseClock();
  await testGestionUpdateIsScopedToSituation();
  await testGenericDefenderChangeCreatesFreshAssignment();
  await testInactivePrisonRecordRejectsUpdates();
  await testBulkUnassignmentClosesOnlyEligibleActiveAssignments();
  await testNewActuacionAlwaysPersistsCanonicalAction();
  await testBothBlock5VariantsPersistEveryFieldInOneSave();
  await testExplicitGestionMustBelongToCurrentSituationBeforeWriting();
  await testApiAlwaysExposesOracleDerivedStateAsAction();
  testUpdatedLegalSituationHasPriority();
  testNewDefenderNameIsUppercaseAndAccentFree();
  console.log('OK asignacion-safety.test');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
