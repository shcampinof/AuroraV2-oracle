// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfflineSyncNotice from './OfflineSyncNotice.jsx';
import { syncAuthTokenToServiceWorker } from '../services/authStorage.js';

vi.mock('../services/authStorage.js', () => ({ syncAuthTokenToServiceWorker: vi.fn() }));

describe('pendientes sin conexión', () => {
  let root;
  let container;
  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    syncAuthTokenToServiceWorker.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<OfflineSyncNotice />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  async function notify(detail) {
    await act(async () => window.dispatchEvent(new CustomEvent('aurora:pwa-queue', { detail })));
  }
  it.each([401, 403])('informa del rechazo %s, conserva el aviso y permite reintentar con la cuenta actual', async (authStatus) => {
    await notify({ pending: 1, waitingForAuth: true, authStatus });
    expect(container.querySelector('[role="alert"]').textContent).toContain('no se han enviado');
    expect(container.textContent).toContain('misma cuenta');
    await act(async () => container.querySelector('button').click());
    expect(syncAuthTokenToServiceWorker).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await notify({ pending: 0, replayed: 1 });
    expect(container.textContent).toBe('');
  });
  it('muestra el pendiente ordinario sin afirmar que ya se guardó en el servidor', async () => {
    await notify({ pending: 1, queued: true });
    expect(container.querySelector('[role="status"]').textContent).toContain('pendientes de sincronización');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
  it('no muestra pendientes de otra identidad al recibir su estado vacío', async () => {
    await notify({ pending: 1, authStatus: 403 });
    await notify({ pending: 0, authStatus: 0 });
    expect(container.textContent).toBe('');
  });
});
