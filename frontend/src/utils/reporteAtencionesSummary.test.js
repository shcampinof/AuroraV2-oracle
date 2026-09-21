import { describe, expect, it } from 'vitest';

import { calculateTotalActuaciones } from './reporteAtencionesSummary.js';

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
