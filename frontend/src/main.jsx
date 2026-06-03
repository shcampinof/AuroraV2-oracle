import React from 'react';
import ReactDOM from 'react-dom/client';
import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';
import App from './App.jsx';
import './App.css';
import { syncAuthTokenToServiceWorker } from './services/authStorage.js';

function hasMsalAuthResponse() {
  const hashParams = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);
  return (
    hashParams.has('code') ||
    hashParams.has('error') ||
    searchParams.has('code') ||
    searchParams.has('error')
  );
}

function renderPlainMessage(message) {
  const root = document.getElementById('root');
  if (!root) return;

  root.textContent = '';
  const screen = document.createElement('div');
  screen.className = 'auth-loading-screen';
  const card = document.createElement('div');
  card.className = 'auth-loading-card';
  card.textContent = message;
  screen.appendChild(card);
  root.appendChild(screen);
}

async function boot() {
  const isMsalAuthResponse = hasMsalAuthResponse();

  if (isMsalAuthResponse) {
    renderPlainMessage('Procesando inicio de sesión institucional...');
    await broadcastResponseToMainFrame();
    return;
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

const isMsalAuthResponse = hasMsalAuthResponse();

boot().catch((error) => {
  console.error('No fue posible completar el retorno de autenticación:', error);
  renderPlainMessage('No fue posible completar el retorno de autenticación.');
});

if (!isMsalAuthResponse && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(() => syncAuthTokenToServiceWorker())
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    syncAuthTokenToServiceWorker();
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type !== 'AURORA_OFFLINE_QUEUE_UPDATED') return;
    window.dispatchEvent(new CustomEvent('aurora:pwa-queue', { detail: data }));
  });

  window.addEventListener('online', () => {
    syncAuthTokenToServiceWorker();
    navigator.serviceWorker.ready
      .then((registration) => {
        const target = registration.active || navigator.serviceWorker.controller;
        if (target) target.postMessage({ type: 'AURORA_REPLAY_QUEUE' });
      })
      .catch(() => {});
  });
}
