import { describe, expect, it } from 'vitest';
import { buildAsignacionBackendFilters } from '../utils/asignacionDefensores.js';

describe('filtros de asignación de defensores PAG', () => {
  it('busca únicamente casos asignados al defensor en Eliminar asignaciones', () => {
    expect(
      buildAsignacionBackendFilters('eliminarAsignaciones', {
        defensorActual: '  LUIS CAMARGO  ',
        documento: ' 12345 ',
      })
    ).toMatchObject({
      defensor: 'LUIS CAMARGO',
      documento: '12345',
      asignacionEstado: 'con_defensor',
    });
  });

  it('mantiene separadas la asignación inicial y la gestión de asignaciones existentes', () => {
    expect(buildAsignacionBackendFilters('asignacion', { defensorActual: 'LUIS CAMARGO' }))
      .toMatchObject({ defensor: '', asignacionEstado: 'sin_defensor' });
    expect(buildAsignacionBackendFilters('reasignacion', { defensorActual: 'LUIS CAMARGO' }))
      .toMatchObject({ defensor: 'LUIS CAMARGO', asignacionEstado: 'con_defensor' });
  });
});
