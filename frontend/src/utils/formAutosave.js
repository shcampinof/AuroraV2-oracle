export const FORM_AUTOSAVE_DEBOUNCE_MS = 1800;
export const FORM_AUTOSAVE_RETRY_MS = 10000;
export const FORM_AUTOSAVE_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function safePart(value) {
  return encodeURIComponent(String(value ?? '').trim() || 'sin-valor');
}

export function buildFormAutosaveContext({ subject, documento, gestionId, actuacionId } = {}) {
  const doc = String(documento ?? '').replace(/\D+/g, '');
  if (!doc) return null;
  const gestion = String(gestionId ?? '').trim();
  const actuacion = String(actuacionId ?? '').trim();
  const row = gestion || actuacion || 'actual';
  const key = `aurora.form-draft.v1:${safePart(subject)}:${safePart(doc)}:${safePart(row)}`;
  return { key, documento: doc, gestionId: gestion, actuacionId: actuacion, row };
}

export function writeFormAutosaveDraft(storage, context, data, now = Date.now()) {
  if (!storage || !context?.key || !data || typeof data !== 'object') return false;
  try {
    storage.setItem(context.key, JSON.stringify({
      schemaVersion: 1,
      documento: context.documento,
      gestionId: context.gestionId,
      actuacionId: context.actuacionId,
      updatedAt: Number(now),
      data,
    }));
    return true;
  } catch {
    return false;
  }
}

export function readFormAutosaveDraft(storage, context, now = Date.now()) {
  if (!storage || !context?.key) return null;
  try {
    const raw = storage.getItem(context.key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const updatedAt = Number(parsed?.updatedAt || 0);
    const expired = !updatedAt || Number(now) - updatedAt > FORM_AUTOSAVE_DRAFT_TTL_MS;
    if (
      parsed?.schemaVersion !== 1 ||
      parsed?.documento !== context.documento ||
      !parsed?.data ||
      typeof parsed.data !== 'object' ||
      expired
    ) {
      storage.removeItem(context.key);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(context.key);
    return null;
  }
}

export function removeFormAutosaveDraft(storage, context) {
  if (!storage || !context?.key) return false;
  try {
    storage.removeItem(context.key);
    return true;
  } catch {
    return false;
  }
}

// Ejecuta una sola escritura a la vez. Mientras una está en curso, los cambios
// posteriores se compactan en un único trabajo con la versión más reciente.
export function createCoalescingAutosaveQueue(save) {
  let pending = null;
  let running = null;
  let disposed = false;

  const drain = async () => {
    if (running) return running;
    running = (async () => {
      let lastResult;
      while (!disposed && pending) {
        const job = pending;
        pending = null;
        try {
          lastResult = await save(job);
        } catch (error) {
          // No reemplaza una versión más reciente que haya llegado durante el fallo.
          if (!pending) pending = job;
          throw error;
        }
      }
      return lastResult;
    })();

    try {
      return await running;
    } finally {
      running = null;
    }
  };

  return {
    enqueue(job) {
      if (!disposed) pending = job;
    },
    flush: drain,
    hasPending(predicate) {
      if (!pending) return false;
      return typeof predicate === 'function' ? Boolean(predicate(pending)) : true;
    },
    isRunning() {
      return Boolean(running);
    },
    clear() {
      pending = null;
    },
    dropPending(predicate) {
      if (!pending) return false;
      if (typeof predicate === 'function' && !predicate(pending)) return false;
      pending = null;
      return true;
    },
    dispose() {
      disposed = true;
      pending = null;
    },
  };
}
