import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadReporteAtencionesPdf, formatReportDate, sanitizeReportFilePart } from './reporteAtencionesPdf.js';

const pdfState = vi.hoisted(() => ({ documents: [] }));

vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    jsPDF: function (options) {
      const pdf = new actual.jsPDF(options);
      pdf.save = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(pdf, 'text');
      pdfState.documents.push(pdf);
      return pdf;
    },
  };
});

const report = {
  metadata: { defensor: 'Defensor de prueba', regional: 'QUINDIO', fechaInicio: '2025-01-01', fechaFin: '2026-10-27' },
  resumen: {},
  detalles: { casosAnalizados: [], entrevistas: [], solicitudes: [], reiteraciones: [], recursos: [], casosCerrados: [], casosAsignados: [] },
};

afterEach(() => {
  pdfState.documents.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('utilidades del PDF de atenciones', () => {
  it('presenta las fechas ISO en el formato institucional', () => {
    expect(formatReportDate('2026-08-14')).toBe('14/08/2026');
  });

  it('crea nombres de archivo portables conservando la identidad legible', () => {
    expect(sanitizeReportFilePart('José  Pérez / Regional')).toBe('Jose_Perez_Regional');
  });

  it('descarga un PDF válido aunque los logos no respondan', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', class {});
    const download = downloadReporteAtencionesPdf(report);
    const pdf = pdfState.documents[0];
    expect(pdf.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    await download;
    expect(pdf.save).toHaveBeenCalledWith('reporte_atenciones_Defensor_de_prueba_20250101_20261027.pdf', { returnPromise: true });
    expect(pdf.output()).toMatch(/^%PDF-/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('continúa la descarga si el navegador no puede convertir un logo', async () => {
    vi.stubGlobal('Image', class {
      set src(value) {
        this.url = value;
        Promise.resolve().then(() => this.onload());
      }
    });
    const canvas = { getContext: () => ({ drawImage() {} }), toDataURL: () => { throw new Error('Canvas no disponible'); } };
    vi.stubGlobal('document', { createElement: () => canvas });
    await downloadReporteAtencionesPdf(report);
    expect(pdfState.documents[0].save).toHaveBeenCalledOnce();
  });

  it('propaga errores al guardar para que la pantalla pueda informar el fallo', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', class {});
    const download = downloadReporteAtencionesPdf(report);
    pdfState.documents[0].save.mockRejectedValue(new Error('Descarga bloqueada'));
    const rejection = expect(download).rejects.toThrow('Descarga bloqueada');
    await vi.advanceTimersByTimeAsync(5000);
    await rejection;
  });

  it('conserva el formato antiguo y vincula cada indicador a su campo original', async () => {
    await downloadReporteAtencionesPdf({
      ...report,
      resumen: {
        casosAnalizados: 12, entrevistasRealizadas: 8, solicitudesPresentadas: 4,
        reiteracionesPresentadas: 2, recursosPresentados: 1, casosCerrados: 6,
        personasAsignadas: 90, personasActivas: 29, personasActivasConGestion: 7,
        personasConCasoCerrado: 5, totalPersonasConCasosCerrados: 61,
      },
    });
    const texts = pdfState.documents[0].text.mock.calls.map(([value]) => Array.isArray(value) ? value.join(' ') : value);
    expect(texts).toContain('REPORTE GENERAL DEL PERÍODO SELECCIONADO');
    const originalRows = [
      ['1.1. Número de casos analizados', '12'],
      ['1.2. Número de entrevistas realizadas', '8'],
      ['1.3. Número de solicitudes presentadas', '4'],
      ['1.4. Número de reiteraciones presentadas', '2'],
      ['1.5. Número de recursos presentados', '1'],
      ['1.6. Número de casos cerrados durante el periodo', '6'],
      ['1.7. Número total de actuaciones adelantadas en el periodo', '27'],
      ['2.1. Número de personas asignadas al defensor público', '90'],
      ['2.2. Número de personas activas (asignadas que aún no se han cerrado)', '29'],
      ['2.3. Número de personas activas que reportan alguna gestión de atención jurídica durante el periodo', '7'],
      ['2.4. Número de personas a quienes se les cerró el caso durante el periodo', '5'],
      ['2.6. Número total de personas con casos cerrados', '61'],
    ];
    let previous = -1;
    for (const [label, value] of originalRows) {
      const index = texts.indexOf(label);
      expect(index).toBeGreaterThan(previous);
      expect(texts[index + 1]).toBe(value);
      previous = index;
    }
    expect(texts).toContain('2. Conteo total de personas con actuaciones durante el periodo');
    expect(texts).not.toContain('RESUMEN DEL REPORTE');
    expect(texts.some(text => /^(1\.8\.|2\.5\.)/.test(text))).toBe(false);
    expect(texts.some(text => text.startsWith('Detalle de cierres jurídicos'))).toBe(false);
  });
});
