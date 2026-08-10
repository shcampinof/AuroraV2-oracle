import { PublicClientApplication } from '@azure/msal-browser';

import { API_BASE } from './api.js';
import { clearStoredSession, getStoredSession, storeSession } from './authStorage.js';

let msalApp = null;
let msalInitPromise = null;

function mapAzureAdLoginError(err) {
  const rawMessage = String(err?.message || err?.errorMessage || err?.errorCode || '');
  if (rawMessage.toLowerCase().includes('interaction_in_progress')) {
    clearStaleMsalInteractionState();
    const mapped = new Error(
      'Había un inicio de sesión institucional pendiente. Se limpió el estado local; intente ingresar nuevamente.'
    );
    mapped.code = 'AZURE_AD_INTERACTION_IN_PROGRESS';
    return mapped;
  }
  if (
    rawMessage.includes('AADSTS9002326') ||
    rawMessage.toLowerCase().includes('cross-origin token redemption')
  ) {
    const mapped = new Error(
      `La aplicación de Microsoft Entra ID debe registrar ${window.location.origin} como Redirect URI de tipo Single-page application (SPA), no como Web.`
    );
    mapped.code = 'AZURE_AD_SPA_REDIRECT_URI_REQUIRED';
    return mapped;
  }
  return err;
}

function safeStorageEntries(storage) {
  try {
    return Array.from({ length: storage.length }, (_item, index) => storage.key(index)).filter(Boolean);
  } catch {
    return [];
  }
}

function removeStorageKeys(storage, predicate) {
  for (const key of safeStorageEntries(storage)) {
    try {
      if (predicate(key, storage.getItem(key))) storage.removeItem(key);
    } catch {
      // Ignore storage access errors; the login attempt should continue.
    }
  }
}

function clearStaleMsalInteractionState() {
  if (typeof window === 'undefined') return;

  const isInteractionKey = (key, value) => {
    const normalizedKey = String(key || '').toLowerCase();
    const normalizedValue = String(value || '').toLowerCase();
    return (
      normalizedValue.includes('interaction_in_progress') ||
      (normalizedKey.includes('msal') && normalizedKey.includes('interaction')) ||
      normalizedKey.endsWith('.interaction.status')
    );
  };

  removeStorageKeys(window.sessionStorage, isInteractionKey);
  removeStorageKeys(window.localStorage, isInteractionKey);
}

async function readAuthResponse(res, fallbackMessage) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = String(data?.message || data?.error || '');
    if (res.status === 404 && message.toLowerCase().includes('endpoint api no encontrado')) {
      throw new Error('El backend de autenticación no está disponible o no fue reiniciado con la versión actual.');
    }
    throw new Error(String(message || fallbackMessage));
  }
  return data;
}

function buildHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...extra,
  };
}

function persistAuthPayload(payload) {
  const session = {
    token: payload?.token,
    user: payload?.user,
  };
  if (!session.token || !session.user) {
    throw new Error('El backend no devolvió una sesión válida.');
  }
  storeSession(session);
  return session;
}

export function getCurrentSession() {
  return getStoredSession();
}

export function logout() {
  clearStoredSession();
}

export async function getAuthConfig() {
  const res = await fetch(`${API_BASE}/auth/config`);
  return readAuthResponse(res, 'No fue posible consultar la configuración de autenticación.');
}

export async function loginLocal({ username, password }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ username, password }),
  });
  return persistAuthPayload(await readAuthResponse(res, 'No fue posible iniciar sesión.'));
}

function getMsalApp(azureAdConfig) {
  if (!msalApp) {
    msalApp = new PublicClientApplication({
      auth: {
        clientId: azureAdConfig.clientId,
        authority: `https://login.microsoftonline.com/${azureAdConfig.tenantId}`,
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    });
  }
  return msalApp;
}

async function ensureMsalReady(app) {
  if (!msalInitPromise) {
    msalInitPromise = app.initialize();
  }
  return msalInitPromise;
}

export async function loginWithAzureAd(authConfig, options = {}) {
  const azureAd = authConfig?.azureAd || {};
  if (!azureAd.enabled || !azureAd.tenantId || !azureAd.clientId) {
    throw new Error('El servicio de autenticación institucional aún no está configurado.');
  }

  const app = getMsalApp(azureAd);
  await ensureMsalReady(app);
  const request = {
    scopes: ['openid', 'profile', 'email'],
    loginHint: String(options?.username || '').trim() || undefined,
    prompt: 'select_account',
  };

  try {
    clearStaleMsalInteractionState();
    await app.loginRedirect(request);
  } catch (err) {
    const rawMessage = String(err?.message || err?.errorMessage || err?.errorCode || '');
    if (rawMessage.toLowerCase().includes('interaction_in_progress')) {
      clearStaleMsalInteractionState();
      await app.loginRedirect(request);
      return null;
    }
    throw mapAzureAdLoginError(err);
  }

  return null;
}

export async function completeAzureAdRedirect(authConfig) {
  const azureAd = authConfig?.azureAd || {};
  if (!azureAd.enabled || !azureAd.tenantId || !azureAd.clientId) return null;

  const app = getMsalApp(azureAd);
  await ensureMsalReady(app);

  let result;
  try {
    result = await app.handleRedirectPromise();
  } catch (err) {
    throw mapAzureAdLoginError(err);
  }

  if (!result?.idToken) return null;

  const res = await fetch(`${API_BASE}/auth/azure-ad`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ idToken: result.idToken }),
  });
  return persistAuthPayload(await readAuthResponse(res, 'No fue posible validar el ingreso institucional.'));
}

export async function refreshSession() {
  const session = getStoredSession();
  if (!session?.token) return null;

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
  });

  if (!res.ok) {
    clearStoredSession();
    return null;
  }

  const data = await res.json().catch(() => ({}));
  const refreshed = { token: session.token, user: data?.user || session.user };
  storeSession(refreshed);
  return refreshed;
}
