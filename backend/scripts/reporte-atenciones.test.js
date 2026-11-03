const assert = require('assert');
const { buildDefensorOptions, buildReport, validateFilters, validateScope, attachCaseRegionales, generateReport, getReportOptions } = require('../services/reporteAtencionesService');
const reporteRepo = require('../repositories/oracle/reporteAtencionesRepository');
const { REPORT_REGIONAL_SIN_IDENTIFICAR } = require('../repositories/oracle/sqlFragments');
const {
  EVENT_UNIONS,
  EVENT_ASSIGNMENT_SCOPE_SQL,
  normalizeDefensorName,
} = require('../repositories/oracle/reporteAtencionesRepository');

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

async function run() {
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
  assert.match(
    EVENT_ASSIGNMENT_SCOPE_SQL,
    /a\.ORDEN = 1 OR e\.FECHA >= TRUNC\(a\.FECHA_ASIGNACION\)[\s\S]*a\.FECHA_FIN IS NULL OR e\.FECHA < TRUNC\(a\.FECHA_FIN\) \+ 1/,
    'solo la primera asignación cubre las actuaciones importadas anteriores a su alta'
  );
  assert.deepStrictEqual(validateScope(), { tipo: 'all', lugar: '', incluirFueraPrision: false });
  assert.deepStrictEqual(validateScope({ incluirFueraPrision: 'true', lugar: ' CPMS  GIRARDOT ' }), {
    tipo: 'all', lugar: 'CPMS GIRARDOT', incluirFueraPrision: true,
  });
  assert.throws(() => validateScope({ tipo: 'otro' }), /tipo de caso/);
  assert.throws(() => validateScope({ tipo: 'condenado', incluirFueraPrision: true }), /todos los tipos/);
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
  assert.strictEqual(report.resumen.totalActuaciones, 6, 'los casos cerrados no hacen parte del total de actuaciones');
  assert.strictEqual(report.resumen.personasAsignadas, 2);
  assert.strictEqual(report.resumen.personasActivas, 1);
  assert.strictEqual(report.resumen.personasActivasConGestion, 0, 'las personas activas sin actuaciones no cuentan en el indicador de gestión del periodo');
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

  const repeatedReport = buildReport({
    assignedRows: [assignedRows[0], assignedRows[0], assignedRows[1], assignedRows[1]],
  });
  assert.strictEqual(repeatedReport.resumen.personasAsignadas, 2, 'se cuentan personas, no filas de gestiones');
  assert.strictEqual(repeatedReport.resumen.personasActivas, 1);
  assert.strictEqual(repeatedReport.resumen.personasActivasConGestion, 0, 'tener una asignación activa no acredita gestión durante el periodo');
  assert.strictEqual(repeatedReport.resumen.totalPersonasConCasosCerrados, 1);
  const otherPeriodReport = buildReport({
    fechaInicio: '2026-10-01',
    fechaFin: '2026-10-27',
    assignedRows,
    eventRows: [],
  });
  assert.strictEqual(otherPeriodReport.resumen.totalActuaciones, 0);
  for (const key of ['personasActivas', 'totalPersonasConCasosCerrados']) {
    assert.strictEqual(otherPeriodReport.resumen[key], report.resumen[key], `${key} no depende del periodo ni de sus actuaciones`);
  }
  assert.strictEqual(
    otherPeriodReport.resumen.personasActivas + otherPeriodReport.resumen.totalPersonasConCasosCerrados,
    otherPeriodReport.resumen.personasAsignadas,
    'los totales globales dividen toda la carga actual en personas con caso activo o cerrado'
  );
  const managedAssignments = [...assignedRows, { ID_PERSONA: 32, ESTADO: 'Analizar el caso', ACTIVO: 1 }];
  const managedReport = buildReport({
    assignedRows: managedAssignments,
    eventRows: [
      rawEvent('analisis', { ID_PERSONA: 31 }),
      rawEvent('entrevista', { ID_PERSONA: 31 }),
      rawEvent('analisis', { ID_PERSONA: 99 }),
      rawEvent('cierre'),
    ],
  });
  const noManagementReport = buildReport({ assignedRows: managedAssignments });
  assert.strictEqual(managedReport.resumen.personasActivas, 2);
  assert.strictEqual(managedReport.resumen.personasActivasConGestion, 1, 'solo cuenta una vez a la persona actualmente activa con gestión; excluye cerradas y no asignadas');
  assert.strictEqual(noManagementReport.resumen.personasActivas, 2);
  assert.strictEqual(noManagementReport.resumen.personasActivasConGestion, 0, 'el campo 2.3 depende de las actuaciones del periodo; el 2.2 no');
  const transferredReport = buildReport({ eventRows: [rawEvent('analisis')], assignedRows: [] });
  assert.strictEqual(transferredReport.resumen.casosAnalizados, 1, 'la actuación se conserva sin asignación actual');
  assert.strictEqual(transferredReport.resumen.personasAsignadas, 0);

  const scopedOptions = attachCaseRegionales(consolidatedDefensorOptions, [
    { CEDULA: '7001', NOMBRE: 'NOMBRE ANTERIOR', REGIONAL_CASO: 'QUINDIO' },
    { NOMBRE: 'GERMAN ARTURO PUENTES CUELLAR', REGIONAL_CASO: 'BOGOTA' },
    { CEDULA: '7001', REGIONAL_CASO: 'QUINDIO' },
  ]);
  assert.deepStrictEqual(scopedOptions[0].regionalesCasos, ['BOGOTA', 'QUINDIO']);
  assert.strictEqual(scopedOptions[0].regional, 'CUNDINAMARCA', 'la ficha del defensor no determina la regional de sus casos');
  assert.strictEqual(scopedOptions[0].tieneCasosSindicados, false);
  const withoutRegional = attachCaseRegionales(consolidatedDefensorOptions, [{ CEDULA: '7001', REGIONAL_CASO: REPORT_REGIONAL_SIN_IDENTIFICAR, ES_SINDICADO: 1 }]);
  assert.deepStrictEqual(withoutRegional[0].regionalesCasos, [REPORT_REGIONAL_SIN_IDENTIFICAR]);
  assert.strictEqual(withoutRegional[0].tieneCasosSindicados, true);
  const savedMethods = { ...reporteRepo };
  try {
    reporteRepo.listAvailableDefensores = async () => [{ CEDULA: '7001', NOMBRE: 'DEFENSOR PRUEBA', REGIONAL: 'QUINDIO' }];
    reporteRepo.listAvailableRegionales = async () => ['CUNDINAMARCA', 'QUINDIO'];
    reporteRepo.listAvailableEstablecimientos = async () => [
      { ESTABLECIMIENTO: 'CPMS GIRARDOT', REGIONAL: 'CUNDINAMARCA' },
      { ESTABLECIMIENTO: 'CPMS ARMENIA', REGIONAL: 'QUINDIO' },
      { ESTABLECIMIENTO: 'CDT SIN HOMOLOGAR', REGIONAL: 'CUNDINAMARCA' },
    ];
    reporteRepo.listDefensorRegionales = async () => [{ CEDULA: '7001', REGIONAL_CASO: 'CUNDINAMARCA' }];
    const calls = [];
    reporteRepo.listEvents = async (params) => { calls.push(params); return []; };
    reporteRepo.listAssignedCases = async (params) => { calls.push(params); return []; };
    const filters = { defensorId: '7001', regional: 'CUNDINAMARCA', lugar: 'CPMS GIRARDOT', fechaInicio: '2026-10-01', fechaFin: '2026-10-27' };
    assert.deepStrictEqual((await getReportOptions()).establecimientos, ['CPMS GIRARDOT', 'CPMS ARMENIA'], 'el selector solo ofrece ERON homologados, nunca CDT');
    await generateReport(filters);
    assert.strictEqual(calls.length, 2);
    assert(calls.every((params) => params.regional === 'CUNDINAMARCA'), 'el filtro regional llega al histórico y a los totales globales');
    await assert.rejects(generateReport({ ...filters, regional: 'QUINDIO', lugar: '' }), /no tiene casos en esta regional/);
    await assert.rejects(generateReport({ ...filters, lugar: 'CPMS ARMENIA' }), /no pertenece a esta regional/);
    await assert.rejects(generateReport({ ...filters, lugar: 'CDT SIN HOMOLOGAR' }), /no pertenece a esta regional/);
    await assert.rejects(generateReport({ ...filters, regional: 'NO EXISTE' }), /regional seleccionada no es válida/);
    assert.strictEqual(calls.length, 2, 'los filtros inválidos se rechazan antes de consultar conteos');
    reporteRepo.listDefensorRegionales = async () => [{ CEDULA: '7001', REGIONAL_CASO: REPORT_REGIONAL_SIN_IDENTIFICAR, ES_SINDICADO: 1 }];
    assert((await getReportOptions()).regionales.includes(REPORT_REGIONAL_SIN_IDENTIFICAR));
    await assert.rejects(generateReport({ ...filters, lugar: '' }), /no tiene casos en esta regional/);
    await assert.rejects(generateReport(filters), /no tiene casos en esta regional/);
    const unknownReport = await generateReport({ ...filters, regional: REPORT_REGIONAL_SIN_IDENTIFICAR, lugar: '' });
    assert.strictEqual(unknownReport.metadata.regional, REPORT_REGIONAL_SIN_IDENTIFICAR);
    assert.strictEqual(calls.length, 4, 'los casos sin regional se consultan exclusivamente por separado');
    assert(calls.slice(2).every((params) => params.regional === REPORT_REGIONAL_SIN_IDENTIFICAR));
    await assert.rejects(generateReport({ ...filters, regional: REPORT_REGIONAL_SIN_IDENTIFICAR }), /no pertenece a esta regional/);
    reporteRepo.listDefensorRegionales = async () => [{ CEDULA: '7001', REGIONAL_CASO: 'QUINDIO', ES_SINDICADO: 1 }];
    await assert.rejects(generateReport({ ...filters, lugar: '' }), /no tiene casos en esta regional/);
    await generateReport({ ...filters, regional: 'QUINDIO', lugar: 'CPMS ARMENIA' });
    assert.strictEqual(calls.length, 6, 'un sindicado en ERON homologado puede consultarse en su regional y establecimiento');
  } finally {
    Object.assign(reporteRepo, savedMethods);
  }

  console.log('OK reporte-atenciones.test');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
