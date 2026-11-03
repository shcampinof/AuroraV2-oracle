// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HistorialActuacionesPPL from './HistorialActuacionesPPL.jsx';
import { getPplActuacionesByDocumento } from '../services/api.js';

vi.mock('../services/api.js', () => ({ getPplActuacionesByDocumento: vi.fn() }));
const cierre = {
  idGestion: 10, idSituacion: 20,
  motivo: 'Cierre automático por cambio de regional.',
  defensor: 'DEFENSORA ANTERIOR', establecimiento: 'ERON ANTERIOR',
  departamento: 'CUNDINAMARCA', fechaCierre: '2026-10-19',
};

describe('cierres automáticos en el historial', () => {
  let root;
  let container;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  async function render(documento = '123') {
    await act(async () => root.render(<HistorialActuacionesPPL
      numeroDocumento={documento}
      registro={{ numeroIdentificacion: documento, __situacionActiva: true, estadoCodigo: 'ANALIZAR_CASO' }}
    />));
  }
  it('muestra el cierre anterior aunque la nueva situación todavía no tenga actuaciones', async () => {
    getPplActuacionesByDocumento.mockResolvedValue({ actuaciones: [], cierresAutomaticos: [cierre] });
    await render();
    const aviso = container.querySelector('.historial-cierre-automatico');
    expect(aviso.textContent).toContain(cierre.motivo);
    expect(aviso.textContent).toContain('DEFENSORA ANTERIOR');
    expect(aviso.textContent).toContain('ERON anterior: ERON ANTERIOR');
    expect(aviso.textContent).toContain('Fecha de cierre: 19/10/2026');
    expect(container.querySelector('.tabla-historial-actuaciones').textContent).toContain('Analizar el caso');
    expect(container.querySelector('.tabla-historial-actuaciones').textContent).not.toContain('Caso cerrado');
  });
  it('no inventa una fecha para cierres anteriores sin asignación vinculada', async () => {
    getPplActuacionesByDocumento.mockResolvedValue({ actuaciones: [], cierresAutomaticos: [{ ...cierre, fechaCierre: null }] });
    await render();
    expect(container.textContent).toContain(cierre.motivo);
    expect(container.textContent).not.toContain('Fecha de cierre:');
  });
  it('retira el cierre anterior al consultar otro documento', async () => {
    getPplActuacionesByDocumento.mockResolvedValueOnce({ actuaciones: [], cierresAutomaticos: [cierre] })
      .mockResolvedValueOnce({ actuaciones: [] });
    await render();
    expect(container.textContent).toContain(cierre.motivo);
    await render('456');
    expect(container.querySelector('.historial-cierre-automatico')).toBeNull();
  });
});
