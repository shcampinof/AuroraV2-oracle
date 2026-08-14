const assert = require('assert');
const { buildDefensorOptions, buildReport, validateFilters } = require('../services/reporteAtencionesService');
const { EVENT_UNIONS, normalizeDefensorName } = require('../repositories/oracle/reporteAtencionesRepository');

function rawEvent(tipo, overrides = {}) {
  return {
    TIPO: tipo,
    ID_GESTION: 10,
    ID_SITUACION: 20,
    ID_PERSONA: 30,
    NOMBRE_USUARIO: 'Persona Uno',
    IDENTIFICACION: '1000',
    LUGAR_PRIVACION: 'Centro Uno',
    FECHA: new Date('2026-08-05T00:00:00Z'),
    ...overrides,
  };
}

function run() {
  assert.deepStrictEqual(validateFilters({
    fechaInicio: '2026-08-01',
    fechaFin: '2026-08-31',
    defensorId: '1.234',
  }), {
    fechaInicio: '2026-08-01',
    fechaFin: '2026-08-31',
    defensorKey: '1.234',
  });
  assert.throws(
    () => validateFilters({ fechaInicio: '2026-09-01', fechaFin: '2026-08-31', defensorId: '1' }),
    /fecha inicial no puede ser posterior/i
  );
  assert.strictEqual(normalizeDefensorName('  José   Pérez '), 'JOSE PEREZ');
  assert.strictEqual(EVENT_UNIONS.filter(([type]) => type === 'solicitud').length, 3);
  assert.strictEqual(EVENT_UNIONS.filter(([type]) => type === 'reiteracion').length, 2);
  const defensorOptions = buildDefensorOptions([
    { CEDULA: null, NOMBRE: 'NANCY LANUZA', REGIONAL: null, CORREO: null },
    { CEDULA: '1234', NOMBRE: 'DEFENSOR CON CATÁLOGO', REGIONAL: 'MAGDALENA', CORREO: 'd@example.test' },
  ]);
  assert.deepStrictEqual(defensorOptions[1], {
    id: 'NOMBRE:NANCY LANUZA',
    nombre: 'NANCY LANUZA',
    label: 'NANCY LANUZA',
    regional: '',
    correo: '',
  });

  const eventRows = [
    rawEvent('analisis'),
    rawEvent('entrevista'),
    rawEvent('solicitud'),
    rawEvent('reiteracion'),
    rawEvent('reiteracion', { FECHA: new Date('2026-08-06T00:00:00Z') }),
    rawEvent('recurso'),
    rawEvent('cierre'),
    rawEvent('cierre'),
  ];
  const assignedRows = [
    {
      ID_PERSONA: 30,
      NOMBRE_USUARIO: 'Persona Uno',
      IDENTIFICACION: '1000',
      LUGAR_PRIVACION: 'Centro Uno',
      ESTADO: 'Caso cerrado',
      ACTIVO: 0,
    },
    {
      ID_PERSONA: 31,
      NOMBRE_USUARIO: 'Persona Dos',
      IDENTIFICACION: '1001',
      LUGAR_PRIVACION: 'Centro Dos',
      ESTADO: 'Presentar solicitud',
      ACTIVO: 1,
    },
  ];
  const report = buildReport({
    defensor: { cedula: '1234', nombre: 'Defensor Uno', regional: 'BOGOTÁ' },
    fechaInicio: '2026-08-01',
    fechaFin: '2026-08-31',
    eventRows,
    assignedRows,
  });

  assert.strictEqual(report.resumen.casosAnalizados, 1);
  assert.strictEqual(report.resumen.reiteracionesPresentadas, 2);
  assert.strictEqual(report.resumen.casosCerrados, 1, 'un caso cerrado no debe duplicarse por filas repetidas');
  assert.strictEqual(report.resumen.personasConCasoCerrado, 1);
  assert.strictEqual(report.resumen.totalActuaciones, 7);
  assert.strictEqual(report.resumen.personasAsignadas, 2);
  assert.strictEqual(report.resumen.personasActivas, 1);
  assert.strictEqual(report.resumen.personasActivasConGestion, 0);
  assert.strictEqual(report.detalles.casosAnalizados[0].fecha, '2026-08-05');

  console.log('OK reporte-atenciones.test');
}

run();
