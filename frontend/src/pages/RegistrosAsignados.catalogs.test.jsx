import { describe, expect, it } from 'vitest';
import {
  ACCIONES_IMPULSAR_OPTIONS,
  ASSIGNED_USERS_FILTER_KEYS,
  buildAssignedUsersFilters,
  normalizeFilterOptions,
  resolveCentroByLabel,
  resolveDefensorIdByLabel,
} from '../utils/asignadosCatalogs.js';

describe('catálogos de filtros de usuarios asignados', () => {
  it('conserva IDs, homologación y códigos de estado asociados a acciones', () => {
    const options = normalizeFilterOptions({
      centros: [
        {
          id: 'CENTRO_1',
          label: 'CENTRO CANÓNICO',
          homologado: true,
          valoresOriginales: ['Centro histórico'],
        },
      ],
      acciones: [
        {
          codigo: 'REALIZAR_ENTREVISTA',
          etiqueta: 'Entrevistar al usuario',
          estadoCodigos: ['ENTREVISTAR_USUARIO'],
        },
      ],
      meta: { homologacionCentros: { noHomologados: 3 } },
    });

    expect(options.centros[0]).toMatchObject({ id: 'CENTRO_1', homologado: true });
    expect(options.acciones[0].estadoCodigos).toEqual(['ENTREVISTAR_USUARIO']);
    expect(options.meta.homologacionCentros.noHomologados).toBe(3);
    expect(resolveCentroByLabel('Centro histórico', options.centros)?.id).toBe('CENTRO_1');
  });

  it('mantiene las etiquetas operativas de acción aunque la API no entregue el catálogo', () => {
    const options = normalizeFilterOptions({ acciones: [] });

    expect(options.acciones).toEqual(ACCIONES_IMPULSAR_OPTIONS);
    expect(options.acciones.map((item) => item.label)).toEqual([
      'Analizar el caso',
      'Entrevistar al usuario',
      'Presentar solicitud',
      'Hacer seguimiento a la audiencia',
      'Hacer seguimiento a la decisión de audiencia',
      'Hacer seguimiento a la decisión',
      'Presentar recurso',
      'Sin acción pendiente',
    ]);
    expect(options.acciones.map((item) => item.label)).not.toContain('Pendiente audiencia');
    expect(options.acciones.map((item) => item.label)).not.toContain('Caso cerrado');
  });

  it('mantiene completos los ocho estados que alimentan el filtro visible', () => {
    const options = normalizeFilterOptions({});

    expect(options.estados.map((item) => item.label)).toEqual([
      'Analizar el caso',
      'Entrevistar al usuario',
      'Presentar solicitud',
      'Pendiente audiencia',
      'Pendiente decisión de audiencia',
      'Pendiente decisión',
      'Presentar recurso',
      'Caso cerrado',
    ]);
  });

  it('no selecciona automáticamente identidades ambiguas', () => {
    const options = [
      { id: 'CENTRO_1', label: 'CENTRO REPETIDO', valoresOriginales: [] },
      { id: 'CENTRO_2', label: 'CENTRO REPETIDO', valoresOriginales: [] },
    ];
    expect(resolveCentroByLabel('CENTRO REPETIDO', options)).toBeNull();
    expect(
      resolveDefensorIdByLabel('DEFENSOR REPETIDO', [
        { id: '1', label: 'DEFENSOR REPETIDO' },
        { id: '2', label: 'Defensor repetido' },
      ])
    ).toBe('');
  });

  it('normaliza todos los filtros visibles y excluye campos ajenos al contrato', () => {
    const source = Object.fromEntries(ASSIGNED_USERS_FILTER_KEYS.map((key) => [key, `  ${key}  `]));
    source.noAdmitido = 'valor';
    const filters = buildAssignedUsersFilters(source);
    expect(Object.keys(filters)).toEqual(ASSIGNED_USERS_FILTER_KEYS);
    ASSIGNED_USERS_FILTER_KEYS.forEach((key) => expect(filters[key]).toBe(key));
    expect(filters.noAdmitido).toBeUndefined();
  });

  it('resuelve un defensor por identidad única tolerando tildes y espacios', () => {
    expect(
      resolveDefensorIdByLabel('  josé   pérez ', [{ id: '123', label: 'JOSE PEREZ' }])
    ).toBe('123');
  });
});
