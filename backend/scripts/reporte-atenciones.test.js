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
  assert.strictEqual(EVENT_UNIONS.filter(([type]) => type === 'reiteracion').length, 5);
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

  const consolidatedDefensorOptions = buildDefensorOptions([
    { CEDULA: null, NOMBRE: 'GERMAN ARTURO PUENTES CUELLAR', REGIONAL: null, CORREO: null },
    { CEDULA: '7001', NOMBRE: 'GERMAN ARTURO PUENTES CUELLAR', REGIONAL: 'CUNDINAMARCA', CORREO: 'g@example.test' },
    { CEDULA: '7001', NOMBRE: 'GERMAN ARTURO PUENTES CUELLAR', REGIONAL: 'CUNDINAMARCA', CORREO: 'g@example.test' },
  ]);
  assert.deepStrictEqual(consolidatedDefensorOptions, [{
    id: '7001',
    nombre: 'GERMAN ARTURO PUENTES CUELLAR',
    label: 'GERMAN ARTURO PUENTES CUELLAR',
    regional: 'CUNDINAMARCA',
    correo: 'g@example.test',
  }], 'la fila histórica sin cédula debe consolidarse con la identidad canónica');

  const mojibakeDefensorOptions = buildDefensorOptions([
    { CEDULA: null, NOMBRE: 'Lubi\u00C3\u00A1na  Histórica' },
    { CEDULA: '8002', NOMBRE: 'Lubiána Histórica', REGIONAL: 'BOGOTÁ' },
  ]);
  assert.strictEqual(mojibakeDefensorOptions.length, 1);
  assert.strictEqual(mojibakeDefensorOptions[0].id, '8002');
  assert.strictEqual(mojibakeDefensorOptions[0].nombre, 'Lubiána Histórica');

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
  assert.strictEqual(report.resumen.totalPersonasConCasosCerrados, 1);
  assert.strictEqual(report.detalles.casosAnalizados[0].fecha, '2026-08-05');
  assert.deepStrictEqual(
    report.detalles.casosAsignados.map((item) => item.estado),
    ['Presentar solicitud', 'Caso cerrado'],
    'los casos asignados deben seguir el orden del flujo y no el orden alfabético del usuario'
  );

  const orderingReport = buildReport({
    defensor: { cedula: '1234', nombre: 'Defensor Uno', regional: 'BOGOTÁ' },
    fechaInicio: '2026-08-01',
    fechaFin: '2026-08-31',
    assignedRows: [
      { ID_PERSONA: 1, NOMBRE_USUARIO: 'Cierre', IDENTIFICACION: '1', ESTADO: 'Caso cerrado', ACTIVO: 0 },
      { ID_PERSONA: 2, NOMBRE_USUARIO: 'Entrevista', IDENTIFICACION: '2', ESTADO: 'Entrevistar al usuario', ACTIVO: 1 },
      { ID_PERSONA: 3, NOMBRE_USUARIO: 'Análisis', IDENTIFICACION: '3', ESTADO: 'Analizar el caso', ACTIVO: 1 },
      { ID_PERSONA: 4, NOMBRE_USUARIO: 'Recurso', IDENTIFICACION: '4', ESTADO: 'Presentar recurso', ACTIVO: 1 },
      { ID_PERSONA: 5, NOMBRE_USUARIO: 'Solicitud', IDENTIFICACION: '5', ESTADO: 'Presentar solicitud', ACTIVO: 1 },
    ],
  });
  assert.deepStrictEqual(
    orderingReport.detalles.casosAsignados.map((item) => item.estado),
    ['Analizar el caso', 'Entrevistar al usuario', 'Presentar solicitud', 'Presentar recurso', 'Caso cerrado']
  );

  console.log('OK reporte-atenciones.test');
}

run();
