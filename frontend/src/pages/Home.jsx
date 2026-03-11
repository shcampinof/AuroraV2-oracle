import { LOGO_AURORA_URL } from '../config/externalAssets.js';

function Home() {
  return (
    <div className="card">
      <div className="home-hero">
        <img
          src={LOGO_AURORA_URL}
          alt="Logo AURORA"
          className="home-logo-aurora"
        />
      </div>

      <h2 className="home-title">Bienvenido</h2>

      <p className="home-text home-text-intro">
        <strong>Aurora</strong> es la herramienta institucional para la gestión de atención jurídica de personas
        privadas de la libertad.
      </p>
      <p className="home-text home-text-spaced home-text-secondary">Use el menú lateral para navegar dentro del sitio.</p>
      <p className="home-text home-text-spaced home-text-secondary">
        Si presenta algún error o inconveniente en la plataforma, repórtelo al correo{' '}
        <strong>aurora@defensoria.edu.co</strong>
      </p>
    </div>
  );
}

export default Home;
