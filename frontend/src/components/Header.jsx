import { LOGO_DEFENSORIA_URL } from '../config/externalAssets.js';

function Header() {
  return (
    <header className="header header--dark">
      <div className="header-inner">
        <div className="header-logo-circle" aria-hidden="true">
          <img src={LOGO_DEFENSORIA_URL} alt="" className="header-logo" />
        </div>
        <div className="header-text">
          <h1 className="header-title">AURORA</h1>
          <p className="header-subtitle">
            Herramienta para la gestión de atención jurídica de personas privadas de la libertad.
          </p>
        </div>
        <div className="header-spacer" aria-hidden="true" />
      </div>
    </header>
  );
}

export default Header;
