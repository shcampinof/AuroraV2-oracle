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
    G_FECHA_INSISTENCIA_1: new Date('2026-08-01T00:00:00Z'),
    G_FECHA_INSISTENCIA_2: new Date('2026-08-08T00:00:00Z'),
  }];
  delete require.cache[servicePath];

  try {
    assert(gestionRepo.GESTION_COLUMNS.has('FECHA_INSISTENCIA_1'));
    assert(gestionRepo.GESTION_COLUMNS.has('FECHA_INSISTENCIA_2'));

    const service = require(servicePath);
    const updated = await service.updateByDocumento('123', {
      data: {
        'Fecha de insistencia 1': '2026-08-01',
        'Fecha de insistencia 2': '2026-08-08',
      },
    });

    assert(writtenFields, 'Las fechas de insistencia deben generar una actualización de GESTION_JURIDICA.');
    assert(writtenFields.FECHA_INSISTENCIA_1 instanceof Date);
    assert(writtenFields.FECHA_INSISTENCIA_2 instanceof Date);
    assert.strictEqual(writtenFields.FECHA_INSISTENCIA_1.toISOString().slice(0, 10), '2026-08-01');
    assert.strictEqual(writtenFields.FECHA_INSISTENCIA_2.toISOString().slice(0, 10), '2026-08-08');
    assert.strictEqual(updated['Fecha de insistencia 1'], '2026-08-01');
    assert.strictEqual(updated['Fecha de insistencia 2'], '2026-08-08');
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
