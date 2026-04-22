import { LOGO_AURORA_URL } from '../config/externalAssets.js';

function LoadingOverlay({ show = false, message = 'Cargando informaci\u00f3n...' }) {
  if (!show) return null;

  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-overlay-card">
        <img src={LOGO_AURORA_URL} alt="Logo Aurora" className="loading-overlay-logo" />
        <span className="loading-overlay-spinner" aria-hidden="true" />
        <p className="loading-overlay-text">{message}</p>
      </div>
    </div>
  );
}

export default LoadingOverlay;

