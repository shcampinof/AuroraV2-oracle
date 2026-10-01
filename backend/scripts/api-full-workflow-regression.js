const path = require('path');

require('dotenv').config({
  path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env.test'),
});

const { execute, closePool } = require('../db/oraclePool');
const { signAppToken } = require('../services/authService');
const { ESTADOS_CASO } = require('../domain/estadoCaso');

const API_BASE = String(
  process.env.API_BASE_URL || `http://127.0.0.1:${process.env.PORT || 7860}/api`
).replace(/\/+$/, '');
const ALLOW_SHARED_DB = process.env.API_WORKFLOW_ALLOW_SHARED_DB === '1';
const PILOT_DEFENDER = 'PRUEBA PILOTO';
const canonicalStates = new Set(ESTADOS_CASO.map((item) => item.etiqueta));

if (!ALLOW_SHARED_DB) {
  console.error(
    JSON.stringify({
      ok: false,
      code: 'SHARED_DB_WRITE_TEST_REFUSED',
      error:
        'Esta prueba escribe y revierte datos. Defina API_WORKFLOW_ALLOW_SHARED_DB=1 para autorizarla expresamente.',
    })
  );
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function lettersSuffix() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let value = Date.now();
  let out = '';
  for (let index = 0; index < 7; index += 1) {
    out += alphabet[value % alphabet.length];
    value = Math.floor(value / alphabet.length);
  }
  return out;
}

function numericSuffix() {
  return `99${String(Date.now()).slice(-8)}`;
}

const suffix = lettersSuffix();
const tempPagCedula = numericSuffix();
const tempDefenderCedula = String(Number(tempPagCedula) + 1);
const tempPagName = `PAG PRUEBA AUTOMATIZADA ${suffix}`;
const tempDefenderName = `PRUEBA AUTOMATIZADA ${suffix}`;
const markerBase = `PRUEBA AUTOMATIZADA ${new Date().toISOString()}`;
const createdGestionIds = new Set();
const assignmentSnapshots = new Map();
const baselineHistoryCounts = new Map();
const checks = [];
let tempPagCreated = false;
let tempDefenderCreated = false;
let tempRegional = '';

const token = signAppToken({
  id: 'prueba-automatizada-flujo-completo',
  username: 'prueba.automatizada',
  name: 'PRUEBA AUTOMATIZADA',
  provider: 'local',
  roles: ['pag', 'admin'],
});

function authHeaders() {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function fetchJson(name, route, options = {}, expected = 200) {
  const response = await fetch(`${API_BASE}${route}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(120000),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_error) {
    data = { raw: text.slice(0, 200) };
  }

  const allowed = Array.isArray(expected) ? expected : [expected];
  checks.push({ name, status: response.status });
  if (!allowed.includes(response.status)) {
    const detail = String(data?.message || data?.error || data?.code || '').slice(0, 250);
    throw new Error(`${name}: HTTP ${response.status}; esperado ${allowed.join(' o ')}${detail ? ` (${detail})` : ''}`);
  }
  return data;
}

function assertStateConsistency(record, context) {
  const state = String(record?.['Estado del trámite'] || '').trim();
  const action = String(record?.['Acción a impulsar'] || '').trim();
  const legacyAction = String(record?.['Acción a realizar'] || '').trim();
  assert(canonicalStates.has(state), `${context}: estado no canónico (${state || 'vacío'}).`);
  assert(action === state, `${context}: Acción a impulsar no coincide con el estado.`);
  assert(legacyAction === state, `${context}: Acción a realizar no coincide con el estado.`);
  assert(String(record?.estadoEtiqueta || '').trim() === state, `${context}: estadoEtiqueta no coincide.`);
}

async function queryRows(sql, binds, operation) {
  const result = await execute(sql, binds, { operation });
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function snapshotAssignments(idPersona) {
  const rows = await queryRows(
    `SELECT ID_ASIGNACION, FECHA_FIN
       FROM DNDP.ASIGNACION
      WHERE ID_PERSONA = :idPersona
      ORDER BY ID_ASIGNACION`,
    { idPersona },
    'workflow.snapshotAssignments'
  );
  assignmentSnapshots.set(Number(idPersona), rows);
}

async function restoreAssignments() {
  for (const [idPersona, snapshot] of assignmentSnapshots.entries()) {
    const originalIds = snapshot.map((row) => Number(row.ID_ASIGNACION)).filter(Number.isFinite);
    if (originalIds.length) {
      const placeholders = originalIds.map((_, index) => `:id${index}`).join(', ');
      const binds = { idPersona };
      originalIds.forEach((id, index) => {
        binds[`id${index}`] = id;
      });
      await execute(
        `DELETE FROM DNDP.ASIGNACION
          WHERE ID_PERSONA = :idPersona
            AND ID_ASIGNACION NOT IN (${placeholders})`,
        binds,
        { autoCommit: true, operation: 'workflow.deleteTemporaryAssignments' }
      );
    } else {
      await execute(
        'DELETE FROM DNDP.ASIGNACION WHERE ID_PERSONA = :idPersona',
        { idPersona },
        { autoCommit: true, operation: 'workflow.deleteTemporaryAssignments.emptyBaseline' }
      );
    }

    for (const row of snapshot) {
      await execute(
        `UPDATE DNDP.ASIGNACION
            SET FECHA_FIN = :fechaFin
          WHERE ID_ASIGNACION = :idAsignacion
            AND ID_PERSONA = :idPersona`,
        {
          fechaFin: row.FECHA_FIN || null,
          idAsignacion: Number(row.ID_ASIGNACION),
          idPersona,
        },
        { autoCommit: true, operation: 'workflow.restoreAssignmentDates' }
      );
    }
  }
}

async function deleteCreatedGestiones() {
  for (const idGestion of createdGestionIds) {
    await execute(
      'DELETE FROM DNDP.GESTION_JURIDICA WHERE ID_GESTION = :idGestion',
      { idGestion },
      { autoCommit: true, operation: 'workflow.deleteTemporaryGestion' }
    );
  }
}

async function history(documento, name) {
  const data = await fetchJson(name, `/ppl/${encodeURIComponent(documento)}/actuaciones`);
  assert(Array.isArray(data?.actuaciones), `${name}: historial inválido.`);
  return data.actuaciones;
}

async function createActuacion(documento, name, payload) {
  const data = await fetchJson(
    name,
    `/ppl/${encodeURIComponent(documento)}/actuaciones`,
    { method: 'POST', body: JSON.stringify(payload) },
    201
  );
  const idGestion = Number(data?.actuacion?.rowIndex || 0);
  assert(Number.isInteger(idGestion) && idGestion > 0, `${name}: no devolvió ID de gestión.`);
  createdGestionIds.add(idGestion);
  assertStateConsistency(data?.actuacion?.registro, name);
  return { idGestion, data };
}

async function verifyGestionPersistence(idGestion, marker, expectedFields, name) {
  const rows = await queryRows(
    `SELECT ID_GESTION, RESUMEN_ANALISIS_CASO, ACCION_REALIZAR,
            FECHA_ANALISIS, UTILIDAD_PUBLICA, ACTUACION_ADELANTAR,
            FECHA_RADICACION_UTILIDAD, FECHA_SOLICITUD_AUDIENCIA_CONTROL
       FROM DNDP.GESTION_JURIDICA
      WHERE ID_GESTION = :idGestion`,
    { idGestion },
    `workflow.verifyGestion.${name}`
  );
  assert(rows.length === 1, `${name}: la gestión no persistió en Oracle.`);
  const row = rows[0];
  assert(String(row.RESUMEN_ANALISIS_CASO || '').includes(marker), `${name}: no persistió el marcador.`);
  assert(canonicalStates.has(String(row.ACCION_REALIZAR || '').trim()), `${name}: acción Oracle no canónica.`);
  for (const [field, expected] of Object.entries(expectedFields)) {
    const actual = row[field];
    if (expected instanceof RegExp) {
      assert(expected.test(String(actual || '')), `${name}: ${field} no coincide.`);
    } else {
      assert(String(actual ?? '').trim() === String(expected).trim(), `${name}: ${field} no coincide.`);
    }
  }
}

async function assertDefender(documento, expectedName, name) {
  const detail = await fetchJson(name, `/ppl/${encodeURIComponent(documento)}`);
  const actual = String(detail?.registro?.defensorAsignado || '').trim();
  assert(actual === expectedName, `${name}: defensor esperado no coincide.`);
  return detail;
}

async function listPilotCase(tipo) {
  const query = new URLSearchParams({
    tipo,
    defensor: PILOT_DEFENDER,
    page: '1',
    pageSize: '20',
  });
  const data = await fetchJson(
    `listar ${tipo}s PRUEBA PILOTO`,
    `/ppl/condenados?${query.toString()}`
  );
  assert(Array.isArray(data?.rows) && data.rows.length > 0, `No hay casos ${tipo}s de PRUEBA PILOTO.`);
  assert(Number(data?.meta?.totalMatched || 0) >= data.rows.length, `Metadatos inválidos para ${tipo}.`);
  return String(data.rows[0]?.numeroIdentificacion || '').trim();
}

async function cleanup() {
  const cleanupErrors = [];
  const attempt = async (label, action) => {
    try {
      await action();
    } catch (error) {
      cleanupErrors.push(`${label}: ${error?.message || error}`);
    }
  };

  await attempt('eliminar actuaciones temporales', deleteCreatedGestiones);
  await attempt('restaurar asignaciones', restoreAssignments);
  if (tempDefenderCreated) {
    await attempt('eliminar defensor temporal', () =>
      execute(
        'DELETE FROM DNDP.DEFENSORES WHERE TO_CHAR(CEDULA) = :cedula',
        { cedula: tempDefenderCedula },
        { autoCommit: true, operation: 'workflow.deleteTemporaryDefender' }
      )
    );
  }
  if (tempPagCreated) {
    await attempt('eliminar PAG temporal', () =>
      execute(
        'DELETE FROM DNDP.PAG WHERE TO_CHAR(CEDULA_PAG) = :cedula',
        { cedula: tempPagCedula },
        { autoCommit: true, operation: 'workflow.deleteTemporaryPag' }
      )
    );
  }
  if (cleanupErrors.length) throw new Error(cleanupErrors.join(' | '));
}

(async () => {
  let primaryError = null;
  let condenadoDocumento = '';
  let sindicadoDocumento = '';

  try {
    await fetchJson('salud del backend', '/health');
    await fetchJson('salud de Oracle', '/health/db');

    condenadoDocumento = await listPilotCase('condenado');
    sindicadoDocumento = await listPilotCase('sindicado');
    assert(condenadoDocumento !== sindicadoDocumento, 'Los casos condenado y sindicado deben ser distintos.');

    const condenadoAntes = await fetchJson(
      'detalle condenado inicial',
      `/ppl/${encodeURIComponent(condenadoDocumento)}`
    );
    const sindicadoAntes = await fetchJson(
      'detalle sindicado inicial',
      `/ppl/${encodeURIComponent(sindicadoDocumento)}`
    );
    assert(condenadoAntes?.tipo === 'condenado', 'El caso seleccionado no es condenado.');
    assert(sindicadoAntes?.tipo === 'sindicado', 'El caso seleccionado no es sindicado.');
    assertDefender(condenadoDocumento, PILOT_DEFENDER, 'defensor inicial condenado');
    assertDefender(sindicadoDocumento, PILOT_DEFENDER, 'defensor inicial sindicado');

    const condenadoPersonaId = Number(condenadoAntes?.registro?.__oracleIdPersona || 0);
    assert(Number.isInteger(condenadoPersonaId) && condenadoPersonaId > 0, 'Falta ID interno del condenado.');
    await snapshotAssignments(condenadoPersonaId);

    const condenadoHistoryBefore = await history(condenadoDocumento, 'historial condenado inicial');
    const sindicadoHistoryBefore = await history(sindicadoDocumento, 'historial sindicado inicial');
    baselineHistoryCounts.set(condenadoDocumento, condenadoHistoryBefore.length);
    baselineHistoryCounts.set(sindicadoDocumento, sindicadoHistoryBefore.length);

    const regionalRows = await queryRows(
      `SELECT REGIONAL
         FROM DNDP.REGIONALES
        WHERE TRIM(REGIONAL) IS NOT NULL
        ORDER BY REGIONAL
        FETCH FIRST 1 ROWS ONLY`,
      {},
      'workflow.findValidRegional'
    );
    tempRegional = String(regionalRows[0]?.REGIONAL || '').trim();
    assert(tempRegional, 'No existe una regional válida para crear el PAG temporal.');

    await execute(
      `INSERT INTO DNDP.PAG (CEDULA_PAG, NOMBRE_PAG, REGIONAL, CORREO, ENCARGADO)
       VALUES (:cedula, :nombre, :regional, :correo, 0)`,
      {
        cedula: tempPagCedula,
        nombre: tempPagName,
        regional: tempRegional,
        correo: `pag.${tempPagCedula}@example.test`,
      },
      { autoCommit: true, operation: 'workflow.createTemporaryPag' }
    );
    tempPagCreated = true;
    await fetchJson('validar PAG temporal', `/ppl/pag/${tempPagCedula}/validar`);

    await fetchJson(
      'crear defensor temporal',
      '/defensores',
      {
        method: 'POST',
        body: JSON.stringify({
          cedula: tempDefenderCedula,
          nombre: tempDefenderName,
          correo: `defensor.${tempDefenderCedula}@example.test`,
          regional: tempRegional,
          cedulaPag: tempPagCedula,
        }),
      },
      201
    );
    tempDefenderCreated = true;
    const catalog = await fetchJson('consultar defensor creado', '/defensores');
    const tempOption = (catalog?.opciones || []).find(
      (item) => String(item?.id || '') === tempDefenderCedula && String(item?.nombre || '') === tempDefenderName
    );
    assert(tempOption, 'El defensor temporal no apareció en el catálogo después de crearlo.');

    await fetchJson(
      'rechazar defensor duplicado',
      '/defensores',
      {
        method: 'POST',
        body: JSON.stringify({ cedula: tempDefenderCedula, nombre: tempDefenderName }),
      },
      409
    );

    const normalMarker = `${markerBase} CONDENADO NORMAL`;
    const normal = await createActuacion(condenadoDocumento, 'crear actuación condenado normal', {
      'Fecha de análisis jurídico del caso': '2026-09-28',
      'Procedencia de libertad condicional': 'Procedente',
      'Procedencia de prisión domiciliaria de mitad de pena': 'No procede',
      'Procedencia de pena cumplida': 'No procede',
      'Procedencia de acumulación de penas': 'No procede',
      'Otras solicitudes a tramitar': 'Ninguna - prueba automatizada',
      'Resumen del análisis del caso': normalMarker,
      'Fecha de entrevista': '2026-09-29',
      'Decisión del usuario': 'Desea continuar con la solicitud',
      'Actuación a adelantar': 'Libertad condicional',
      'Requiere pruebas': 'No',
      'Poder en caso de avanzar con la solicitud': 'Sí',
      'Fecha de presentación de la solicitud a la autoridad': '2026-09-30',
    });
    await verifyGestionPersistence(
      normal.idGestion,
      normalMarker,
      { ACTUACION_ADELANTAR: 'Libertad condicional' },
      'condenado normal'
    );

    const updatedNormalMarker = `${normalMarker} ACTUALIZADA`;
    const updatedNormal = await fetchJson(
      'actualizar actuación condenado normal',
      `/ppl/${encodeURIComponent(condenadoDocumento)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          rowIndex: normal.idGestion,
          'Resumen del análisis del caso': updatedNormalMarker,
          'Número de insistencias': '1',
          'Fecha de insistencia 1': '2026-10-01',
        }),
      }
    );
    assertStateConsistency(updatedNormal?.registro, 'actualizar actuación condenado normal');
    await verifyGestionPersistence(normal.idGestion, updatedNormalMarker, {}, 'actualización condenado normal');

    const pilotCatalogOption = (catalog?.opciones || []).find(
      (item) => String(item?.nombre || '').trim().toUpperCase() === PILOT_DEFENDER
    );
    assert(pilotCatalogOption, 'PRUEBA PILOTO no está en el catálogo de defensores.');

    await fetchJson(
      'asignar defensor temporal',
      '/ppl/asignar-defensor',
      {
        method: 'POST',
        body: JSON.stringify({
          documentos: [condenadoDocumento],
          defensorCedula: tempDefenderCedula,
          pagCedula: tempPagCedula,
        }),
      }
    );
    await assertDefender(condenadoDocumento, tempDefenderName, 'verificar asignación');

    await fetchJson(
      'reasignar a PRUEBA PILOTO',
      '/ppl/asignar-defensor',
      {
        method: 'POST',
        body: JSON.stringify({
          documentos: [condenadoDocumento],
          defensorId: pilotCatalogOption.id,
          pagCedula: tempPagCedula,
        }),
      }
    );
    await assertDefender(condenadoDocumento, PILOT_DEFENDER, 'verificar reasignación');

    await fetchJson(
      'eliminar asignación',
      '/ppl/desasignar-defensor',
      {
        method: 'POST',
        body: JSON.stringify({ documentos: [condenadoDocumento], pagCedula: tempPagCedula }),
      }
    );
    await assertDefender(condenadoDocumento, '', 'verificar eliminación de asignación');

    const formAssignment = await fetchJson(
      'asignar defensor desde formulario',
      `/ppl/${encodeURIComponent(condenadoDocumento)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          rowIndex: normal.idGestion,
          'Defensor(a) Público(a) Asignado para tramitar la solicitud': tempDefenderName,
          PAG: tempPagName,
          Cedula_PAG: tempPagCedula,
        }),
      }
    );
    assertStateConsistency(formAssignment?.registro, 'asignar defensor desde formulario');
    await assertDefender(condenadoDocumento, tempDefenderName, 'verificar asignación desde formulario');

    const assignedQuery = new URLSearchParams({
      tipo: 'condenado',
      defensorId: tempDefenderCedula,
      page: '1',
      pageSize: '20',
    });
    const assignedList = await fetchJson(
      'filtrar asignados al defensor temporal',
      `/ppl/condenados?${assignedQuery.toString()}`
    );
    assert(
      (assignedList?.rows || []).some(
        (row) => String(row?.numeroIdentificacion || '') === condenadoDocumento
      ),
      'El caso no aparece en el filtro del defensor asignado.'
    );

    const utilityMarker = `${markerBase} UTILIDAD PUBLICA`;
    const utility = await createActuacion(condenadoDocumento, 'crear actuación utilidad pública', {
      'Fecha de análisis jurídico del caso': '2026-09-21',
      'Procedencia de utilidad pública (solo para mujeres)': 'Procedente',
      'Procedencia de libertad condicional': 'No procede',
      'Procedencia de prisión domiciliaria de mitad de pena': 'No procede',
      'Procedencia de pena cumplida': 'No procede',
      'Procedencia de acumulación de penas': 'No procede',
      'Resumen del análisis del caso': utilityMarker,
      'Fecha de entrevista': '2026-09-22',
      'Decisión del usuario': 'Desea continuar con utilidad pública',
      'Actuación a adelantar': 'Utilidad pública',
      'Requiere pruebas': 'Sí',
      'Poder en caso de avanzar con la solicitud': 'Sí',
      'Fecha de entrevista psicosocial': '2026-09-23',
      'Cumple el requisito de marginalidad': 'Sí',
      'Cumple el requisito de jefatura de hogar': 'Sí',
      'Se requiere misión de trabajo': 'Sí',
      'Fecha de solicitud de misión de trabajo': '2026-09-24',
      'Fecha de asignación de investigador': '2026-09-25',
      'Fecha en la que se reciben todas las pruebas': '2026-09-26',
      'Fecha de radicación de solicitud de utilidad pública': '2026-09-30',
    });
    await verifyGestionPersistence(
      utility.idGestion,
      utilityMarker,
      { UTILIDAD_PUBLICA: 'Procedente', ACTUACION_ADELANTAR: 'Utilidad pública' },
      'utilidad pública'
    );

    const sindicadoMarker = `${markerBase} SINDICADO`;
    const sindicado = await createActuacion(sindicadoDocumento, 'crear actuación sindicado', {
      'Fecha de análisis jurídico del caso': '2026-09-20',
      'Vencimiento de terminos': 'Procedente',
      'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS': 'Revocatoria de medida',
      'Resumen del análisis del caso': sindicadoMarker,
      'Fecha de entrevista': '2026-09-21',
      'Decisión del usuario': 'Desea continuar',
      'Requiere pruebas': 'No',
      'Poder en caso de avanzar con la solicitud': 'Sí',
      'FECHA DE REVISIÓN DEL EXPEDIENTE Y ELEMENTOS MATERIALES PROBATORIOS': '2026-09-22',
      'CONFIRMACIÓN DE LA PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS': 'Procedente',
      'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA': '2026-09-23',
      'FECHA DE REALIZACIÓN DE AUDIENCIA': '2026-09-30',
    });
    await verifyGestionPersistence(
      sindicado.idGestion,
      sindicadoMarker,
      { ACTUACION_ADELANTAR: 'Revocatoria de medida' },
      'sindicado'
    );

    const condenadoHistoryDuring = await history(condenadoDocumento, 'historial condenado con pruebas');
    const sindicadoHistoryDuring = await history(sindicadoDocumento, 'historial sindicado con pruebas');
    assert(
      condenadoHistoryDuring.length === baselineHistoryCounts.get(condenadoDocumento) + 2,
      'El historial condenado no refleja exactamente las dos actuaciones creadas.'
    );
    assert(
      sindicadoHistoryDuring.length === baselineHistoryCounts.get(sindicadoDocumento) + 1,
      'El historial sindicado no refleja exactamente la actuación creada.'
    );
    for (const item of [...condenadoHistoryDuring, ...sindicadoHistoryDuring]) {
      assertStateConsistency(item?.registro, 'consistencia del historial');
    }
  } catch (error) {
    primaryError = error;
  }

  let cleanupError = null;
  try {
    await cleanup();

    if (condenadoDocumento) {
      const restored = await assertDefender(
        condenadoDocumento,
        PILOT_DEFENDER,
        'verificar restauración de asignación original'
      );
      assertStateConsistency(restored?.registro, 'estado tras restaurar asignación');
      const historyAfter = await history(condenadoDocumento, 'historial condenado restaurado');
      assert(
        historyAfter.length === baselineHistoryCounts.get(condenadoDocumento),
        'El historial condenado no regresó a su tamaño original.'
      );
    }
    if (sindicadoDocumento) {
      const historyAfter = await history(sindicadoDocumento, 'historial sindicado restaurado');
      assert(
        historyAfter.length === baselineHistoryCounts.get(sindicadoDocumento),
        'El historial sindicado no regresó a su tamaño original.'
      );
    }

    const residue = await queryRows(
      `SELECT
         (SELECT COUNT(*) FROM DNDP.PAG WHERE TO_CHAR(CEDULA_PAG) = :pagCedula) AS PAGS,
         (SELECT COUNT(*) FROM DNDP.DEFENSORES WHERE TO_CHAR(CEDULA) = :defensorCedula) AS DEFENSORES,
         (SELECT COUNT(*) FROM DNDP.GESTION_JURIDICA WHERE ID_GESTION IN (${Array.from(createdGestionIds).length ? Array.from(createdGestionIds).map((_, index) => `:gestion${index}`).join(', ') : 'NULL'})) AS GESTIONES
       FROM dual`,
      {
        pagCedula: tempPagCedula,
        defensorCedula: tempDefenderCedula,
        ...Object.fromEntries(Array.from(createdGestionIds).map((id, index) => [`gestion${index}`, id])),
      },
      'workflow.verifyNoResidue'
    );
    assert(Number(residue[0]?.PAGS || 0) === 0, 'Quedó el PAG temporal en la base.');
    assert(Number(residue[0]?.DEFENSORES || 0) === 0, 'Quedó el defensor temporal en la base.');
    assert(Number(residue[0]?.GESTIONES || 0) === 0, 'Quedaron actuaciones temporales en la base.');
  } catch (error) {
    cleanupError = error;
  }

  await closePool().catch(() => {});

  if (primaryError || cleanupError) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          apiBase: API_BASE,
          error: primaryError?.message || null,
          cleanupError: cleanupError?.message || null,
          cleanupVerified: !cleanupError,
          checks,
        },
        null,
        2
      )
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiBase: API_BASE,
        cleanupVerified: true,
        scenarios: [
          'salud y conexión Oracle',
          'consulta y filtro de condenado/sindicado PRUEBA PILOTO',
          'creación y validación de PAG temporal',
          'creación, consulta y rechazo de duplicado de defensor',
          'asignación, reasignación y eliminación de asignación',
          'asignación de defensor desde el formulario',
          'flujo condenado normal con actualización',
          'flujo condenado de utilidad pública',
          'flujo sindicado',
          'persistencia directa en Oracle e historial',
          'consistencia canónica de estados y acciones',
          'restauración exacta y ausencia de residuos',
        ],
        checks,
      },
      null,
      2
    )
  );
})();
