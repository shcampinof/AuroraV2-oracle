// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReporteAtencionesDefensores from './ReporteAtencionesDefensores.jsx';
import { getReporteAtencionesDefensores, getReporteAtencionesOpciones } from '../services/api.js';

vi.mock('../services/api.js', () => ({
  getReporteAtencionesDefensores: vi.fn(),
  getReporteAtencionesOpciones: vi.fn(),
}));

describe('alcance del reporte de gestión', () => {
  let container;
  let root;
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    getReporteAtencionesOpciones.mockResolvedValue({
      defensores: [{ id: '1', nombre: 'DEFENSOR PRUEBA', regional: 'CUNDINAMARCA' }],
      regionales: ['CUNDINAMARCA'], establecimientos: ['CPMS GIRARDOT'],
    });
    getReporteAtencionesDefensores.mockResolvedValue(null);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<ReporteAtencionesDefensores user={{ name: 'DEFENSOR PRUEBA' }} />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  function inputFor(label) {
    return [...container.querySelectorAll('label')].find((item) => item.textContent.includes(label)).querySelector('input, select');
  }
  async function fill(label, value) {
    const input = inputFor(label);
    await act(async () => {
      const prototype = input.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
  }
  async function submit() {
    await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  }
  it('envía tipo, establecimiento y fechas para comparar con el listado de condenados', async () => {
    await fill('Tipo de caso', 'condenado');
    await fill('Establecimiento', 'CPMS GIRARDOT');
    await fill('Fecha inicio', '2025-01-01');
    await fill('Fecha final', '2026-10-19');
    await submit();
    expect(getReporteAtencionesDefensores).toHaveBeenCalledWith(expect.objectContaining({
      defensorId: '1', tipo: 'condenado', lugar: 'CPMS GIRARDOT', incluirFueraPrision: false,
      fechaInicio: '2025-01-01', fechaFin: '2026-10-19',
    }));
  });
  it('requiere selección explícita para incluir situaciones inactivas y la restablece al elegir condenados', async () => {
    const checkbox = inputFor('Incluir personas');
    expect(checkbox.checked).toBe(false);
    await act(async () => checkbox.click());
    await submit();
    expect(getReporteAtencionesDefensores).toHaveBeenLastCalledWith(expect.objectContaining({ incluirFueraPrision: true, tipo: 'all' }));
    await fill('Tipo de caso', 'condenado');
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(true);
    await submit();
    expect(getReporteAtencionesDefensores).toHaveBeenLastCalledWith(expect.objectContaining({ incluirFueraPrision: false, tipo: 'condenado' }));
  });
});
