const assert = require('assert/strict');
const { hasReachedBlock5 } = require('../domain/gestionEditability');
const personaRepo = require('../repositories/oracle/personaRepository');
const gestionRepo = require('../repositories/oracle/gestionRepository');
const situacionRepo = require('../repositories/oracle/situacionRepository');
const asignacionRepo = require('../repositories/oracle/asignacionRepository');
const calificacionRepo = require('../repositories/oracle/calificacionConductaRepository');
const service = require('../services/pplService');

const analysis = {
  ID_GESTION: 30,
  DEFENSOR_GESTION: 'DEFENSORA ORIGINAL',
  FECHA_ANALISIS: new Date('2026-10-01'),
  RESUMEN_ANALISIS_CASO: 'Análisis completo',
  LIBERTAD_CONDICIONAL: 'Sí cumple',
  PRISION_DOMICILIARIA_MITAD_PENA: 'No',
  PROCEDENCIA_PENA_CUMPLIDA: 'No',
  PROCEDENCIA_ACUMULACION_PENAS: 'No',
  OTRAS_SOLICITUDES_TRAMITAR: 'Ninguna',
};
const reached = {
  ...analysis,
  FECHA_ENTREVISTA: new Date('2026-10-02'),
  DECISION_USUARIO: 'Sí desea avanzar',
  ACTUACION_ADELANTAR: 'Libertad condicional',
  REQUIERE_PRUEBAS: 'No',
  PODER_AVANZAR_SOLICITUD: 'No requiere poder',
};

function testSavedMilestones() {
  assert.equal(hasReachedBlock5({ ID_GESTION: 30, ACCION_REALIZAR: 'Presentar solicitud', INSISTENCIAS: 0 }), false);
  assert.equal(hasReachedBlock5(analysis), false, 'Bloque 3 no habilita la excepción.');
  assert.equal(hasReachedBlock5(reached), true, 'Llegar al bloque 5 no exige haber diligenciado su primer campo.');
  assert.equal(hasReachedBlock5({ ...reached, PODER_AVANZAR_SOLICITUD: '-' }), false);
  assert.equal(hasReachedBlock5({ ...reached, DECISION_USUARIO: 'No desea avanzar' }), false);
  assert.equal(hasReachedBlock5({ ...reached, ACTUACION_ADELANTAR: 'Ninguna' }), false);
  assert.equal(hasReachedBlock5({ ...reached, LIBERTAD_CONDICIONAL: 'No' }), false);
  assert.equal(hasReachedBlock5({ ...reached, LIBERTAD_CONDICIONAL: 'No', OTRAS_SOLICITUDES_TRAMITAR: '["Otra solicitud"]' }), true);
  assert.equal(hasReachedBlock5({ ...reached, OTRAS_SOLICITUDES_TRAMITAR: 'MÁS DE UNA OPCIÓN' }), false);
  assert.equal(hasReachedBlock5({ ...reached, OTRAS_SOLICITUDES_TRAMITAR: 'MÁS DE UNA OPCIÓN | Redención' }), true);
  for (const fields of [
    { FECHA_SOLICITUD_DOCS_INPEC: new Date('2026-10-02') },
    { FECHA_ENTREVISTA_PSICOSOCIAL: new Date('2026-10-02') },
    { CUMPLE_REQUISITO_MARGINALIDAD: 'No' },
    { FECHA_PRESENTACION_RECURSO: new Date('2026-10-02') },
    { INSISTENCIAS: 1 },
  ]) {
    assert.equal(hasReachedBlock5({ ...analysis, ACTUACION_ADELANTAR: 'Libertad condicional', ...fields }), true, 'Los hitos históricos prueban el avance.');
    assert.equal(hasReachedBlock5(fields), false, 'La excepción exige una gestión existente.');
  }
  assert.equal(hasReachedBlock5({ ID_GESTION: 30, FECHA_PRESENTACION_RECURSO: '--' }), false);
  assert.equal(hasReachedBlock5({ ...analysis, FECHA_ANALISIS: '', ACTUACION_ADELANTAR: 'Libertad condicional', SENTIDO_DECISION: 'Concede la solicitud' }), false,
    'Los campos residuales de bloque 5 con análisis incompleto no habilitan la edición.');
  const celeste = { ...analysis, FECHA_ENTREVISTA: '2026-10-02', ACTUACION_ADELANTAR: 'Solicitar revocatoria' };
  assert.equal(hasReachedBlock5(celeste, 'sindicado'), true);
  assert.equal(hasReachedBlock5({ ...celeste, FECHA_ENTREVISTA: '' }, 'sindicado'), false);
  assert.equal(hasReachedBlock5({ ...celeste, ACTUACION_ADELANTAR: 'No se avanzará con el trámite' }, 'sindicado'), false);
  assert.equal(hasReachedBlock5({ ...celeste, FECHA_ENTREVISTA: '', FECHA_REALIZACION_AUDIENCIA: '2026-10-02' }, 'sindicado'), true);
}

async function testService() {
  const originals = [];
  const mock = (repo, method, implementation) => {
    const original = repo[method];
    originals.push(() => { repo[method] = original; });
    repo[method] = implementation;
  };
  let stored = { ...reached };
  let active = 0;
  let tipo = 'Condenado';
  let missing = false;
  let affected = 1;
  const writes = [];
  const context = () => ({
    P_ID_PERSONA: 10, P_NUMERO: '123', S_ID_SITUACION: 20, S_ACTIVO: active,
    S_SITUACION: tipo, G_ID_GESTION: 30, G_DEFENSOR: 'OTRO DEFENSOR ASIGNADO',
    // Una gestión anterior no debe heredar estos hitos de la fila de contexto.
    G_FECHA_PRESENTACION_SOLICITUD_AUTORIDAD: '2026-10-02',
  });
  mock(personaRepo, 'findActiveContextByDocumento', async () => context());
  mock(personaRepo, 'listRowsWithActiveSituacionAndGestiones', async () => [{
    ...context(),
    ...Object.fromEntries(Object.entries(stored).map(([key, value]) => [`G_${key}`, value])),
  }]);
  mock(personaRepo, 'reconcileGestionActionById', async (id) => { writes.push(['reconcile', id]); });
  mock(gestionRepo, 'getById', async (id, situacion) => {
    assert.equal(situacion, 20);
    return missing || id !== 30 ? null : stored;
  });
  mock(gestionRepo, 'getLatestBySituacion', async () => stored);
  mock(gestionRepo, 'updateGestionById', async (id, fields, situacion) => {
    writes.push(['gestion', id, fields, situacion]);
    if (affected) stored = { ...stored, ...fields };
    return affected;
  });
  for (const [repo, method] of [
    [gestionRepo, 'insertGestion'], [personaRepo, 'updatePersonaById'],
    [situacionRepo, 'updateSituacionById'], [calificacionRepo, 'upsertBySituacion'],
    [asignacionRepo, 'replaceActiveAssignmentByPersona'], [asignacionRepo, 'endActiveAssignmentByPersona'],
  ]) {
    mock(repo, method, async () => { throw new Error(`Escritura no esperada: ${method}`); });
  }
  const denied = async (payload, code = 'PPL_SITUACION_INACTIVA') => {
    writes.length = 0;
    await assert.rejects(() => service.updateByDocumento('123', payload), (e) => e.code === code && e.status === 409);
    assert.equal(writes.length, 0, 'El rechazo debe ocurrir antes de cualquier escritura.');
  };
  try {
    for (const target of [{ rowIndex: 30 }, { actuacionId: '123-30' }, {}]) {
      writes.length = 0;
      const result = await service.updateByDocumento('123', { ...target, data: {
        'Fecha de presentación de la solicitud a la autoridad': '2026-10-03',
        'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'DEFENSORA ORIGINAL',
        'Estado del caso': 'Activo', '__situacionActiva': true,
      } });
      assert.equal(result.estadoCodigo, 'CASO_CERRADO');
      assert.equal(result.__situacionActiva, false);
      assert.equal(result.__bloque5Alcanzado, true);
      assert.equal(result.defensorGestion, 'DEFENSORA ORIGINAL');
      assert.deepEqual(writes.map((entry) => entry[0]), ['gestion', 'reconcile']);
      assert.equal(writes[0][1], 30);
      assert.equal(writes[0][3], 20);
    }
    await denied({ rowIndex: 30, data: { Defensor: 'OTRO DEFENSOR ASIGNADO' } });
    await denied({ rowIndex: 30, data: { __desasignarDefensor: true } });
    stored = { ...analysis };
    await denied({ rowIndex: 30, data: {
      'Fecha de presentación de la solicitud a la autoridad': '2026-10-03',
      __bloque5Alcanzado: true,
    } });
    await denied({ data: {} });
    stored = { ...reached };
    missing = true;
    await denied({ rowIndex: 30, data: {} }, 'PPL_GESTION_MISMATCH');
    missing = false;
    affected = 0;
    writes.length = 0;
    // Si la fila desaparece entre la lectura y el UPDATE, nunca insertar otra.
    await assert.rejects(() => service.updateByDocumento('123', {
      rowIndex: 30, data: { 'Resumen del análisis del caso': 'Cambio' },
    }), (e) => e.code === 'PPL_GESTION_MISMATCH');
    assert.deepEqual(writes.map((entry) => entry[0]), ['gestion']);
    affected = 1;
    tipo = 'Sindicado';
    stored = { ...analysis, ACTUACION_ADELANTAR: 'Solicitar revocatoria', FECHA_REALIZACION_AUDIENCIA: new Date('2026-10-02') };
    const celeste = await service.updateByDocumento('123', { rowIndex: 30, data: { 'Sentido de la decisión': 'Revoca' } });
    assert.equal(celeste.__bloque5Alcanzado, true);
    assert.equal(celeste.estadoCodigo, 'CASO_CERRADO');
    await assert.rejects(() => service.createActuacionByDocumento('123', { data: {} }), (e) => e.code === 'PPL_SITUACION_INACTIVA');
    active = 1;
    stored = { ...analysis };
    const open = await service.updateByDocumento('123', { rowIndex: 30, data: { 'Resumen del análisis del caso': 'Avance' } });
    assert.equal(open.__situacionActiva, true, 'Los casos activos conservan su edición sin llegar al bloque 5.');
  } finally {
    originals.reverse().forEach((restore) => restore());
  }
}

(async () => {
  testSavedMilestones();
  await testService();
  console.log('gestion-editability: OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
