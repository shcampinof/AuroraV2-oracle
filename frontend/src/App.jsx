import { useEffect, useState } from 'react';

import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import LoginPage from './pages/LoginPage.jsx';

import Home from './pages/Home.jsx';
import RegistrosAsignados from './pages/RegistrosAsignados.jsx';
import FormularioAtencion from './pages/FormularioAtencion.jsx';
import AsignacionDefensores from './pages/AsignacionDefensores.jsx';
import AdminCargasBD from './pages/AdminCargasBD.jsx';
import CajaHerramientas from './pages/CajaHerramientas.jsx';
import ManualInteractivo from './pages/ManualInteractivo.jsx';
import { logout, refreshSession } from './services/auth.js';

const VISTAS = new Set(['inicio', 'formulario', 'registros', 'asignacion', 'herramientas', 'manual', 'admin-cargas']);

function tieneAccesoCargas(user) {
  const roles = Array.isArray(user?.roles) ? user.roles.map((role) => String(role).toLowerCase()) : [];
  return roles.some((role) => ['admin', 'carguebd', 'cargas_bd'].includes(role));
}

function vistaDesdeHash(hashValue) {
  const raw = String(hashValue || '')
    .replace(/^#\/?/, '')
    .split(/[/?]/)[0]
    .trim();
  return VISTAS.has(raw) ? raw : 'inicio';
}

function App() {
  const [vistaActual, setVistaActual] = useState(() => vistaDesdeHash(window.location.hash));
  const [numeroSeleccionado, setNumeroSeleccionado] = useState(null);
  const [session, setSession] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    refreshSession()
      .then((activeSession) => {
        if (!alive) return;
        setSession(activeSession);
      })
      .finally(() => {
        if (!alive) return;
        setAuthChecking(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return undefined;

    function syncVistaWithHash() {
      const resolved = vistaDesdeHash(window.location.hash);
      setVistaActual(resolved);
    }

    if (!window.location.hash) {
      window.location.hash = '/inicio';
    } else {
      syncVistaWithHash();
    }

    window.addEventListener('hashchange', syncVistaWithHash);
    return () => {
      window.removeEventListener('hashchange', syncVistaWithHash);
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (vistaActual === 'admin-cargas' && !tieneAccesoCargas(session.user)) {
      window.location.hash = '/inicio';
    }
  }, [session, vistaActual]);

  function cambiarVista(vista) {
    if (!VISTAS.has(vista)) return;
    if (vista === 'admin-cargas' && !tieneAccesoCargas(session?.user)) return;
    const nextHash = `/${vista}`;
    if (window.location.hash !== `#${nextHash}`) {
      window.location.hash = nextHash;
      return;
    }
    setVistaActual(vista);
  }

  function abrirFormularioPorDocumento(numeroIdentificacion) {
    const doc = String(numeroIdentificacion || '').trim();
    if (!doc) return;

    setNumeroSeleccionado(doc);
    cambiarVista('formulario');
  }

  const manejarSeleccionRegistro = (payload) => {
    if (typeof payload === 'string' || typeof payload === 'number') {
      abrirFormularioPorDocumento(payload);
      return;
    }

    const doc = payload?.numeroIdentificacion;
    if (doc) abrirFormularioPorDocumento(doc);
  };

  function manejarSalida() {
    logout();
    setSession(null);
  }

  if (authChecking) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-card">Validando sesión institucional...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage onAuthenticated={setSession} />;
  }

  const puedeAdministrarCargas = tieneAccesoCargas(session.user);

  let contenido = null;

  if (vistaActual === 'inicio') {
    contenido = <Home />;
  }

  if (vistaActual === 'formulario') {
    contenido = <FormularioAtencion numeroInicial={numeroSeleccionado} />;
  }

  if (vistaActual === 'registros') {
    contenido = <RegistrosAsignados onSelectRegistro={manejarSeleccionRegistro} />;
  }

  if (vistaActual === 'asignacion') contenido = <AsignacionDefensores />;

  if (vistaActual === 'herramientas') {
    contenido = <CajaHerramientas />;
  }

  if (vistaActual === 'manual') {
    contenido = <ManualInteractivo />;
  }

  if (vistaActual === 'admin-cargas' && puedeAdministrarCargas) {
    contenido = <AdminCargasBD />;
  }

  return (
    <div className="app-container">
      <Header user={session.user} onLogout={manejarSalida} />
      <div className="app-main">
        <Sidebar
          vistaActual={vistaActual}
          onChangeView={cambiarVista}
          showAdminCargas={puedeAdministrarCargas}
        />
        <main className="content-area">{contenido}</main>
      </div>
    </div>
  );
}

export default App;
