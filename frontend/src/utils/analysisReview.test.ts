import { describe, expect, it } from 'vitest';
import { getNuevaFechaAnalisisAurora, getLimitesNuevaFechaAnalisis, getErrorNuevaFechaAnalisis } from '../config/formRules.aurora';

const closed = {
  'Fecha de análisis jurídico del caso': '2026-05-20',
  'Procedencia de libertad condicional': 'No cumple requisitos objetivos',
  'Procedencia de prisión domiciliaria de mitad de pena': 'No aplica',
  'Procedencia de pena cumplida': 'No',
  'Procedencia de acumulación de penas': 'No',
  'Otras solicitudes a tramitar': 'Ninguna',
};

describe('revisión de análisis sin procedencias', () => {
  const now = new Date('2026-11-23T16:00:00Z');
  it('exige una selección explícita y conserva la fecha elegida', () => {
    expect(getNuevaFechaAnalisisAurora(closed)).toBe('');
    expect(getErrorNuevaFechaAnalisis(closed, now)).toContain('obligatoria');
    for (const date of ['2026-11-23', '2027-01-15', '2027-05-23']) {
      const record = { ...closed, 'Nueva fecha de análisis': date };
      expect(getNuevaFechaAnalisisAurora(record)).toBe(date);
      expect(getErrorNuevaFechaAnalisis(record, now)).toBe('');
    }
    for (const date of ['2026-11-22', '2027-05-24', '2027-02-30', 'invalid']) {
      expect(getErrorNuevaFechaAnalisis({ ...closed, 'Nueva fecha de análisis': date }, now)).toContain('máximo seis meses');
    }
  });
  it.each([
    ['2026-08-31T16:00:00Z', '2026-08-31', '2027-02-28'],
    ['2023-08-31T16:00:00Z', '2023-08-31', '2024-02-29'],
    ['2026-11-24T04:59:00Z', '2026-11-23', '2027-05-23'],
    ['2026-11-24T05:00:00Z', '2026-11-24', '2027-05-24'],
  ])('limita a seis meses calendario con el día de Bogotá: %s', (instant, min, max) => {
    expect(getLimitesNuevaFechaAnalisis(new Date(instant))).toEqual({ min, max });
  });
  it('no programa revisiones por respuestas incompletas, positivas o cierres manuales', () => {
    for (const patch of [
      { 'Procedencia de pena cumplida': '' }, { 'Procedencia de pena cumplida': 'Sí' },
      { 'Otras solicitudes a tramitar': 'Redención de pena' },
      { 'Cierre del caso por imposibilidad de avanzar (si aplica)': 'Otro motivo.' },

    ]) expect(getNuevaFechaAnalisisAurora({ ...closed, 'Nueva fecha de análisis': '2027-01-15', ...patch })).toBe('');
  });
});
