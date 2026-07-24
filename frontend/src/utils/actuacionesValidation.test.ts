import { describe, expect, it, vi } from 'vitest';
import {
  shouldBlockNuevaActuacion,
  shouldShowVirtualPendingActuacion,
} from './actuacionesValidation.js';

describe('validacion para crear una nueva actuacion', () => {
  it('permite crear la primera actuacion cuando el historial esta vacio', () => {
    const hasInfoDesdePregunta29 = vi.fn(() => false);

    expect(
      shouldBlockNuevaActuacion({
        flow: 'condenado',
        actuaciones: [],
        hasInfoDesdePregunta29,
      })
    ).toBe(false);
    expect(hasInfoDesdePregunta29).not.toHaveBeenCalled();
  });

  it('bloquea cuando la ultima actuacion real no tiene informacion desde la pregunta 29', () => {
    const incompleta = { registro: { id: 'incompleta' } };

    expect(
      shouldBlockNuevaActuacion({
        flow: 'condenado',
        actuaciones: [{ registro: { id: 'completa' } }, incompleta],
        hasInfoDesdePregunta29: (registro) => registro.id === 'completa',
      })
    ).toBe(true);
  });

  it('permite crear cuando la ultima actuacion real tiene informacion desde la pregunta 29', () => {
    const completa = { registro: { pregunta29: '2026-07-21' } };

    expect(
      shouldBlockNuevaActuacion({
        flow: 'condenado',
        actuaciones: [completa],
        hasInfoDesdePregunta29: (registro) => Boolean(registro.pregunta29),
      })
    ).toBe(false);
  });
});

describe('actuacion inicial pendiente', () => {
  it('muestra una fila virtual cuando existe el PPL pero no hay actuaciones reales', () => {
    expect(shouldShowVirtualPendingActuacion([], { numeroIdentificacion: '1000004983' })).toBe(true);
  });

  it('no agrega la fila virtual cuando ya existe una actuacion real', () => {
    expect(
      shouldShowVirtualPendingActuacion(
        [{ id: '1000004983-123', registro: { __oracleIdGestion: 123 } }],
        { numeroIdentificacion: '1000004983' }
      )
    ).toBe(false);
  });
});
