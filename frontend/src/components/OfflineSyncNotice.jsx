import { useEffect, useState } from 'react';
import { syncAuthTokenToServiceWorker } from '../services/authStorage.js';

export default function OfflineSyncNotice() {
  const [queue, setQueue] = useState(null);

  useEffect(() => {
    function update(event) { setQueue(event.detail || null); }
    window.addEventListener('aurora:pwa-queue', update);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        (registration.active || navigator.serviceWorker.controller)?.postMessage({ type: 'AURORA_QUEUE_STATUS' });
      }).catch(() => {});
    }
    return () => window.removeEventListener('aurora:pwa-queue', update);
  }, []);

  if (!queue || Number(queue.pending || 0) <= 0) return null;
  const blocked = queue.waitingForAuth || [401, 403].includes(Number(queue.authStatus));
  return (
    <div className="card offline-sync-notice" role={blocked ? 'alert' : 'status'}>
      <p>{blocked
        ? 'Hay cambios guardados en este navegador que no se han enviado porque su sesión o permisos no permiten guardarlos. Vuelva a ingresar con la misma cuenta; si está deshabilitada, solicite su reactivación.'
        : 'Hay cambios guardados en este navegador pendientes de sincronización.'}</p>
      <button type="button" onClick={() => syncAuthTokenToServiceWorker()}>Reintentar sincronización</button>
    </div>
  );
}
