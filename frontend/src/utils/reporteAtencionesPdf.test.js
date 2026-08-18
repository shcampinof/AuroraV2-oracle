import { describe, expect, it } from 'vitest';
import { formatReportDate, sanitizeReportFilePart } from './reporteAtencionesPdf.js';

describe('utilidades del PDF de atenciones', () => {
  it('presenta las fechas ISO en el formato institucional', () => {
    expect(formatReportDate('2026-08-14')).toBe('14/08/2026');
  });

  it('crea nombres de archivo portables conservando la identidad legible', () => {
    expect(sanitizeReportFilePart('José  Pérez / Regional')).toBe('Jose_Perez_Regional');
  });
});
