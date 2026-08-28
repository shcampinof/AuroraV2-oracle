const defensoresRepo = require('../repositories/oracle/defensoresRepository');
const reporteRepo = require('../repositories/oracle/reporteAtencionesRepository');
const { listAcciones, resolveAccionCodigo } = require('../domain/catalogosHomologacion');
const {
  choosePreferredDisplayText,
  normalizeWhitespace,
  repairKnownMojibake,
} = require('../utils/textNormalization');

const EVENT_KEYS = Object.freeze(['analisis', 'entrevista', 'solicitud', 'reiteracion', 'recurso', 'cierre']);
const CASE_STATE_ORDER = new Map(
  listAcciones().map((item, index) => [item.codigo, index])
);

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
      const nombre = normalizeWhitespace(repairKnownMojibake(row?.NOMBRE));
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

  const groups = new Map();
  mapped.forEach((item) => {
    const group = groups.get(item.normalizedName) || [];
    group.push(item);
    groups.set(item.normalizedName, group);
  });

  const options = [];
  groups.forEach((group) => {
    const identifiedByCedula = new Map();
    group.filter((item) => item.cedula).forEach((item) => {
      const previous = identifiedByCedula.get(item.cedula);
      identifiedByCedula.set(item.cedula, {
        ...item,
        nombre: choosePreferredDisplayText(previous?.nombre, item.nombre),
        regional: previous?.regional || item.regional,
        correo: previous?.correo || item.correo,
      });
    });

    const identified = Array.from(identifiedByCedula.values());
    if (identified.length <= 1) {
      // Las asignaciones históricas podían guardar solo el nombre. Cuando ese
      // nombre tiene una única cédula canónica, ambas filas representan al
      // mismo defensor y el reporte con cédula ya consulta los dos orígenes.
      const canonical = identified[0] || group[0];
      const displayName = group.reduce(
        (current, item) => choosePreferredDisplayText(current, item.nombre),
        canonical.nombre
      );
      options.push({
        id: canonical.id,
        nombre: displayName,
        label: displayName,
        regional: canonical.regional || group.find((item) => item.regional)?.regional || '',
        correo: canonical.correo || group.find((item) => item.correo)?.correo || '',
      });
      return;
    }

    // Dos cédulas distintas con el mismo nombre sí son identidades ambiguas y
    // deben conservarse separadas. La fila sin cédula tampoco puede asociarse
    // de forma segura a una de ellas.
    identified.forEach((item) => {
      options.push({
        id: item.id,
        nombre: item.nombre,
        label: `${item.nombre} (ID terminada en ${item.cedula.slice(-4)})`,
        regional: item.regional,
        correo: item.correo,
      });
    });
    if (group.some((item) => !item.cedula)) {
      const unidentified = group.find((item) => !item.cedula);
      options.push({
        id: unidentified.id,
        nombre: unidentified.nombre,
        label: `${unidentified.nombre} (sin identificación)`,
        regional: unidentified.regional,
        correo: unidentified.correo,
      });
    }
  });

  return options.sort((left, right) => left.label.localeCompare(right.label, 'es'));
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

function sortAssignedCases(items) {
  const unknownStateOrder = CASE_STATE_ORDER.size;
  return [...items].sort((left, right) => {
    const leftOrder = CASE_STATE_ORDER.get(resolveAccionCodigo(left.estado)) ?? unknownStateOrder;
    const rightOrder = CASE_STATE_ORDER.get(resolveAccionCodigo(right.estado)) ?? unknownStateOrder;
    return leftOrder - rightOrder
      || left.nombre.localeCompare(right.nombre, 'es', { sensitivity: 'base' })
      || left.identificacion.localeCompare(right.identificacion, 'es', { numeric: true });
  });
}

function buildReport({ defensor, fechaInicio, fechaFin, eventRows = [], assignedRows = [] }) {
  const details = Object.fromEntries(EVENT_KEYS.map((key) => [key, []]));
  eventRows.forEach((row) => {
    const type = String(row?.TIPO || '').trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(details, type)) return;
    details[type].push(mapDetail(row));
  });

  const assignedCases = sortAssignedCases(assignedRows.map(mapAssignedCase));
  const activeCases = assignedCases.filter((item) => item.activo);
  const closedAssignedPeopleCount = uniqueCount(
    assignedCases.filter((item) => !item.activo),
    'idPersona'
  );
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
      totalPersonasConCasosCerrados: closedAssignedPeopleCount,
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
