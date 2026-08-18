const assert = require('assert/strict');
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env') });

const personaRepository = require('../repositories/oracle/personaRepository');
const pplRouter = require('../routes/ppl');
const { closePool, healthCheck } = require('../db/oraclePool');
const { ESTADOS_CASO, getEstadoEtiqueta } = require('../domain/estadoCaso');
const { listAcciones, resolveCentro } = require('../domain/catalogosHomologacion');
const { normalizeSearchText } = require('../utils/textNormalization');

if (String(process.env.RUN_ORACLE_INTEGRATION || '').trim().toLowerCase() !== 'true') {
  console.log('SKIP oracle-assigned-users-filters.integration (configure RUN_ORACLE_INTEGRATION=true)');
  process.exit(0);
}

const contract = pplRouter.condenadosContract;
const POTENTIAL_CATEGORIES = [
  'potenciales_beneficiarios',
  'mujeres_potenciales_utilidad_publica',
  'proximos_requisito_temporal',
  'no_reunen_requisitos',
];

function text(row, ...keys) {
  for (const key of keys) {
    const value = String(row?.[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function normalize(value) {
  return normalizeSearchText(value);
}

function includesNormalized(value, expected) {
  return normalize(value).includes(normalize(expected));
}

function startsWithNormalized(value, expected) {
  return normalize(value).startsWith(normalize(expected));
}

function getRawPlace(row) {
  return text(row, 'Nombre del lugar de privacion de la libertad', 'ESTABLECIMIENTO');
}

function getRawDepartment(row) {
  return text(row, 'Departamento del lugar de privacion de la libertad', 'Departamento');
}

function getRawMunicipality(row) {
  return text(row, 'Distrito/municipio del lugar de privacion de la libertad', 'Municipio');
}

function getRawDefender(row) {
  return text(
    row,
    'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
    'Defensor(a) Público(a) Asignado para tramitar la solicitud',
    'Defensor'
  );
}

function sampleScore(row) {
  return [
    text(row, 'Numero de identificacion'),
    text(row, 'Nombre'),
    getRawPlace(row),
    getRawDepartment(row),
    getRawMunicipality(row),
    getRawDefender(row),
    text(row, 'DEFENSOR_ID'),
    text(row, 'ESTADO_CODIGO'),
    text(row, 'CATEGORIA_POTENCIAL_SUBROGADO'),
  ].filter(Boolean).length;
}

async function inBatches(tasks, concurrency = 4) {
  const results = [];
  for (let index = 0; index < tasks.length; index += concurrency) {
    const batch = tasks.slice(index, index + concurrency);
    const batchResults = await Promise.all(batch.map((task) => task()));
    results.push(...batchResults);
  }
  return results;
}

function createCase(name, filters, predicate, { mustReturn = true, tipo = 'all' } = {}) {
  return async () => {
    const startedAt = Date.now();
    const summary = await personaRepository.listCondenadosSummary({
      tipo,
      filters,
      limit: 25,
      includeExactCounts: false,
    });
    const rows = Array.isArray(summary?.rows) ? summary.rows : [];
    if (mustReturn) assert(rows.length > 0, `${name}: debía devolver al menos una fila`);
    if (predicate) rows.forEach((row) => assert(predicate(row), `${name}: devolvió una fila que no cumple el filtro`));
    return { name, rows: rows.length, truncated: summary?.truncated === true, ms: Date.now() - startedAt };
  };
}

(async () => {
  try {
    assert.strictEqual((await healthCheck())?.ok, true);
    const options = await personaRepository.listDistinctCondenadosFilterOptions({ tipo: 'all', maxPerField: 5000 });
    assert(options.defensorOptions.length > 0, 'Se requieren defensores reales para construir una muestra completa');
    const baseline = await personaRepository.listCondenadosSummary({
      tipo: 'all',
      filters: {},
      limit: 200,
      includeExactCounts: false,
    });
    const baselineRows = Array.isArray(baseline?.rows) ? baseline.rows : [];
    assert(baselineRows.length > 0, 'Oracle debe devolver una muestra para validar filtros');
    const defenderSamples = await inBatches(
      options.defensorOptions.slice(0, 8).map((option) => async () => {
        const result = await personaRepository.listCondenadosSummary({
          tipo: 'all',
          filters: { defensorId: option.id },
          limit: 5,
          includeExactCounts: false,
        });
        return Array.isArray(result?.rows) ? result.rows : [];
      }),
      4
    );
    const samplePool = [...defenderSamples.flat(), ...baselineRows];
    samplePool.sort((left, right) => sampleScore(right) - sampleScore(left));
    const sample = samplePool[0];
    assert(sampleScore(sample) >= 9, 'No se encontró una fila con identidad, ubicación, flujo y categorización completos');
    const mappedSample = contract.mapRow(sample);

    const expectedMappedFields = [
      ...contract.columns,
      'situacionActiva',
      'lugarReclusionOriginal',
      'centroId',
      'centroHomologado',
      'centroReclusion',
      'defensorId',
      'estadoCodigo',
      'estadoEtiqueta',
      'accionPendiente',
      'categoriaPotencialSubrogado',
      'esPotencialSubrogado',
      'estadoSource',
      'Estado del caso',
    ];
    const expectedRawFields = [
      'Numero de identificacion',
      'Nombre',
      'Nombre del lugar de privacion de la libertad',
      'Departamento del lugar de privacion de la libertad',
      'Distrito/municipio del lugar de privacion de la libertad',
      'Autoridad a cargo',
      'Numero de proceso',
      'Situacion Juridica',
      'Situacion Juridica actualizada (de conformidad con la rama judicial)',
      'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
      'DEFENSOR_ID',
      'Fecha de analisis juridico del caso',
      'Resumen del analisis del caso',
      'Fecha de entrevista',
      'Actuacion a adelantar',
      'Procedencia de libertad condicional',
      'Procedencia de prision domiciliaria de mitad de pena',
      'Procedencia de utilidad publica (solo para mujeres)',
      'Procedencia de pena cumplida',
      'Procedencia de acumulacion de penas',
      'Con que procesos debe acumular penas (si aplica)',
      'Otras solicitudes a tramitar',
      'Decision del usuario',
      'Requiere pruebas',
      'Poder en caso de avanzar con la solicitud',
      'Fecha de entrevista psicosocial',
      'Cumple el requisito de marginalidad',
      'Cumple el requisito de jefatura de hogar',
      'Se requiere mision de trabajo',
      'Fecha de solicitud de mision de trabajo',
      'Fecha de asignacion de investigador',
      'Fecha en la que se reciben todas las pruebas',
      'Fecha de recepcion de pruebas aportadas por el usuario (Si aplica)',
      'Fecha de solicitud de documentos al INPEC (Si aplica)',
      'FECHA DE REVISION DEL EXPEDIENTE Y ELEMENTOS MATERIALES PROBATORIOS',
      'CONFIRMACION DE LA PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TERMINOS',
      'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTIAS PARA SUSTENTAR REVOCATORIA',
      'FECHA DE REALIZACION DE AUDIENCIA',
      'Se presenta recurso',
      'Sentido de la decision',
      'Motivo de la decision negativa',
      'Fecha de recurso en caso desfavorable',
      'Fecha de presentacion del recurso',
      'Sentido de la decision que resuelve recurso',
      'Fecha de la decision del recurso',
      'Cierre del caso por imposibilidad de avanzar (si aplica)',
      'Fecha de presentacion de la solicitud a la autoridad',
      'Fecha de radicacion de solicitud de utilidad publica',
      'Fecha de decision de la autoridad',
      'Fecha de asignacion del PAG',
      'Accion a realizar',
      'CATEGORIA_POTENCIAL_SUBROGADO',
      'ESTADO_CODIGO',
      'S_ACTIVO',
    ];
    expectedRawFields.forEach((field) => {
      assert(Object.prototype.hasOwnProperty.call(baselineRows[0], field), `Oracle no devolvió el campo ${field}`);
    });

    const fieldValidationRows = [...baselineRows, ...defenderSamples.flat()];
    for (const row of fieldValidationRows) {
      const mapped = contract.mapRow(row);
      expectedMappedFields.forEach((field) => {
        assert(Object.prototype.hasOwnProperty.call(mapped, field), `Contrato incompleto: falta ${field}`);
      });
    }

    const fieldPopulation = Object.fromEntries(
      expectedMappedFields.map((field) => [
        field,
        fieldValidationRows.reduce((count, row) => {
          const value = contract.mapRow(row)?.[field];
          const filled =
            value !== null &&
            value !== undefined &&
            (typeof value !== 'string' || value.trim() !== '') &&
            (typeof value !== 'object' || Object.keys(value).length > 0);
          return count + (filled ? 1 : 0);
        }, 0),
      ])
    );
    for (const field of [
      'numeroIdentificacion',
      'nombreUsuario',
      'lugarReclusion',
      'departamentoLugarReclusion',
      'municipioLugarReclusion',
      'situacionJuridica',
      'estadoCodigo',
      'estadoEtiqueta',
      'accionPendiente',
      'estadoSource',
    ]) {
      assert(fieldPopulation[field] > 0, `La muestra real no cargó el campo esencial ${field}`);
    }

    const document = mappedSample.numeroIdentificacion;
    const name = mappedSample.nombreUsuario;
    const rawPlace = getRawPlace(sample);
    const department = getRawDepartment(sample);
    const municipality = getRawMunicipality(sample);
    const defender = getRawDefender(sample);
    const defenderId = text(sample, 'DEFENSOR_ID');
    const stateCode = text(sample, 'ESTADO_CODIGO');
    const stateLabel = getEstadoEtiqueta(stateCode);
    const action = listAcciones().find((item) => item.estadoCodigos.includes(stateCode));
    const potential = text(sample, 'CATEGORIA_POTENCIAL_SUBROGADO');
    const center = resolveCentro(rawPlace);
    const sampleRequirements = {
      document: Boolean(document),
      name: Boolean(name),
      rawPlace: Boolean(rawPlace),
      department: Boolean(department),
      municipality: Boolean(municipality),
      defender: Boolean(defender),
      defenderId: Boolean(defenderId),
      stateCode: Boolean(stateCode),
      action: Boolean(action),
      center: Boolean(center),
    };
    assert(
      Object.values(sampleRequirements).every(Boolean),
      `Muestra incompleta: ${Object.entries(sampleRequirements).filter(([, present]) => !present).map(([key]) => key).join(', ')}`
    );

    const cases = [
      createCase('documento', { documento: document }, (row) => text(row, 'Numero de identificacion').startsWith(document)),
      createCase('nombre', { nombre: name }, (row) => includesNormalized(text(row, 'Nombre'), name)),
      createCase('defensorId', { defensorId: defenderId }, (row) => text(row, 'DEFENSOR_ID') === defenderId),
      createCase('defensor texto', { defensor: defender }, (row) => startsWithNormalized(getRawDefender(row), defender)),
      createCase('lugar texto', { lugar: rawPlace }, (row) => startsWithNormalized(getRawPlace(row), rawPlace)),
      createCase('centroId', { centroId: center.id, lugar: rawPlace }, (row) => resolveCentro(getRawPlace(row))?.id === center.id),
      createCase('departamento', { departamento: department }, (row) => startsWithNormalized(getRawDepartment(row), department)),
      createCase('municipio', { municipio: municipality }, (row) => startsWithNormalized(getRawMunicipality(row), municipality)),
      createCase('estadoCodigo', { estadoCodigo: stateCode }, (row) => text(row, 'ESTADO_CODIGO') === stateCode),
      createCase('estado legado', { estado: stateLabel }, (row) => text(row, 'ESTADO_CODIGO') === stateCode),
      createCase('accionCodigo', { accionCodigo: action.codigo }, (row) => action.estadoCodigos.includes(text(row, 'ESTADO_CODIGO'))),
      createCase('accion legado', { accion: action.etiqueta }, (row) => action.estadoCodigos.includes(text(row, 'ESTADO_CODIGO'))),
      createCase('estadoAccion legado', { estadoAccion: stateCode }, (row) => text(row, 'ESTADO_CODIGO') === stateCode),
      createCase(
        'potencialSubrogado',
        { potencialSubrogado: potential },
        (row) => text(row, 'CATEGORIA_POTENCIAL_SUBROGADO') === potential
      ),
      createCase(
        'combinado identidad+ubicacion+flujo',
        {
          documento: document,
          defensorId: defenderId,
          centroId: center.id,
          lugar: rawPlace,
          departamento: department,
          municipio: municipality,
          estadoCodigo: stateCode,
          accionCodigo: action.codigo,
        },
        (row) => text(row, 'Numero de identificacion') === document
      ),
    ];

    for (const state of ESTADOS_CASO) {
      cases.push(
        createCase(
          `estado opción ${state.codigo}`,
          { estadoCodigo: state.codigo },
          (row) => text(row, 'ESTADO_CODIGO') === state.codigo,
          { mustReturn: false }
        )
      );
    }
    for (const actionOption of listAcciones()) {
      cases.push(
        createCase(
          `acción opción ${actionOption.codigo}`,
          { accionCodigo: actionOption.codigo },
          (row) => actionOption.estadoCodigos.includes(text(row, 'ESTADO_CODIGO')),
          { mustReturn: false }
        )
      );
    }
    for (const category of POTENTIAL_CATEGORIES) {
      cases.push(
        createCase(
          `categoría ${category}`,
          { potencialSubrogado: category },
          (row) => text(row, 'CATEGORIA_POTENCIAL_SUBROGADO') === category,
          { mustReturn: false }
        )
      );
    }
    cases.push(
      createCase(
        'categoría booleana positiva',
        { potencialSubrogado: 'true' },
        (row) => text(row, 'CATEGORIA_POTENCIAL_SUBROGADO') !== 'no_reunen_requisitos',
        { mustReturn: false }
      ),
      createCase(
        'categoría booleana negativa',
        { potencialSubrogado: 'false' },
        (row) => text(row, 'CATEGORIA_POTENCIAL_SUBROGADO') === 'no_reunen_requisitos',
        { mustReturn: false }
      )
    );
    for (const tipo of ['all', 'condenado', 'sindicado']) {
      cases.push(
        createCase(
          `tipo ${tipo}`,
          {},
          tipo === 'all'
            ? () => true
            : (row) => includesNormalized(
                text(row, 'Situacion Juridica actualizada (de conformidad con la rama judicial)', 'Situacion Juridica'),
                tipo
              ),
          { mustReturn: true, tipo }
        )
      );
    }
    for (const [nameCase, filters] of [
      ['estado desconocido', { estadoCodigo: 'ESTADO_INEXISTENTE' }],
      ['acción desconocida', { accionCodigo: 'ACCION_INEXISTENTE' }],
      ['centro desconocido sin texto', { centroId: 'CENTRO_INEXISTENTE' }],
      ['documento inválido', { documento: 'SIN-DIGITOS' }],
      ['defensorId inválido', { defensorId: 'ID-INVALIDO' }],
      ['categoría inválida', { potencialSubrogado: 'CATEGORIA_INEXISTENTE' }],
    ]) {
      cases.push(createCase(nameCase, filters, null, { mustReturn: false }));
    }

    const results = await inBatches(cases, 4);
    for (const negativeName of [
      'estado desconocido',
      'acción desconocida',
      'centro desconocido sin texto',
      'documento inválido',
      'defensorId inválido',
      'categoría inválida',
    ]) {
      assert.equal(results.find((result) => result.name === negativeName)?.rows, 0, `${negativeName} debe devolver cero`);
    }

    assert(options.departamentos.length > 0);
    assert(options.municipios.length > 0);
    assert(options.lugares.length > 0);
    assert(options.defensorOptions.length > 0);
    assert(options.defensorOptions.every((item) => item.label && typeof item.id === 'string'));
    assert(options.departamentos.some((value) => normalize(value) === normalize(department)));
    assert(options.municipios.some((value) => normalize(value) === normalize(municipality)));
    assert(options.lugares.some((value) => normalize(value) === normalize(rawPlace)));

    const dependent = await personaRepository.listDistinctCondenadosFilterOptions({
      tipo: 'all',
      filters: { departamento: department, municipio: municipality },
      maxPerField: 5000,
    });
    assert(dependent.municipios.some((value) => normalize(value) === normalize(municipality)));
    assert(dependent.lugares.some((value) => normalize(value) === normalize(rawPlace)));

    const identityAudit = new Map();
    for (const raw of options.lugares) {
      const resolved = resolveCentro(raw);
      assert(resolved?.id, 'Cada centro visible debe recibir identidad estable');
      const previous = identityAudit.get(resolved.id);
      if (previous && normalize(previous) !== normalize(raw)) {
        assert(resolved.homologado, `Dos textos normalizados diferentes comparten identidad legacy: ${resolved.id}`);
      }
      identityAudit.set(resolved.id, raw);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          readOnly: true,
          sampleSize: baselineRows.length,
          fieldValidationSampleSize: fieldValidationRows.length,
          rawContractFields: expectedRawFields.length,
          filtersExecuted: results.length,
          filtersWithRows: results.filter((result) => result.rows > 0).length,
          filtersWithoutRepresentativeData: results
            .filter((result) => result.rows === 0 && !result.name.includes('desconocid') && !result.name.includes('inválid'))
            .map((result) => result.name),
          negativeCases: 6,
          optionCounts: {
            defensores: options.defensorOptions.length,
            departamentos: options.departamentos.length,
            municipios: options.municipios.length,
            centrosRaw: options.lugares.length,
            centrosIdentidad: identityAudit.size,
          },
          fieldPopulation,
          timings: results.map(({ name, rows, ms }) => ({ name, rows, ms })),
        },
        null,
        2
      )
    );
  } finally {
    await closePool().catch(() => {});
  }
})().catch((error) => {
  console.error(JSON.stringify({ ok: false, code: error?.code || '', message: error?.message || String(error) }, null, 2));
  process.exitCode = 1;
});
