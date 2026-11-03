import { describe, expect, it } from 'vitest';

import { calculateTotalActuaciones, getReporteAtencionesScopeNote } from './reporteAtencionesSummary.js';

describe('calculateTotalActuaciones', () => {
  it('mantiene los casos cerrados fuera del total mostrado', () => {
    expect(calculateTotalActuaciones({
      casosAnalizados: 20,
      entrevistasRealizadas: 16,
      solicitudesPresentadas: 12,
      reiteracionesPresentadas: 10,
      recursosPresentados: 8,
      casosCerrados: 22,
      totalActuaciones: 66,
    })).toBe(66);
  });

  it('tolera valores numéricos serializados y campos ausentes', () => {
    expect(calculateTotalActuaciones({ casosAnalizados: '3', casosCerrados: '2' })).toBe(3);
  });
});

describe('alcance regional del reporte', () => {
  it('limita tanto condenados como sindicados a la regional seleccionada', () => {
    expect(getReporteAtencionesScopeNote({ regional: 'QUINDIO', lugar: '  ' })).toBe('Casos de personas condenadas y sindicadas asociados a la regional seleccionada.');
  });
  it('indica el alcance por ERON y omite la aclaración sin regional seleccionada', () => {
    expect(getReporteAtencionesScopeNote({ regional: 'QUINDIO', lugar: 'CPMS ARMENIA' })).toContain('asociados al ERON seleccionado');
    expect(getReporteAtencionesScopeNote()).toBe('');
  });
  it('explica que los casos sin regional no se suman a ninguna regional', () => {
    expect(getReporteAtencionesScopeNote({ regional: 'Sin regional identificada' })).toContain('Se consultan por separado y no se suman a ninguna regional.');
  });
});
