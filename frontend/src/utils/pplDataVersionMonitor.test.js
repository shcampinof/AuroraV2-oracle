import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startPplDataVersionMonitor } from './pplDataVersionMonitor.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('comprobación de cambios de datos PPL', () => {
  let documentTarget;
  let loadVersion;
  let onChange;
  let onError;
  let stop;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T16:00:00Z'));
    documentTarget = new EventTarget();
    documentTarget.visibilityState = 'visible';
    loadVersion = vi.fn().mockResolvedValue({ version: 1 });
    onChange = vi.fn();
    onError = vi.fn();
  });
  afterEach(() => {
    stop?.();
    stop = null;
    vi.useRealTimers();
  });

  async function start(random = () => 0) {
    stop = startPplDataVersionMonitor({ documentTarget, loadVersion, onChange, onError, random });
    await vi.advanceTimersByTimeAsync(0);
  }

  function visibility(value) {
    documentTarget.visibilityState = value;
    documentTarget.dispatchEvent(new Event('visibilitychange'));
  }

  it('toma una referencia inicial y consulta cada 30 segundos sin eventos si no hay cambios', async () => {
    await start();
    expect(loadVersion).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(29999);
    expect(loadVersion).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadVersion).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emite un único evento al cambiar la versión y detecta también un reinicio del servidor', async () => {
    await start();
    loadVersion.mockResolvedValue({ version: 2 });
    await vi.advanceTimersByTimeAsync(60000);
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ version: 2 });
    loadVersion.mockResolvedValue({ version: 0 });
    await vi.advanceTimersByTimeAsync(30000);
    expect(onChange).toHaveBeenLastCalledWith({ version: 0 });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('espera a que termine una consulta lenta y no acumula consultas', async () => {
    const first = deferred();
    loadVersion.mockReturnValueOnce(first.promise);
    await start();
    await vi.advanceTimersByTimeAsync(120000);
    visibility('visible');
    expect(loadVersion).toHaveBeenCalledTimes(1);
    first.resolve({ version: 1 });
    await vi.advanceTimersByTimeAsync(29999);
    expect(loadVersion).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadVersion).toHaveBeenCalledTimes(2);
  });

  it('no consulta una pestaña oculta y retoma al volver sin ráfagas', async () => {
    await start();
    visibility('hidden');
    await vi.advanceTimersByTimeAsync(120000);
    expect(loadVersion).toHaveBeenCalledTimes(1);
    visibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(loadVersion).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('cambiar rápidamente de pestaña respeta el intervalo mínimo', async () => {
    await start();
    for (let index = 0; index < 20; index += 1) {
      visibility('hidden');
      visibility('visible');
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(loadVersion).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(loadVersion).toHaveBeenCalledTimes(2);
  });

  it('si empieza oculta espera hasta que sea visible', async () => {
    visibility('hidden');
    await start();
    await vi.advanceTimersByTimeAsync(60000);
    expect(loadVersion).not.toHaveBeenCalled();
    visibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(loadVersion).toHaveBeenCalledTimes(1);
  });

  it('aumenta la espera ante fallos y vuelve a 30 segundos después de recuperarse', async () => {
    loadVersion.mockRejectedValue(new Error('red'));
    await start();
    for (const [index, delay] of [60000, 120000, 240000, 300000, 300000].entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(loadVersion).toHaveBeenCalledTimes(index + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(loadVersion).toHaveBeenCalledTimes(index + 2);
    }
    expect(onChange).not.toHaveBeenCalled();
    loadVersion.mockResolvedValue({ version: 3 });
    await vi.advanceTimersByTimeAsync(300000);
    await vi.advanceTimersByTimeAsync(30000);
    expect(loadVersion).toHaveBeenCalledTimes(8);
    expect(onChange).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(6);
  });

  it('recuerda la última versión válida a través de un error', async () => {
    await start();
    loadVersion.mockRejectedValueOnce(new Error('red')).mockResolvedValue({ version: 2 });
    await vi.advanceTimersByTimeAsync(30000);
    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60000);
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ version: 2 });
  });

  it('distribuye las consultas entre 30 y 35 segundos', async () => {
    await start(() => 0.8);
    await vi.advanceTimersByTimeAsync(33999);
    expect(loadVersion).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadVersion).toHaveBeenCalledTimes(2);
  });

  it('ignora respuestas y fallos posteriores a la salida', async () => {
    await start();
    const update = deferred();
    loadVersion.mockReturnValueOnce(update.promise);
    await vi.advanceTimersByTimeAsync(30000);
    stop();
    update.reject(new Error('respuesta tardía'));
    await vi.advanceTimersByTimeAsync(60000);
    visibility('visible');
    expect(loadVersion).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('100 sesiones en cinco minutos reducen comprobaciones y distribuyen el segundo ciclo', async () => {
    const clients = Array.from({ length: 100 }, (_, index) => {
      const load = vi.fn().mockResolvedValue({ version: 1 });
      const close = startPplDataVersionMonitor({
        documentTarget: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
        loadVersion: load,
        onChange,
        random: () => index / 100,
      });
      return { load, close };
    });
    await vi.advanceTimersByTimeAsync(31000);
    const secondCycle = clients.filter(({ load }) => load.mock.calls.length === 2);
    expect(secondCycle.length).toBe(21);
    await vi.advanceTimersByTimeAsync(269000);
    clients.forEach(({ load, close }) => {
      expect(load.mock.calls.length).toBeLessThanOrEqual(11);
      close();
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
