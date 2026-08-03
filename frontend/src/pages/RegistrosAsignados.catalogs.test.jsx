import { describe, expect, it } from 'vitest';
import {
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
