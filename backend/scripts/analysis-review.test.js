const assert = require('assert/strict');
const { requiresAnalysisReview, nextAnalysisDate, applyAnalysisReview } = require('../domain/analysisReview');
const { closures } = require('../domain/auroraCaseClosures');

const closed = {
  ID_GESTION: 30, FECHA_ANALISIS: new Date('2026-05-20T00:00:00Z'),
  LIBERTAD_CONDICIONAL: '2. No cumple requisitos objetivos',
  PRISION_DOMICILIARIA_MITAD_PENA: 'No aplica',
  PROCEDENCIA_PENA_CUMPLIDA: 'No', PROCEDENCIA_ACUMULACION_PENAS: 'No',
  OTRAS_SOLICITUDES_TRAMITAR: 'Ninguna', DEFENSOR_GESTION: 'DEFENSORA ORIGINAL',
};

async function run() {
  for (const [input, expected] of [
    ['2026-05-20', '2026-11-20'], ['2026-08-31', '2027-02-28'],
    ['2023-08-31', '2024-02-29'], ['2026-02-28', '2026-08-28'],
    ['2026-12-31', '2027-06-30'],
  ]) assert.equal(nextAnalysisDate(input).toISOString().slice(0, 10), expected);
  for (const value of ['', '2026-02-30', 'invalid', new Date('invalid')]) assert.equal(nextAnalysisDate(value), null);
  assert(requiresAnalysisReview(closed));
  assert(requiresAnalysisReview({ ...closed, OTRAS_SOLICITUDES_TRAMITAR: '["Ninguna"]' }));
  for (const patch of [
    { LIBERTAD_CONDICIONAL: '' }, { PROCEDENCIA_PENA_CUMPLIDA: 'Sí' },
    { UTILIDAD_PUBLICA: 'Sí cumple requisitos objetivos' },
    { OTRAS_SOLICITUDES_TRAMITAR: 'Redención de pena' },
    { CIERRE_CASO: 'Otro motivo.' },
    { LIBERTAD_CONDICIONAL: closures.libertad.respuesta },
    { LIBERTAD_CONDICIONAL: closures.traslado.respuesta, PRISION_DOMICILIARIA_MITAD_PENA: closures.traslado.respuesta },
    { SE_PRESENTA_RECURSO: 'Sí', SENTIDO_DECISION: 'No concede la solicitud' },
  ]) assert.equal(requiresAnalysisReview({ ...closed, ...patch }), false, JSON.stringify(patch));
  const now = new Date('2026-11-23T16:00:00Z');
  for (const iso of ['2026-11-23', '2027-01-15', '2027-05-23']) {
    const updates = { NUEVA_FECHA_ANALISIS: new Date(`${iso}T00:00:00Z`) };
    applyAnalysisReview(updates, closed, { now });
    assert.equal(updates.NUEVA_FECHA_ANALISIS.toISOString().slice(0, 10), iso);
  }
  for (const value of [null, '', '2026-11-22', '2027-05-24', '2099-01-01', '2027-02-30', new Date('invalid')]) {
    assert.throws(() => applyAnalysisReview({ NUEVA_FECHA_ANALISIS: value }, closed, { now }),
      error => error.status === 400 && error.code.startsWith('PPL_FECHA_ANALISIS_'));
  }
  assert.throws(() => applyAnalysisReview({ RESUMEN_ANALISIS_CASO: 'Parcial' }, closed, { now }),
    error => error.code === 'PPL_FECHA_ANALISIS_REQUERIDA');
  const partial = { RESUMEN_ANALISIS_CASO: 'Parcial' };
  applyAnalysisReview(partial, { ...closed, NUEVA_FECHA_ANALISIS: new Date('2027-01-15') }, { now });
  assert.equal(partial.NUEVA_FECHA_ANALISIS.toISOString().slice(0, 10), '2027-01-15');

  const correction = { PROCEDENCIA_PENA_CUMPLIDA: 'Sí' };
  applyAnalysisReview(correction, { ...closed, NUEVA_FECHA_ANALISIS: new Date('2026-11-20') });
  assert.equal(correction.NUEVA_FECHA_ANALISIS, null);
  const celeste = { NUEVA_FECHA_ANALISIS: new Date() };
  applyAnalysisReview(celeste, closed, { sindicado: true });
  assert.equal(celeste.NUEVA_FECHA_ANALISIS, null);

  // Los guardados parciales conservan la fecha elegida y el servidor valida también la API.
  const persona = require('../repositories/oracle/personaRepository');
  const gestion = require('../repositories/oracle/gestionRepository');
  const repo = require('../repositories/oracle/analysisReviewRepository');
  const service = require('../services/pplService');
  const originals = { persona: { ...persona }, gestion: { ...gestion }, repo: { ...repo }, invalidate: service.invalidateDataCache };
  let stored = { ...closed, ID_ASIGNACION_GESTION: 40 };
  persona.findActiveContextByDocumento = async () => ({
    P_ID_PERSONA: 10, S_ID_SITUACION: 20, S_ACTIVO: 1, S_SITUACION: 'Condenado',
    G_ID_GESTION: 30, G_DEFENSOR: 'DEFENSORA ORIGINAL', G_ID_ASIGNACION: 40,
  });
  persona.listRowsWithActiveSituacionAndGestiones = async () => [{
    P_NUMERO: 123, S_ACTIVO: 1, S_SITUACION: 'Condenado', G_ID_GESTION: 30,
    G_NUEVA_FECHA_ANALISIS: stored.NUEVA_FECHA_ANALISIS,
  }];
  persona.reconcileGestionActionById = async () => {};
  gestion.getById = gestion.getLatestBySituacion = async () => stored;
  gestion.updateGestionById = async (_id, updates) => { stored = { ...stored, ...updates }; return 1; };
  gestion.insertGestion = async () => { throw new Error('No debe crearse una actuación manual'); };
  try {
    const today = require('../utils/analysisReviewDate').bogotaDate(new Date());
    const selected = nextAnalysisDate(today).toISOString().slice(0, 10);
    await assert.rejects(() => service.updateByDocumento('123', { rowIndex: 30, data: { NUEVA_FECHA_ANALISIS: '2099-01-01' } }),
      error => error.code === 'PPL_FECHA_ANALISIS_FUERA_RANGO');
    await assert.rejects(() => service.updateByDocumento('123', { rowIndex: 30, data: { NUEVA_FECHA_ANALISIS: '' } }),
      error => error.code === 'PPL_FECHA_ANALISIS_REQUERIDA');
    const result = await service.updateByDocumento('123', { rowIndex: 30, data: { NUEVA_FECHA_ANALISIS: selected } });
    assert.equal(result['Nueva fecha de análisis'], selected);
    await assert.rejects(() => service.createActuacionByDocumento('123', { data: {} }), error => error.code === 'PPL_REVISION_PROGRAMADA');
    await service.updateByDocumento('123', { rowIndex: 30, data: { 'Fecha de análisis jurídico del caso': '2026-06-30' } });
    assert.equal(stored.NUEVA_FECHA_ANALISIS.toISOString().slice(0, 10), selected);

    let release;
    let calls = 0;
    let invalidations = 0;
    repo.createDueReviews = async day => {
      assert.equal(day, '2026-11-19', 'Se usa el día de Bogotá antes de medianoche local');
      calls += 1;
      await new Promise(resolve => { release = resolve; });
      return 1;
    };
    service.invalidateDataCache = () => { invalidations += 1; };
    const scheduler = require('../services/analysisReviewService');
    const first = scheduler.schedulerTick(new Date('2026-11-20T04:59:00Z'));
    const second = scheduler.schedulerTick(new Date('2026-11-20T04:59:00Z'));
    release();
    assert.deepEqual(await Promise.all([first, second]), [1, 1]);
    assert.equal(calls, 1);
    assert.equal(invalidations, 1);
    repo.createDueReviews = async () => { throw new Error('Temporal'); };
    await assert.rejects(() => scheduler.schedulerTick(), /Temporal/);
    repo.createDueReviews = async () => 0;
    assert.equal(await scheduler.schedulerTick(), 0, 'Se puede reintentar tras un error');
  } finally {
    Object.assign(persona, originals.persona);
    Object.assign(gestion, originals.gestion);
    Object.assign(repo, originals.repo);
    service.invalidateDataCache = originals.invalidate;
  }
  console.log('OK: fecha de revisión, protección del campo, guardado parcial, bloqueo manual y programador.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
