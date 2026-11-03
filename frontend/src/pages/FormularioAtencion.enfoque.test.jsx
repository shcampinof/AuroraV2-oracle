// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FormularioAtencion from './FormularioAtencion.jsx';
import { getPplByDocumento, updatePpl } from '../services/api.js';

const fixture = vi.hoisted(() => ({ record: null }));

vi.mock('../services/api.js', () => ({
  createPplActuacion: vi.fn(),
  getCondenadosFilterOptions: vi.fn().mockResolvedValue({}),
  getDefensoresCatalogo: vi.fn().mockResolvedValue([]),
  getPplActuacionesByDocumento: vi.fn().mockResolvedValue({ actuaciones: [] }),
  getPplByDocumento: vi.fn(),
  isQueuedResponse: () => false,
  updatePpl: vi.fn(),
}));
vi.mock('../services/authStorage.js', () => ({
  getStoredSession: () => ({ user: { id: 'enfoque-test' } }),
}));
vi.mock('../components/HistorialActuacionesPPL.jsx', () => ({
  default: ({ onSelectActuacion }) => (
    <button onClick={() => onSelectActuacion({ id: 'actuacion-17', registro: fixture.record })}>Abrir actuación</button>
  ),
}));

describe('enfoque diferencial importado de SISIPEC', () => {
  let root;
  let container;
  const key = 'Enfoque Étnico/Racial/Cultural';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T16:00:00Z'));
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => setTimeout(() => callback(0), 0));
    localStorage.clear();
    getPplByDocumento.mockReset();
    updatePpl.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ['condenado', 'Persona con discapacidad'],
    ['condenado', 'Indígena; Adulto mayor; Migrante'],
    ['sindicado', 'Indígena; Adulto mayor; Migrante'],
    ['condenado', 'indigena'],
  ])('muestra y conserva al guardar el enfoque %s: %s', async (tipo, enfoque) => {
    fixture.record = {
      numeroIdentificacion: '123',
      Nombre: 'Usuario de prueba',
      'Situación Jurídica': tipo === 'condenado' ? 'Condenado' : 'Sindicado',
      __oracleIdGestion: 17,
      [key]: enfoque,
    };
    getPplByDocumento.mockResolvedValue({ tipo, registro: fixture.record });
    updatePpl.mockImplementation(async (_doc, payload) => ({ tipo, registro: { ...fixture.record, ...payload.data } }));
    await act(async () => root.render(<FormularioAtencion numeroInicial="123" />));
    const open = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Abrir actuación');
    expect(open).toBeDefined();
    await act(async () => open.click());
    await act(async () => vi.advanceTimersByTimeAsync(0));

    const select = container.querySelector(`[name="${key}"]`);
    expect(select).not.toBeNull();
    expect(select.value).toBe(enfoque === 'indigena' ? 'Indígena' : enfoque);
    expect(select.selectedOptions[0].textContent).toBe(select.value);
    expect([...select.options].some((option) => option.value === 'Migrante')).toBe(true);

    const save = [...container.querySelectorAll('button')].find((button) => button.textContent === 'GUARDAR ENTREVISTA');
    await act(async () => save.click());
    expect(updatePpl).toHaveBeenCalledOnce();
    expect(updatePpl.mock.calls[0][1].data[key]).toBe(enfoque);
  });
});
