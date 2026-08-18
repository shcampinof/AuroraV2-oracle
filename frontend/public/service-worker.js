const CACHE_NAME = 'aurora-shell-v6';
const QUEUE_DB_NAME = 'aurora-pwa-v1';
const QUEUE_STORE_NAME = 'offlineRequests';
const QUEUE_SYNC_TAG = 'aurora-offline-sync';
const QUEUE_MAX_ITEMS = 75;
const QUEUE_MAX_BODY_BYTES = 256 * 1024;
const BUILD_ASSETS = [
  // AURORA_PRECACHE_ASSETS
];
const APP_SHELL = Array.from(new Set([
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  ...BUILD_ASSETS,
]));
let replayInProgress = false;
let authHeader = '';
let authSubject = '';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isExcludedPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        const store = db.createObjectStore(QUEUE_STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runQueueStore(mode, callback) {
  return openQueueDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE_NAME, mode);
        const store = tx.objectStore(QUEUE_STORE_NAME);
        let result;

        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };

        result = callback(store);
      })
  );
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getQueuedRequests() {
  const db = await openQueueDb();
  try {
    const tx = db.transaction(QUEUE_STORE_NAME, 'readonly');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const rows = await requestToPromise(store.getAll());
    return rows.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  } finally {
    db.close();
  }
}

async function getQueueSize() {
  const db = await openQueueDb();
  try {
    const tx = db.transaction(QUEUE_STORE_NAME, 'readonly');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    return await requestToPromise(store.count());
  } finally {
    db.close();
  }
}

async function trimQueue() {
  const rows = await getQueuedRequests();
  const overflow = rows.length - QUEUE_MAX_ITEMS;
  if (overflow <= 0) return;

  const idsToDelete = rows.slice(0, overflow).map((row) => row.id);
  await runQueueStore('readwrite', (store) => {
    idsToDelete.forEach((id) => store.delete(id));
  });
}

function subjectFromAuthorization(value) {
  try {
    const token = String(value || '').replace(/^Bearer\s+/i, '').trim();
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return '';
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded));
    return String(payload?.sub || payload?.email || payload?.username || '').trim();
  } catch {
    return '';
  }
}

async function discardAuthenticatedQueueExcept(subjectToKeep = '') {
  const rows = await getQueuedRequests();
  const discardedIds = rows
    .filter((row) => row.requiresAuth && (!subjectToKeep || row.authSubject !== subjectToKeep))
    .map((row) => row.id);
  if (!discardedIds.length) return 0;

  await runQueueStore('readwrite', (store) => {
    discardedIds.forEach((id) => store.delete(id));
  });
  return discardedIds.length;
}

function isQueueableWrite(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (request.headers.get('x-aurora-offline-replay') === 'true') return false;

  const method = String(request.method || '').toUpperCase();
  const pathname = url.pathname;

  if (method === 'PUT' && /^\/api\/ppl\/[^/]+$/.test(pathname)) return true;
  if (method === 'POST' && /^\/api\/ppl\/[^/]+\/actuaciones$/.test(pathname)) return true;
  if (method === 'POST' && pathname === '/api/ppl/asignar-defensor') return true;
  if (method === 'POST' && pathname === '/api/ppl/desasignar-defensor') return true;
  if (method === 'POST' && pathname === '/api/defensores') return true;
  return false;
}

async function queueRequest(request) {
  const body = await request.clone().text();
  if (body.length > QUEUE_MAX_BODY_BYTES) {
    throw new Error('Request body exceeds offline queue limit.');
  }

  const headers = {};
  request.headers.forEach((value, key) => {
    const normalizedKey = String(key || '').toLowerCase();
    if (normalizedKey === 'authorization' || normalizedKey === 'content-length') return;
    headers[key] = value;
  });

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url: request.url,
    method: request.method,
    headers,
    body,
    createdAt: Date.now(),
    attempts: 0,
    lastAttemptAt: 0,
    requiresAuth: Boolean(request.headers.get('authorization')),
    authSubject: subjectFromAuthorization(request.headers.get('authorization')),
  };

  await runQueueStore('readwrite', (store) => {
    store.put(entry);
  });
  await trimQueue();
  await registerQueueSync();
  await notifyQueueUpdated({ queued: true });
  return entry;
}

async function registerQueueSync() {
  if (!self.registration || !('sync' in self.registration)) return;
  try {
    await self.registration.sync.register(QUEUE_SYNC_TAG);
  } catch {
    // Browsers can deny Background Sync. Online replay from the page covers that case.
  }
}

async function notifyQueueUpdated(extra = {}) {
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  const pending = await getQueueSize().catch(() => 0);
  clientsList.forEach((client) => {
    client.postMessage({
      type: 'AURORA_OFFLINE_QUEUE_UPDATED',
      pending,
      ...extra,
    });
  });
}

async function replayQueuedRequests() {
  if (replayInProgress) return;
  replayInProgress = true;

  try {
    const rows = await getQueuedRequests();
    let replayed = 0;
    let failed = 0;

    for (const row of rows) {
      if (row.requiresAuth && !authHeader) {
        await notifyQueueUpdated({ waitingForAuth: true });
        break;
      }
      if (row.requiresAuth && (!row.authSubject || row.authSubject !== authSubject)) {
        await runQueueStore('readwrite', (store) => store.delete(row.id));
        failed += 1;
        continue;
      }

      const headers = new Headers(row.headers || {});
      headers.set('x-aurora-offline-replay', 'true');
      if (row.requiresAuth && authHeader) headers.set('Authorization', authHeader);

      try {
        const response = await fetch(row.url, {
          method: row.method,
          headers,
          body: row.body,
        });

        if (response.ok) {
          await runQueueStore('readwrite', (store) => store.delete(row.id));
          replayed += 1;
          continue;
        }

        if (response.status >= 400 && response.status < 500) {
          await runQueueStore('readwrite', (store) => store.delete(row.id));
          failed += 1;
          continue;
        }

        await runQueueStore('readwrite', (store) => {
          store.put({
            ...row,
            attempts: Number(row.attempts || 0) + 1,
            lastAttemptAt: Date.now(),
          });
        });
        break;
      } catch {
        await runQueueStore('readwrite', (store) => {
          store.put({
            ...row,
            attempts: Number(row.attempts || 0) + 1,
            lastAttemptAt: Date.now(),
          });
        });
        break;
      }
    }

    if (replayed || failed) {
      await notifyQueueUpdated({ replayed, failed });
    }
  } finally {
    replayInProgress = false;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  const url = new URL(request.url);
  if (isQueueableWrite(request, url)) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        const entry = await queueRequest(request);
        return new Response(
          JSON.stringify({
            queued: true,
            id: entry.id,
            message: 'Operacion guardada localmente. Se sincronizara cuando vuelva la conexion.',
          }),
          {
            status: 202,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'X-Aurora-Queued': 'true',
            },
          }
        );
      })
    );
    return;
  }

  if (request.method !== 'GET') return;

  if (url.origin !== self.location.origin) return;
  if (isExcludedPath(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseClone));
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || Response.error())
    );
    return;
  }

  const isStaticAsset =
    ['script', 'style', 'image', 'font'].includes(request.destination) ||
    url.pathname.startsWith('/assets/');

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag !== QUEUE_SYNC_TAG) return;
  event.waitUntil(replayQueuedRequests());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'AURORA_AUTH_TOKEN') {
    const token = String(data.token || '').trim();
    authHeader = token ? `Bearer ${token}` : '';
    authSubject = subjectFromAuthorization(authHeader);
    event.waitUntil(
      discardAuthenticatedQueueExcept(authSubject).then(async (discarded) => {
        if (discarded) await notifyQueueUpdated({ discarded });
        if (authHeader && authSubject) await replayQueuedRequests();
      })
    );
  }
  if (data.type === 'AURORA_REPLAY_QUEUE') {
    event.waitUntil(replayQueuedRequests());
  }
});
