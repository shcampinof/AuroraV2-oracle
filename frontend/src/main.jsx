import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';
import { syncAuthTokenToServiceWorker } from './services/authStorage.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
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
