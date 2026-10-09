// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { getPplDataVersion, invalidateCondenadosClientCache, PPL_DATA_UPDATED_EVENT } from './services/api.js';

vi.mock('./services/auth.js', () => ({
  getAuthConfig: vi.fn().mockResolvedValue({}),
  completeAzureAdRedirect: vi.fn().mockResolvedValue(null),
  refreshSession: vi.fn().mockResolvedValue({ user: { id: 'tester', roles: ['user'] } }),
  logout: vi.fn(),
}));
vi.mock('./services/api.js', async (importOriginal) => ({
  ...await importOriginal(),
  getCondenadosFilterOptions: vi.fn().mockResolvedValue({}),
  getPplDataVersion: vi.fn(),
  invalidateCondenadosClientCache: vi.fn(),
}));
vi.mock('./pages/Home.jsx', () => ({ default: () => <p>Inicio</p> }));

describe('comprobación de cambios integrada en App', () => {
  let root;
  let container;
  let listener;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    getPplDataVersion.mockReset().mockResolvedValue({ version: 1 });
    invalidateCondenadosClientCache.mockReset();
    window.location.hash = '/inicio';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    listener = vi.fn();
    window.addEventListener(PPL_DATA_UPDATED_EVENT, listener);
    await act(async () => root.render(<App />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    window.removeEventListener(PPL_DATA_UPDATED_EVENT, listener);
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function accept() {
    const button = [...container.querySelectorAll('button')].find((item) => item.textContent === 'Aceptar y continuar');
    await act(async () => button.click());
  }

  it('empieza tras aceptar las condiciones, respeta 30 segundos y emite cambios conservando la caché hasta entonces', async () => {
    await act(async () => vi.advanceTimersByTimeAsync(60000));
    expect(getPplDataVersion).not.toHaveBeenCalled();
    await accept();
    expect(getPplDataVersion).toHaveBeenCalledTimes(1);
    expect(invalidateCondenadosClientCache).not.toHaveBeenCalled();
    getPplDataVersion.mockResolvedValue({ version: 2 });
    await act(async () => vi.advanceTimersByTimeAsync(29999));
    expect(getPplDataVersion).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(getPplDataVersion).toHaveBeenCalledTimes(2);
    expect(invalidateCondenadosClientCache).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toEqual({ version: 2 });
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(invalidateCondenadosClientCache).toHaveBeenCalledTimes(1);
  });

  it('al desmontar la aplicación detiene las comprobaciones', async () => {
    await accept();
    expect(getPplDataVersion).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    await act(async () => vi.advanceTimersByTimeAsync(120000));
    expect(getPplDataVersion).toHaveBeenCalledTimes(1);
  });
});
