import { describe, expect, it, vi } from 'vitest';
import {
  FORM_AUTOSAVE_DRAFT_TTL_MS,
  buildFormAutosaveContext,
  createCoalescingAutosaveQueue,
  readFormAutosaveDraft,
  removeFormAutosaveDraft,
  writeFormAutosaveDraft,
} from './formAutosave';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe('formAutosave', () => {
  it('aísla el borrador por usuario, documento y actuación', () => {
    const one = buildFormAutosaveContext({ subject: 'a', documento: '123', gestionId: 10 });
    const two = buildFormAutosaveContext({ subject: 'b', documento: '123', gestionId: 10 });
    const three = buildFormAutosaveContext({ subject: 'a', documento: '123', gestionId: 11 });
    expect(new Set([one.key, two.key, three.key]).size).toBe(3);
  });

  it('guarda, recupera, elimina y descarta borradores vencidos', () => {
    const storage = memoryStorage();
    const context = buildFormAutosaveContext({ subject: 'a', documento: '123', gestionId: 10 });
    expect(writeFormAutosaveDraft(storage, context, { campo: 'valor' }, 100)).toBe(true);
    expect(readFormAutosaveDraft(storage, context, 101)?.data).toEqual({ campo: 'valor' });
    expect(readFormAutosaveDraft(storage, context, 100 + FORM_AUTOSAVE_DRAFT_TTL_MS + 1)).toBeNull();
    expect(writeFormAutosaveDraft(storage, context, { campo: 'otro' }, 200)).toBe(true);
    expect(removeFormAutosaveDraft(storage, context)).toBe(true);
    expect(readFormAutosaveDraft(storage, context, 201)).toBeNull();
  });

  it('serializa las escrituras y compacta cambios intermedios', async () => {
    let releaseFirst;
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
    const saved = [];
    const save = vi.fn(async (job) => {
      saved.push(job.version);
      if (job.version === 1) await firstGate;
      return job.version;
    });
    const queue = createCoalescingAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    const flushing = queue.flush();
    await Promise.resolve();
    queue.enqueue({ version: 2 });
    queue.enqueue({ version: 3 });
    releaseFirst();
    await flushing;
    expect(saved).toEqual([1, 3]);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('conserva el trabajo después de un error para poder reintentarlo', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('red'))
      .mockResolvedValueOnce('ok');
    const queue = createCoalescingAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    await expect(queue.flush()).rejects.toThrow('red');
    expect(queue.hasPending()).toBe(true);
    await expect(queue.flush()).resolves.toBe('ok');
    expect(queue.hasPending()).toBe(false);
  });

  it('comparte un único envío cuando se solicita guardar varias veces en paralelo', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const save = vi.fn(async () => {
      await gate;
      return 'ok';
    });
    const queue = createCoalescingAutosaveQueue(save);
    queue.enqueue({ version: 1 });

    const firstFlush = queue.flush();
    const secondFlush = queue.flush();
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);

    release();
    await expect(Promise.all([firstFlush, secondFlush])).resolves.toEqual(['ok', 'ok']);
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.hasPending()).toBe(false);
  });

  it('prioriza el cambio más reciente si llega mientras falla un envío anterior', async () => {
    let releaseFirst;
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
    const saved = [];
    const save = vi.fn(async (job) => {
      saved.push(job.version);
      if (job.version === 1) {
        await firstGate;
        throw new Error('red');
      }
      return job.version;
    });
    const queue = createCoalescingAutosaveQueue(save);
    queue.enqueue({ version: 1 });
    const firstFlush = queue.flush();
    await Promise.resolve();
    queue.enqueue({ version: 2 });
    releaseFirst();

    await expect(firstFlush).rejects.toThrow('red');
    expect(queue.hasPending()).toBe(true);
    await expect(queue.flush()).resolves.toBe(2);
    expect(saved).toEqual([1, 2]);
    expect(queue.hasPending()).toBe(false);
  });

  it('permite descartar solo el trabajo pendiente del contexto indicado', () => {
    const queue = createCoalescingAutosaveQueue(vi.fn());
    queue.enqueue({ context: { key: 'caso-1' } });
    expect(queue.dropPending((job) => job.context.key === 'caso-2')).toBe(false);
    expect(queue.hasPending()).toBe(true);
    expect(queue.dropPending((job) => job.context.key === 'caso-1')).toBe(true);
    expect(queue.hasPending()).toBe(false);
  });
});
