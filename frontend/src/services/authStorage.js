const TOKEN_KEY = 'aurora.auth.token';
const USER_KEY = 'aurora.auth.user';

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function syncAuthTokenToServiceWorker(tokenOverride) {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  const token = tokenOverride === undefined ? getAuthToken() : String(tokenOverride || '');
  const message = { type: 'AURORA_AUTH_TOKEN', token };

  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
  }

  navigator.serviceWorker.ready
    .then((registration) => {
      const target = registration.active || registration.waiting || registration.installing;
      if (target) target.postMessage(message);
    })
    .catch(() => {});
}

export function getAuthToken() {
  if (!canUseStorage()) return '';
  return window.localStorage.getItem(TOKEN_KEY) || '';
}

export function getStoredSession() {
  if (!canUseStorage()) return null;
  const token = getAuthToken();
  if (!token) return null;

  try {
    const user = JSON.parse(window.localStorage.getItem(USER_KEY) || 'null');
    return user ? { token, user } : null;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function storeSession(session) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(TOKEN_KEY, session?.token || '');
  window.localStorage.setItem(USER_KEY, JSON.stringify(session?.user || null));
  syncAuthTokenToServiceWorker(session?.token || '');
}

export function clearStoredSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  syncAuthTokenToServiceWorker('');
}
