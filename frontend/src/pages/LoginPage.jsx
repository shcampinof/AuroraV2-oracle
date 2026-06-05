import { useEffect, useState } from 'react';

import { LOGO_AURORA_URL, LOGO_DEFENSORIA_URL } from '../config/externalAssets.js';
import { getAuthConfig, loginLocal, loginWithAzureAd } from '../services/auth.js';

const LEGAL_CONTENT = {
  ayuda: {
    title: 'Ayuda de acceso',
    intro:
      'Use sus credenciales institucionales para ingresar a AURORA. Si el ingreso no avanza, valide que su cuenta esté activa y autorizada por la entidad.',
    items: [
      'Ingrese su usuario institucional y continúe con el botón Iniciar Sesión.',
      'La contraseña se valida en el servicio institucional de autenticación; AURORA no la almacena.',
      'Si no puede acceder, solicite a la mesa de servicio la revisión de su cuenta, grupo o rol autorizado para AURORA.',
    ],
  },
  privacidad: {
    title: 'Política de privacidad',
    intro:
      'AURORA trata información institucional y datos personales únicamente para apoyar la gestión de atención jurídica de personas privadas de la libertad.',
    items: [
      'Los datos se usan para autenticación, autorización, trazabilidad, consulta, registro y seguimiento de actuaciones autorizadas por la entidad.',
      'El acceso se limita a personal autorizado mediante credenciales institucionales, controles de sesión y validaciones de pertenencia al directorio activo.',
      'La aplicación puede conservar registros técnicos de acceso, fecha, usuario, acciones relevantes y dirección de red para auditoría y seguridad.',
      'La información no debe descargarse, copiarse, compartirse o tratarse por fuera de los fines institucionales definidos por la entidad.',
      'Las solicitudes de consulta, actualización, rectificación o supresión de datos se atenderán por los canales institucionales establecidos por la Defensoría del Pueblo.',
    ],
  },
  terminos: {
    title: 'Términos de uso',
    intro:
      'El ingreso y uso de AURORA implica la aceptación de estas condiciones para proteger la información, la disponibilidad del servicio y la trazabilidad institucional.',
    items: [
      'El sistema es de uso exclusivo para personal autorizado y para fines estrictamente institucionales.',
      'Cada usuario es responsable de custodiar sus credenciales, cerrar sesión en equipos compartidos y reportar cualquier acceso sospechoso.',
      'Está prohibido intentar evadir controles de seguridad, consultar información sin competencia funcional o alterar registros sin autorización.',
      'Toda actividad puede ser registrada, monitoreada y auditada conforme a las políticas de seguridad de la información de la entidad.',
      'El uso indebido del sistema podrá generar bloqueo de acceso y las acciones administrativas, disciplinarias o legales que correspondan.',
    ],
  },
};

function LegalDialog({ type, onClose }) {
  const content = LEGAL_CONTENT[type];
  if (!content) return null;

  return (
    <div className="legal-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="legal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="legal-dialog-title">{content.title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <p>{content.intro}</p>
        <ul>
          {content.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function LoginPage({ onAuthenticated }) {
  const [authConfig, setAuthConfig] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [legalDialog, setLegalDialog] = useState(null);

  const isBusy = status === 'loading-config' || status === 'logging-in';

  useEffect(() => {
    let alive = true;
    setStatus('loading-config');
    getAuthConfig()
      .then((config) => {
        if (!alive) return;
        setAuthConfig(config);
        setStatus('idle');
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message || 'No fue posible cargar la configuración de autenticación.');
        setStatus('idle');
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    setStatus('logging-in');
    try {
      if (username.trim() && password) {
        try {
          const localSession = await loginLocal({ username, password });
          onAuthenticated(localSession);
          return;
        } catch (localErr) {
          if (localErr?.message !== 'Usuario o contraseña inválidos.') {
            throw localErr;
          }
        }
      }

      if (!authConfig?.azureAd?.enabled) {
        throw new Error('Usuario o contraseña inválidos.');
      }

      const session = await loginWithAzureAd(authConfig, { username });
      if (session) onAuthenticated(session);
    } catch (err) {
      setError(err?.message || 'No fue posible iniciar sesión.');
    } finally {
      setStatus('idle');
    }
  }

  return (
    <div className="login-shell">
      <header className="login-topbar" aria-label="Encabezado institucional">
        <img src={LOGO_DEFENSORIA_URL} alt="" className="login-topbar-logo" />
        <strong>Defensoría del Pueblo</strong>
        <div className="login-topbar-actions">
          <button type="button" onClick={() => setLegalDialog('ayuda')} aria-label="Ayuda de acceso">
            ?
          </button>
        </div>
      </header>

      <main className="login-main">
        <section className="login-card">
          <div className="login-brand">
            <img src={LOGO_AURORA_URL} alt="AURORA" className="login-brand-aurora" />
          </div>

          <p className="login-subtitle">
            Sistema de gestión de atención jurídica para personas privadas de la libertad.
          </p>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              <span>USUARIO</span>
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Ingrese su usuario institucional"
                disabled={isBusy}
              />
            </label>

            <label>
              <span>CONTRASEÑA</span>
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingrese su contraseña"
                disabled={isBusy}
              />
            </label>

            <p>Ingrese con sus credenciales institucionales.</p>

            {error ? <p className="login-error" role="alert">{error}</p> : null}

            <button
              className="login-submit"
              type="submit"
              disabled={isBusy}
              title="Iniciar sesión"
            >
              {status === 'logging-in' ? 'Ingresando...' : 'Iniciar Sesión  ↪'}
            </button>
          </form>

          <p className="login-notice">
            Este es un sistema de acceso restringido para personal autorizado.
            <br />
            El uso indebido será sancionado conforme a la ley.
          </p>
        </section>
      </main>

      <footer className="login-footer">
        <span>© 2026 DEFENSORÍA DEL PUEBLO DE COLOMBIA - TODOS LOS DERECHOS RESERVADOS</span>
        <nav aria-label="Información legal">
          <button type="button" onClick={() => setLegalDialog('privacidad')}>PRIVACIDAD</button>
          <button type="button" onClick={() => setLegalDialog('terminos')}>TÉRMINOS DE USO</button>
        </nav>
      </footer>

      <LegalDialog type={legalDialog} onClose={() => setLegalDialog(null)} />
    </div>
  );
}

export default LoginPage;
