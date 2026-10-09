import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFormAutosaveContext,
  createScheduledAutosaveQueue,
  readFormAutosaveDraft,
  writeFormAutosaveDraft,
} from './formAutosave.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('planificación del autoguardado', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T16:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('no hace escrituras periódicas cuando no hay cambios', async () => {
    const save = vi.fn();
    const queue = createScheduledAutosaveQueue(save);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(save).not.toHaveBeenCalled();
    await queue.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('envía a los 30 segundos y agrupa todos los cambios de esa ventana', async () => {
    const save = vi.fn().mockResolvedValue('ok');
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    await vi.advanceTimersByTimeAsync(10000);
    queue.enqueue({ version: 2 });
    await vi.advanceTimersByTimeAsync(19999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledExactlyOnceWith({ version: 2 });
    await vi.advanceTimersByTimeAsync(90000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('la escritura continua no aplaza indefinidamente el envío', async () => {
    const save = vi.fn().mockResolvedValue('ok');
    const queue = createScheduledAutosaveQueue(save);
    for (let version = 1; version <= 90; version += 1) {
      queue.enqueue({ version });
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(save.mock.calls.map(([job]) => job.version)).toEqual([30, 60, 90]);
  });

  it('espera 30 segundos después de un envío lento antes de enviar los cambios nuevos', async () => {
    const first = deferred();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue('ok');
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    await vi.advanceTimersByTimeAsync(30000);
    queue.enqueue({ version: 2 });
    await vi.advanceTimersByTimeAsync(90000);
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve('ok');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(29999);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenLastCalledWith({ version: 2 });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('un guardado explícito envía inmediatamente y cancela el envío programado', async () => {
    const save = vi.fn().mockResolvedValue('ok');
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    await expect(queue.flush()).resolves.toBe('ok');
    expect(save).toHaveBeenCalledExactlyOnceWith({ version: 1 });
    await vi.advanceTimersByTimeAsync(60000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('el guardado explícito espera el envío automático y vacía los cambios posteriores', async () => {
    const first = deferred();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue('último');
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    await vi.advanceTimersByTimeAsync(30000);
    queue.enqueue({ version: 2 });
    const manual = queue.flush();
    const secondManual = queue.flush();
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve('primero');
    await expect(Promise.all([manual, secondManual])).resolves.toEqual(['último', 'último']);
    expect(save.mock.calls.map(([job]) => job.version)).toEqual([1, 2]);
    expect(queue.hasPending()).toBe(false);
    await vi.advanceTimersByTimeAsync(60000);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('espacia reintentos a 30, 60, 120, 240 y como máximo 300 segundos', async () => {
    const save = vi.fn().mockRejectedValue(new Error('servidor ocupado'));
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    await vi.advanceTimersByTimeAsync(30000);
    expect(save).toHaveBeenCalledTimes(1);
    for (const [index, delay] of [30000, 60000, 120000, 240000, 300000, 300000].entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(save).toHaveBeenCalledTimes(index + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(save).toHaveBeenCalledTimes(index + 2);
    }
    expect(queue.hasPending()).toBe(true);
  });

  it('los cambios nuevos no evitan la espera de un reintento y se conserva el más reciente', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValue('ok');
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    await vi.advanceTimersByTimeAsync(30000);
    for (let version = 2; version <= 30; version += 1) {
      queue.enqueue({ version });
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ version: 30 });
  });

  it('vuelve a la frecuencia normal después de recuperarse de un fallo', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('red'))
      .mockRejectedValueOnce(new Error('red'))
      .mockResolvedValue('ok');
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    await vi.advanceTimersByTimeAsync(120000);
    expect(save).toHaveBeenCalledTimes(3);
    queue.enqueue({ version: 2 });
    await vi.advanceTimersByTimeAsync(30000);
    expect(save).toHaveBeenCalledTimes(4);
  });

  it('cambiar de pestaña no adelanta reintentos después de un fallo', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValue('ok');
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    await vi.advanceTimersByTimeAsync(30000);
    for (let index = 0; index < 20; index += 1) {
      await queue.flush({ respectBackoff: true });
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('un guardado manual permite reintentar de inmediato aunque haya espera automática', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValue('ok');
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    await vi.advanceTimersByTimeAsync(30000);
    await expect(queue.flush()).resolves.toBe('ok');
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('deja cancelar un cambio revertido sin escrituras posteriores', async () => {
    const save = vi.fn();
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ context: { key: 'caso-1' } });
    expect(queue.dropPending((job) => job.context.key === 'caso-2')).toBe(false);
    expect(queue.dropPending((job) => job.context.key === 'caso-1')).toBe(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(save).not.toHaveBeenCalled();
  });

  it('limpiar la cola cancela la temporización y permite nuevos cambios', async () => {
    const save = vi.fn().mockResolvedValue('ok');
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    queue.clear();
    await vi.advanceTimersByTimeAsync(60000);
    expect(save).not.toHaveBeenCalled();
    queue.enqueue({ version: 2 });
    await vi.advanceTimersByTimeAsync(30000);
    expect(save).toHaveBeenCalledExactlyOnceWith({ version: 2 });
  });

  it('al navegar envía lo pendiente inmediatamente y no deja temporizadores activos', async () => {
    const save = vi.fn().mockResolvedValue('ok');
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    await queue.dispose({ flush: true });
    queue.enqueue({ version: 2 });
    await vi.advanceTimersByTimeAsync(60000);
    expect(save).toHaveBeenCalledExactlyOnceWith({ version: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('al navegar durante un envío incluye el último cambio sin escrituras paralelas', async () => {
    const first = deferred();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue('ok');
    const queue = createScheduledAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    await vi.advanceTimersByTimeAsync(30000);
    queue.enqueue({ version: 2 });
    const leaving = queue.dispose({ flush: true });
    first.resolve('ok');
    await leaving;
    expect(save.mock.calls.map(([job]) => job.version)).toEqual([1, 2]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('conserva el borrador local si falla el envío al navegar', async () => {
    const values = new Map();
    const storage = {
      setItem: (key, value) => values.set(key, value),
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
    };
    const context = buildFormAutosaveContext({ subject: 'usuario', documento: '123', gestionId: 1 });
    writeFormAutosaveDraft(storage, context, { campo: 'último valor' });
    const queue = createScheduledAutosaveQueue(vi.fn().mockRejectedValue(new Error('sin red')));
    queue.enqueue({ context, data: { campo: 'último valor' } });
    await expect(queue.dispose({ flush: true })).rejects.toThrow('sin red');
    expect(readFormAutosaveDraft(storage, context).data).toEqual({ campo: 'último valor' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('con 100 usuarios editando durante tres minutos limita envíos y evita solaparlos', async () => {
    const clients = Array.from({ length: 100 }, () => {
      let inFlight = 0;
      let maxInFlight = 0;
      const save = vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        inFlight -= 1;
      });
      return { queue: createScheduledAutosaveQueue(save), save, maxInFlight: () => maxInFlight };
    });
    for (let version = 1; version <= 180; version += 1) {
      clients.forEach(({ queue }) => queue.enqueue({ version }));
      await vi.advanceTimersByTimeAsync(1000);
    }
    clients.forEach(({ save, maxInFlight }) => {
      expect(save).toHaveBeenCalledTimes(5);
      expect(maxInFlight()).toBe(1);
    });
    await Promise.all(clients.map(({ queue }) => queue.dispose()));
    expect(vi.getTimerCount()).toBe(0);
  });
});
