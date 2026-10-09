export const PPL_DATA_VERSION_POLL_MS = 30 * 1000;
export const PPL_DATA_VERSION_JITTER_MS = 5 * 1000;
export const PPL_DATA_VERSION_MAX_RETRY_MS = 5 * 60 * 1000;

// Consulta después de terminar la petición anterior. La pequeña variación
// entre usuarios evita concentrar todas las consultas en el mismo instante.
export function startPplDataVersionMonitor({
  loadVersion,
  onChange,
  onError,
  documentTarget = document,
  random = Math.random,
}) {
  let alive = true;
  let checking = false;
  let previousVersion = null;
  let failures = 0;
  let timer = null;
  let nextCheckAt = 0;

  function cancelTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function schedule() {
    cancelTimer();
    if (!alive || checking || documentTarget.visibilityState === 'hidden') return;
    timer = setTimeout(() => { void check(); }, Math.max(0, nextCheckAt - Date.now()));
  }

  async function check() {
    if (!alive || checking || documentTarget.visibilityState === 'hidden') return;
    if (Date.now() < nextCheckAt) {
      schedule();
      return;
    }
    cancelTimer();
    checking = true;
    try {
      const info = await loadVersion();
      if (!alive) return;
      failures = 0;
      const changed = previousVersion !== null && previousVersion !== info.version;
      previousVersion = info.version;
      if (changed) onChange(info);
    } catch (error) {
      if (!alive) return;
      failures += 1;
      onError?.(error);
    } finally {
      checking = false;
      if (alive) {
        const delay = Math.min(
          PPL_DATA_VERSION_MAX_RETRY_MS,
          PPL_DATA_VERSION_POLL_MS * (2 ** Math.min(failures, 10))
        );
        nextCheckAt = Date.now() + delay + Math.floor(random() * PPL_DATA_VERSION_JITTER_MS);
        schedule();
      }
    }
  }

  function handleVisibilityChange() {
    if (documentTarget.visibilityState === 'hidden') cancelTimer();
    else void check();
  }

  documentTarget.addEventListener('visibilitychange', handleVisibilityChange);
  void check();
  return () => {
    alive = false;
    cancelTimer();
    documentTarget.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
