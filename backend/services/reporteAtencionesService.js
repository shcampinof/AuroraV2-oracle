const defensoresRepo = require('../repositories/oracle/defensoresRepository');
const reporteRepo = require('../repositories/oracle/reporteAtencionesRepository');

const EVENT_KEYS = Object.freeze(['analisis', 'entrevista', 'solicitud', 'reiteracion', 'recurso', 'cierre']);

function createReportError(message, status = 400, code = 'INVALID_REPORT_FILTERS') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function parseIsoDate(value, label) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw createReportError(`${label} debe tener formato AAAA-MM-DD.`);
  }
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw createReportError(`${label} no es una fecha válida.`);
  }
  return { text, parsed };
}

function validateFilters({ fechaInicio, fechaFin, defensorId } = {}) {
  const start = parseIsoDate(fechaInicio, 'La fecha inicial');
  const end = parseIsoDate(fechaFin, 'La fecha final');
  if (start.parsed > end.parsed) {
    throw createReportError('La fecha inicial no puede ser posterior a la fecha final.');
  }

  const defensorKey = String(defensorId || '').trim();
  if (!defensorKey) {
    throw createReportError('Debe seleccionar un defensor público válido.');
  }

  return { fechaInicio: start.text, fechaFin: end.text, defensorKey };
}

function buildDefensorOptions(rows = []) {
  const mapped = rows
    .map((row) => {
      const cedula = defensoresRepo.normalizeCedula(row?.CEDULA);
      const nombre = String(row?.NOMBRE || '').replace(/\s+/g, ' ').trim();
      if (!nombre) return null;
      const normalizedName = reporteRepo.normalizeDefensorName(nombre);
      return {
        id: cedula || `NOMBRE:${normalizedName}`,
        cedula,
        nombre,
        regional: String(row?.REGIONAL || '').trim(),
        correo: String(row?.CORREO || '').trim(),
        normalizedName,
      };
    })
    .filter(Boolean);

  const counts = mapped.reduce((map, item) => {
    map.set(item.normalizedName, (map.get(item.normalizedName) || 0) + 1);
    return map;
  }, new Map());

  const deduped = new Map();
  mapped.forEach((item) => {
    const key = item.id;
    if (deduped.has(key)) return;
    const duplicatedName = counts.get(item.normalizedName) > 1;
    deduped.set(key, {
      id: item.id,
      nombre: item.nombre,
      label: duplicatedName
        ? `${item.nombre} (${item.cedula ? `ID terminada en ${item.cedula.slice(-4)}` : 'sin identificación'})`
        : item.nombre,
      regional: item.regional,
      correo: item.correo,
    });
  });
  return Array.from(deduped.values()).sort((left, right) => left.label.localeCompare(right.label, 'es'));
}

async function getReportOptions() {
  const [defensorRows, regionales] = await Promise.all([
    reporteRepo.listAvailableDefensores(),
    reporteRepo.listAvailableRegionales(),
  ]);
  return { defensores: buildDefensorOptions(defensorRows), regionales };
}

function toIsoDate(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function mapDetail(row) {
  return {
    idGestion: Number(row?.ID_GESTION || 0) || null,
    idSituacion: Number(row?.ID_SITUACION || 0) || null,
    idPersona: Number(row?.ID_PERSONA || 0) || null,
    nombre: String(row?.NOMBRE_USUARIO || '').trim(),
    identificacion: String(row?.IDENTIFICACION || '').trim(),
    lugarPrivacion: String(row?.LUGAR_PRIVACION || '').trim() || 'Sin información',
    fecha: toIsoDate(row?.FECHA),
  };
}

function mapAssignedCase(row) {
  return {
    idPersona: Number(row?.ID_PERSONA || 0) || null,
    nombre: String(row?.NOMBRE_USUARIO || '').trim(),
    identificacion: String(row?.IDENTIFICACION || '').trim(),
    lugarPrivacion: String(row?.LUGAR_PRIVACION || '').trim() || 'Sin información',
    estado: String(row?.ESTADO || '').trim() || 'Analizar el caso',
    activo: Number(row?.ACTIVO) === 1,
  };
}

function uniqueCount(items, field) {
  return new Set(items.map((item) => item?.[field]).filter((value) => value != null && value !== '')).size;
}

function buildReport({ defensor, fechaInicio, fechaFin, eventRows = [], assignedRows = [] }) {
  const details = Object.fromEntries(EVENT_KEYS.map((key) => [key, []]));
  eventRows.forEach((row) => {
    const type = String(row?.TIPO || '').trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(details, type)) return;
    details[type].push(mapDetail(row));
  });

  const assignedCases = assignedRows.map(mapAssignedCase);
  const activeCases = assignedCases.filter((item) => item.activo);
  const peopleWithEvents = new Set(
    EVENT_KEYS.flatMap((key) => details[key]).map((item) => item.idPersona).filter(Boolean)
  );
  const activeWithEvents = activeCases.filter((item) => peopleWithEvents.has(item.idPersona));
  const closedCaseCount = uniqueCount(details.cierre, 'idSituacion');
  const closedPeopleCount = uniqueCount(details.cierre, 'idPersona');

  return {
    metadata: {
      regional: String(defensor?.regional || '').trim(),
      defensor: String(defensor?.nombre || '').trim(),
      defensorId: String(defensor?.cedula || '').trim(),
      fechaInicio,
      fechaFin,
      generadoEn: new Date().toISOString(),
    },
    resumen: {
      casosAnalizados: details.analisis.length,
      entrevistasRealizadas: details.entrevista.length,
      solicitudesPresentadas: details.solicitud.length,
      reiteracionesPresentadas: details.reiteracion.length,
      recursosPresentados: details.recurso.length,
      casosCerrados: closedCaseCount,
      totalActuaciones:
        details.analisis.length +
        details.entrevista.length +
        details.solicitud.length +
        details.reiteracion.length +
        details.recurso.length +
        closedCaseCount,
      personasAsignadas: assignedCases.length,
      personasActivas: activeCases.length,
      personasActivasConGestion: activeWithEvents.length,
      personasConCasoCerrado: closedPeopleCount,
    },
    detalles: {
      casosAnalizados: details.analisis,
      entrevistas: details.entrevista,
      solicitudes: details.solicitud,
      reiteraciones: details.reiteracion,
      recursos: details.recurso,
      casosAsignados: assignedCases,
    },
  };
}

async function generateReport(filters) {
  const validated = validateFilters(filters);
  const selectedRegional = String(filters?.regional || '').trim();
  if (!selectedRegional) {
    throw createReportError('Debe seleccionar la regional para el encabezado del informe.');
  }

  const options = await getReportOptions();
  const defensor = options.defensores.find((item) => item.id === validated.defensorKey);
  if (!defensor) {
    throw createReportError('El defensor seleccionado no tiene actuaciones disponibles.', 404, 'DEFENSOR_NOT_FOUND');
  }

  const params = {
    ...validated,
    defensorCedula: /^\d+$/.test(defensor.id) ? defensor.id : '',
    defensorNombre: defensor.nombre,
  };
  const [eventRows, assignedRows] = await Promise.all([
    reporteRepo.listEvents(params),
    reporteRepo.listAssignedCases(params),
  ]);
  return buildReport({
    defensor: { ...defensor, regional: selectedRegional },
    fechaInicio: validated.fechaInicio,
    fechaFin: validated.fechaFin,
    eventRows,
    assignedRows,
  });
}

module.exports = {
  EVENT_KEYS,
  validateFilters,
  buildReport,
  buildDefensorOptions,
  getReportOptions,
  generateReport,
};
