import { describe, expect, it } from 'vitest';
import { getEstadoReclusion, isSituacionActiva } from './pplStatus.js';

describe('estado de reclusión', () => {
  it('interpreta ACTIVO=0 como fuera de prisión', () => {
    expect(isSituacionActiva({ __activoSituacion: 0 })).toBe(false);
    expect(getEstadoReclusion({ situacionActiva: false })).toBe('FUERA DE PRISIÓN');
  });

  it('interpreta ACTIVO=1 como persona en prisión', () => {
    expect(isSituacionActiva({ __activoSituacion: 1 })).toBe(true);
    expect(getEstadoReclusion({ situacionActiva: true })).toBe('EN PRISIÓN');
  });
});
