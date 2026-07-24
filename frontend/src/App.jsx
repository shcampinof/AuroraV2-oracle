import { useEffect, useState } from 'react';

import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import DataTreatmentNotice from './components/DataTreatmentNotice.jsx';
import LoginPage from './pages/LoginPage.jsx';

import Home from './pages/Home.jsx';
import RegistrosAsignados from './pages/RegistrosAsignados.jsx';
import FormularioAtencion from './pages/FormularioAtencion.jsx';
import AsignacionDefensores from './pages/AsignacionDefensores.jsx';
import AdminCargasBD from './pages/AdminCargasBD.jsx';
import AdminUsuarios from './pages/AdminUsuarios.jsx';
import CajaHerramientas from './pages/CajaHerramientas.jsx';
import ManualInteractivo from './pages/ManualInteractivo.jsx';
import { completeAzureAdRedirect, getAuthConfig, logout, refreshSession } from './services/auth.js';
import { getCondenadosFilterOptions } from './services/api.js';
import { FEATURE_FLAGS } from './config/featureFlags.js';

const VISTAS = new Set([
  'inicio',
  'formulario',
  'registros',
  'asignacion',
  'herramientas',
  ...(FEATURE_FLAGS.manualInteractivo ? ['manual'] : []),
  'admin-cargas',
  'admin-usuarios',
]);

function normalizarRoles(roles) {
  const input = Array.isArray(roles) ? roles : [];
  return Array.from(
    input.reduce((set, role) => {
      const raw = String(role || '').trim().toLowerCase();
      if (!raw) return set;

      set.add(raw);
      const dotIndex = raw.lastIndexOf('.');
      if (dotIndex >= 0 && dotIndex < raw.length - 1) {
        set.add(raw.slice(dotIndex + 1));
      }

      if (raw === 'aurora.admin' || raw === 'administrator' || raw === 'administrador') set.add('admin');
      if (raw === 'aurora.user' || raw === 'usuario') set.add('user');
      if (raw === 'aurora.pag' || raw === 'programa.pag') set.add('pag');
      return set;
    }, new Set())
  );
}

function tieneAccesoCargas(user) {
  const roles = normalizarRoles(user?.roles);
  return roles.some((role) => ['admin', 'carguebd', 'cargas_bd'].includes(role));
}

function esAdmin(user) {
  return normalizarRoles(user?.roles).includes('admin');
}

function tieneAccesoPag(user) {
  return normalizarRoles(user?.roles).includes('pag');
}

function vistaDesdeHash(hashValue) {
  const raw = String(hashValue || '')
    .replace(/^#\/?/, '')
    .split(/[/?]/)[0]
    .trim();
  return VISTAS.has(raw) ? raw : 'inicio';
}

function esRespuestaMsal() {
  const hashParams = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);
  return (
    hashParams.has('code') ||
    hashParams.has('error') ||
    searchParams.has('code') ||
    searchParams.has('error')
  );
}

function App() {
  const [vistaActual, setVistaActual] = useState(() => vistaDesdeHash(window.location.hash));
  const [numeroSeleccionado, setNumeroSeleccionado] = useState(null);
  const [session, setSession] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [conditionsAccepted, setConditionsAccepted] = useState(false);
  const isMsalResponse = esRespuestaMsal();

  useEffect(() => {
    let alive = true;
    const finishAuth = async () => {
      const authConfig = await getAuthConfig();
      const redirectedSession = await completeAzureAdRedirect(authConfig);
      if (redirectedSession) return redirectedSession;
      return refreshSession();
    };

    finishAuth()
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
    if (!session || !conditionsAccepted) return undefined;

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
  }, [session, conditionsAccepted]);

  useEffect(() => {
    if (!session || !conditionsAccepted) return undefined;

    async function precargarFiltrosUsuariosAsignados() {
      try {
        await getCondenadosFilterOptions({ tipo: 'all' });
      } catch (error) {
        console.warn('[usuarios-asignados:prefetch] No fue posible precargar los filtros:', error);
      }
    }

    precargarFiltrosUsuariosAsignados();
    return undefined;
  }, [session, conditionsAccepted]);

  useEffect(() => {
    if (!session || !conditionsAccepted) return;
    if (vistaActual === 'admin-cargas' && !tieneAccesoCargas(session.user)) {
      window.location.hash = '/inicio';
    }
    if (vistaActual === 'admin-usuarios' && !esAdmin(session.user)) {
      window.location.hash = '/inicio';
    }
    if (vistaActual === 'asignacion' && !tieneAccesoPag(session.user)) {
      window.location.hash = '/inicio';
    }
  }, [session, vistaActual, conditionsAccepted]);

  function cambiarVista(vista) {
    if (!conditionsAccepted) return;
    if (!VISTAS.has(vista)) return;
    if (vista === 'admin-cargas' && !tieneAccesoCargas(session?.user)) return;
    if (vista === 'admin-usuarios' && !esAdmin(session?.user)) return;
    if (vista === 'asignacion' && !tieneAccesoPag(session?.user)) return;
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
    window.location.hash = '/inicio';
    setConditionsAccepted(false);
    setSession(null);
  }

  if (authChecking) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-card">
          {isMsalResponse ? 'Procesando inicio de sesión institucional...' : 'Validando sesión institucional...'}
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage onAuthenticated={setSession} />;
  }

  const puedeAdministrarCargas = tieneAccesoCargas(session.user);
  const puedeAdministrarUsuarios = esAdmin(session.user);
  const puedeAccederPag = tieneAccesoPag(session.user);

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

  if (vistaActual === 'asignacion' && puedeAccederPag) {
    contenido = <AsignacionDefensores isAdmin={puedeAdministrarUsuarios} />;
  }

  if (vistaActual === 'herramientas') {
    contenido = <CajaHerramientas />;
  }

  if (FEATURE_FLAGS.manualInteractivo && vistaActual === 'manual') {
    contenido = <ManualInteractivo />;
  }

  if (vistaActual === 'admin-cargas' && puedeAdministrarCargas) {
    contenido = <AdminCargasBD />;
  }

  if (vistaActual === 'admin-usuarios' && puedeAdministrarUsuarios) {
    contenido = <AdminUsuarios />;
  }

  return (
    <>
      <div className="app-container" inert={!conditionsAccepted}>
        <Header user={session.user} onLogout={manejarSalida} />
        <div className="app-main">
          <Sidebar
            vistaActual={vistaActual}
            onChangeView={cambiarVista}
            showAdminCargas={puedeAdministrarCargas}
            showAdminUsuarios={puedeAdministrarUsuarios}
            showPag={puedeAccederPag}
          />
          <main className="content-area">{conditionsAccepted ? contenido : <Home />}</main>
        </div>
      </div>
      {!conditionsAccepted ? (
        <DataTreatmentNotice
          onAccept={() => setConditionsAccepted(true)}
          onDecline={manejarSalida}
        />
      ) : null}
    </>
  );
}

export default App;
