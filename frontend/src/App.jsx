import { useEffect, useState } from 'react';

import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';

import Home from './pages/Home.jsx';
import RegistrosAsignados from './pages/RegistrosAsignados.jsx';
import FormularioAtencion from './pages/FormularioAtencion.jsx';
import AsignacionDefensores from './pages/AsignacionDefensores.jsx';
import CajaHerramientas from './pages/CajaHerramientas.jsx';
import ManualInteractivo from './pages/ManualInteractivo.jsx';

const VISTAS = new Set(['inicio', 'formulario', 'registros', 'asignacion', 'herramientas', 'manual']);

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

  useEffect(() => {
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
  }, []);

  function cambiarVista(vista) {
    if (!VISTAS.has(vista)) return;
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

  return (
    <div className="app-container">
      <Header />
      <div className="app-main">
        <Sidebar vistaActual={vistaActual} onChangeView={cambiarVista} />
        <main className="content-area">{contenido}</main>
      </div>
    </div>
  );
}

export default App;
