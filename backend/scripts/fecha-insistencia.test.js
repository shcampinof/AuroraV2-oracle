const assert = require('assert');

async function testFechaInsistenciaRoundTrip() {
  const personaRepo = require('../repositories/oracle/personaRepository');
  const gestionRepo = require('../repositories/oracle/gestionRepository');
  const servicePath = require.resolve('../services/pplService');
  const originals = {
    findActiveContextByDocumento: personaRepo.findActiveContextByDocumento,
    listRowsWithActiveSituacionAndGestiones: personaRepo.listRowsWithActiveSituacionAndGestiones,
    getLatestBySituacion: gestionRepo.getLatestBySituacion,
    getById: gestionRepo.getById,
    updateGestionById: gestionRepo.updateGestionById,
  };
  let writtenFields = null;

  personaRepo.findActiveContextByDocumento = async () => ({
    P_ID_PERSONA: 10,
    S_ID_SITUACION: 20,
    S_ACTIVO: 1,
  });
  gestionRepo.getLatestBySituacion = async () => ({ ID_GESTION: 30 });
  gestionRepo.getById = async () => ({ ID_GESTION: 30, ACCION_REALIZAR: 'Presentar solicitud' });
  gestionRepo.updateGestionById = async (_idGestion, fields) => {
    writtenFields = fields;
    return 1;
  };
  personaRepo.listRowsWithActiveSituacionAndGestiones = async () => [{
    P_ID_PERSONA: 10,
    P_NUMERO: '123',
    S_ID_SITUACION: 20,
    S_ACTIVO: 1,
    S_SITUACION: 'Condenado',
    G_ID_GESTION: 30,
    G_ACCION_REALIZAR: 'Presentar solicitud',
    G_INSISTENCIAS: 5,
    G_FECHA_INSISTENCIA_1: new Date('2026-08-01T00:00:00Z'),
    G_FECHA_INSISTENCIA_2: new Date('2026-08-08T00:00:00Z'),
    G_FECHA_INSISTENCIA_3: new Date('2026-08-15T00:00:00Z'),
    G_FECHA_INSISTENCIA_4: new Date('2026-08-22T00:00:00Z'),
    G_FECHA_INSISTENCIA_5: new Date('2026-08-29T00:00:00Z'),
  }];
  delete require.cache[servicePath];

  try {
    assert(gestionRepo.GESTION_COLUMNS.has('FECHA_INSISTENCIA_1'));
    assert(gestionRepo.GESTION_COLUMNS.has('FECHA_INSISTENCIA_2'));
    assert(gestionRepo.GESTION_COLUMNS.has('INSISTENCIAS'));
    assert(gestionRepo.GESTION_COLUMNS.has('FECHA_INSISTENCIA_3'));
    assert(gestionRepo.GESTION_COLUMNS.has('FECHA_INSISTENCIA_4'));
    assert(gestionRepo.GESTION_COLUMNS.has('FECHA_INSISTENCIA_5'));

    const service = require(servicePath);
    const updated = await service.updateByDocumento('123', {
      data: {
        'Número de insistencias': '5',
        'Fecha de insistencia 1': '2026-08-01',
        'Fecha de insistencia 2': '2026-08-08',
        'Fecha de insistencia 3': '2026-08-15',
        'Fecha de insistencia 4': '2026-08-22',
        'Fecha de insistencia 5': '2026-08-29',
      },
    });

    assert(writtenFields, 'Las fechas de insistencia deben generar una actualización de GESTION_JURIDICA.');
    assert(writtenFields.FECHA_INSISTENCIA_1 instanceof Date);
    assert(writtenFields.FECHA_INSISTENCIA_2 instanceof Date);
    assert.strictEqual(writtenFields.INSISTENCIAS, 5);
    assert(writtenFields.FECHA_INSISTENCIA_3 instanceof Date);
    assert(writtenFields.FECHA_INSISTENCIA_4 instanceof Date);
    assert(writtenFields.FECHA_INSISTENCIA_5 instanceof Date);
    assert.strictEqual(writtenFields.FECHA_INSISTENCIA_1.toISOString().slice(0, 10), '2026-08-01');
    assert.strictEqual(writtenFields.FECHA_INSISTENCIA_2.toISOString().slice(0, 10), '2026-08-08');
    assert.strictEqual(writtenFields.FECHA_INSISTENCIA_3.toISOString().slice(0, 10), '2026-08-15');
    assert.strictEqual(writtenFields.FECHA_INSISTENCIA_4.toISOString().slice(0, 10), '2026-08-22');
    assert.strictEqual(writtenFields.FECHA_INSISTENCIA_5.toISOString().slice(0, 10), '2026-08-29');
    assert.strictEqual(updated['Número de insistencias'], '5');
    assert.strictEqual(updated['Fecha de insistencia 1'], '2026-08-01');
    assert.strictEqual(updated['Fecha de insistencia 2'], '2026-08-08');
    assert.strictEqual(updated['Fecha de insistencia 3'], '2026-08-15');
    assert.strictEqual(updated['Fecha de insistencia 4'], '2026-08-22');
    assert.strictEqual(updated['Fecha de insistencia 5'], '2026-08-29');
  } finally {
    personaRepo.findActiveContextByDocumento = originals.findActiveContextByDocumento;
    personaRepo.listRowsWithActiveSituacionAndGestiones = originals.listRowsWithActiveSituacionAndGestiones;
    gestionRepo.getLatestBySituacion = originals.getLatestBySituacion;
    gestionRepo.getById = originals.getById;
    gestionRepo.updateGestionById = originals.updateGestionById;
    delete require.cache[servicePath];
  }
}

testFechaInsistenciaRoundTrip()
  .then(() => console.log('OK fecha-insistencia.test'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
