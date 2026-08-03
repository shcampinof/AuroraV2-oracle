import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  assignDefensorPpl,
  createDefensor,
  getCondenados,
  getCondenadosFilterOptions,
  getDefensoresCondenados,
  getDefensoresCatalogo,
  extractDefensoresCatalogo,
  isQueuedResponse,
  validatePagCedula,
} from '../services/api.js';
import Toast from '../components/Toast.jsx';
import LoadingOverlay from '../components/LoadingOverlay.jsx';
import PagUsuariosAdmin from '../components/PagUsuariosAdmin.jsx';
import { getEstadoDisplayInfo } from '../config/estadoActuaciones.rules.ts';
import { displayOrDash } from '../utils/pplDisplay.js';
import { reportError } from '../utils/reportError.js';

function tieneDefensor(value) {
  const cleaned = String(value ?? '').trim();
  return cleaned !== '' && cleaned !== '-';
}

function normalizeDocumento(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function normalizeDefensorNombre(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isNombreDefensorValido(value) {
  return /^[\p{L}\s]+$/u.test(value);
}

function getAccionImpulsarDisplay(row) {
  const accionApi = String(row?.accionPendiente?.etiqueta || '').trim();
  if (accionApi) return accionApi;
  const estadoInfo = getEstadoDisplayInfo(row);
  return String(estadoInfo?.label || row?.accionImpulsar || '').trim();
}

const DEFAULT_INITIAL_LIMIT = 100;
const DEFAULT_FILTERED_LIMIT = 200;
const MAX_DEFENSOR_SUGGESTIONS = 80;

const AsignacionRow = memo(function AsignacionRow({ row, selected, onToggle }) {
  const doc = String(row.numeroIdentificacion);

  return (
    <tr className="clickable-row" onClick={() => onToggle(doc)}>
      <td>
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggle(doc)}
          aria-label={`Seleccionar ${doc}`}
        />
      </td>
      <td>{displayOrDash(row.situacionJuridica)}</td>
      <td>{displayOrDash(row.numeroIdentificacion)}</td>
      <td>{displayOrDash(row.nombreUsuario)}</td>
      <td>{displayOrDash(row.departamentoLugarReclusion)}</td>
      <td>{displayOrDash(row.municipioLugarReclusion)}</td>
      <td>{displayOrDash(row.accionImpulsarDisplay)}</td>
      <td>{displayOrDash(row.defensorAsignado)}</td>
      <td>{displayOrDash(row.lugarReclusion)}</td>
      <td>{displayOrDash(row.autoridadCargo)}</td>
      <td>{displayOrDash(row.numeroProceso)}</td>
    </tr>
  );
});

function AsignacionDefensores({ isAdmin = false }) {
  const [tab, setTab] = useState('asignacion'); // 'asignacion' | 'reasignacion' | 'crearDefensor' | 'usuariosPag'
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('Aurora - Cambios guardados correctamente');

  const [rows, setRows] = useState([]);
  const [seleccionados, setSeleccionados] = useState(new Set());

  const [defensores, setDefensores] = useState([]);
  const [opcionesFiltro, setOpcionesFiltro] = useState({
    departamentos: [],
    municipios: [],
    lugares: [],
  });
  const [opcionesFiltroDependientes, setOpcionesFiltroDependientes] = useState({
    municipios: [],
    lugares: [],
  });
  const [defensoresError, setDefensoresError] = useState('');
  const [nuevoDefensorId, setNuevoDefensorId] = useState('');
  const [nuevoDefensorInput, setNuevoDefensorInput] = useState('');
  const [crearDefensorCedula, setCrearDefensorCedula] = useState('');
  const [crearDefensorNombre, setCrearDefensorNombre] = useState('');
  const [crearDefensorError, setCrearDefensorError] = useState('');
  const [crearDefensorSuccess, setCrearDefensorSuccess] = useState('');
  const [guardandoDefensor, setGuardandoDefensor] = useState(false);
  const [pagCedula, setPagCedula] = useState('');
  const [pagValidado, setPagValidado] = useState(null);
  const [validandoPag, setValidandoPag] = useState(false);

  const [fDocumento, setFDocumento] = useState('');
  const [fDepartamento, setFDepartamento] = useState('');
  const [fMunicipio, setFMunicipio] = useState('');
  const [fLugar, setFLugar] = useState('');
  const [fPotencialSubrogado, setFPotencialSubrogado] = useState('');
  const [fDefensorActual, setFDefensorActual] = useState('');
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    documento: '',
    departamento: '',
    municipio: '',
    lugar: '',
    potencialSubrogado: '',
    defensorActual: '',
  });
  const [metaConsulta, setMetaConsulta] = useState(null);
  const deferredNuevoDefensorInput = useDeferredValue(nuevoDefensorInput);

  const buildBackendFilters = useCallback((currentTab, filtros) => {
    const safe = filtros && typeof filtros === 'object' ? filtros : {};
    return {
      documento: String(safe.documento || '').trim(),
      departamento: String(safe.departamento || '').trim(),
      municipio: String(safe.municipio || '').trim(),
      lugar: String(safe.lugar || '').trim(),
      potencialSubrogado: String(safe.potencialSubrogado || '').trim(),
      defensor: currentTab === 'reasignacion' ? String(safe.defensorActual || '').trim() : '',
    };
  }, []);

  const cargarPpl = useCallback(async (filtros = {}, currentTab = 'asignacion') => {
    setCargando(true);
    setError('');
    try {
      const data = await getCondenados({
        limit: DEFAULT_INITIAL_LIMIT,
        filteredLimit: DEFAULT_FILTERED_LIMIT,
        filters: buildBackendFilters(currentTab, filtros),
      });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setMetaConsulta(data?.meta || null);
    } catch (e) {
      reportError(e, 'asignacion-defensores:cargar-ppl');
      setError(String(e?.message || 'Error cargando PPL.'));
      setRows([]);
      setMetaConsulta(null);
    } finally {
      setCargando(false);
    }
  }, [buildBackendFilters]);

  const cargarDefensoresActuales = useCallback(async () => {
    const normalizarLista = (catalogo) => {
      const map = new Map();
      (Array.isArray(catalogo) ? catalogo : []).forEach((item) => {
        const id = String(item?.id || '').trim();
        const nombre = String(item?.nombre || '').trim();
        if (!id || !nombre) return;
        if (!map.has(id)) map.set(id, { id, nombre });
      });
      return Array.from(map.values());
    };

    try {
      const catalogo = await getDefensoresCatalogo();
      let normalizados = normalizarLista(catalogo);

      // Fallback: si el catalogo principal viene vacio en runtime, intenta
      // reconstruir opciones desde el consolidado para no bloquear asignacion.
      if (!normalizados.length) {
        const fallbackRaw = await getDefensoresCondenados();
        normalizados = normalizarLista(extractDefensoresCatalogo(fallbackRaw));
      }

      setDefensores(normalizados);
      setDefensoresError(
        normalizados.length ? '' : 'No se encontraron defensores disponibles en el catálogo.'
      );
    } catch (e) {
      reportError(e, 'asignacion-defensores:cargar-defensores');
      try {
        const fallbackRaw = await getDefensoresCondenados();
        const fallback = normalizarLista(extractDefensoresCatalogo(fallbackRaw));
        setDefensores(fallback);
        setDefensoresError(
          fallback.length
            ? 'Se cargó listado alterno de defensores. Revise conectividad del catálogo principal.'
            : 'No fue posible cargar defensores.'
        );
      } catch (fallbackError) {
        reportError(fallbackError, 'asignacion-defensores:cargar-defensores-fallback');
        setDefensores([]);
        setDefensoresError('No fue posible cargar defensores.');
      }
    }
  }, []);

  const cargarOpcionesFiltro = useCallback(async (filters = {}) => {
    try {
      return await getCondenadosFilterOptions({ tipo: 'condenado', filters });
    } catch (e) {
      reportError(e, 'asignacion-defensores:cargar-opciones-filtro');
      return null;
    }
  }, []);

  useEffect(() => {
    cargarDefensoresActuales();
  }, [cargarDefensoresActuales]);

  useEffect(() => {
    const refrescarDefensores = () => cargarDefensoresActuales();
    const refrescarSiVisible = () => {
      if (document.visibilityState === 'visible') refrescarDefensores();
    };

    window.addEventListener('focus', refrescarDefensores);
    document.addEventListener('visibilitychange', refrescarSiVisible);
    return () => {
      window.removeEventListener('focus', refrescarDefensores);
      document.removeEventListener('visibilitychange', refrescarSiVisible);
    };
  }, [cargarDefensoresActuales]);

  useEffect(() => {
    let active = true;
    cargarOpcionesFiltro().then((data) => {
      if (!active) return;
      setOpcionesFiltro({
        departamentos: Array.isArray(data?.departamentos) ? data.departamentos : [],
        municipios: Array.isArray(data?.municipios) ? data.municipios : [],
        lugares: Array.isArray(data?.lugares) ? data.lugares : [],
      });
    });
    return () => {
      active = false;
    };
  }, [cargarOpcionesFiltro]);

  useEffect(() => {
    let active = true;
    setOpcionesFiltroDependientes({
      municipios: [],
      lugares: [],
    });

    const timeoutId = setTimeout(() => {
      const departamento = String(fDepartamento || '').trim();
      const municipio = String(fMunicipio || '').trim();

      if (!departamento && !municipio) {
        return;
      }

      cargarOpcionesFiltro({ departamento, municipio }).then((data) => {
        if (!active) return;
        setOpcionesFiltroDependientes({
          municipios: Array.isArray(data?.municipios) ? data.municipios : [],
          lugares: Array.isArray(data?.lugares) ? data.lugares : [],
        });
      });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [cargarOpcionesFiltro, fDepartamento, fMunicipio]);

  useEffect(() => {
    if (!pagValidado?.cedula) return;
    cargarPpl({}, 'asignacion');
  }, [cargarPpl, pagValidado?.cedula]);

  const defensoresOrdenados = useMemo(() => {
    return [...defensores].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [defensores]);

  const defensoresSugeridos = useMemo(() => {
    const needle = normalizeDefensorNombre(deferredNuevoDefensorInput);
    if (!needle) return defensoresOrdenados.slice(0, MAX_DEFENSOR_SUGGESTIONS);

    const startsWith = [];
    const includes = [];
    for (const defensor of defensoresOrdenados) {
      const nombre = String(defensor?.nombre || '');
      const normalized = normalizeDefensorNombre(nombre);
      if (!normalized) continue;
      if (normalized.startsWith(needle)) {
        startsWith.push(defensor);
      } else if (normalized.includes(needle)) {
        includes.push(defensor);
      }
      if (startsWith.length + includes.length >= MAX_DEFENSOR_SUGGESTIONS) break;
    }

    return [...startsWith, ...includes].slice(0, MAX_DEFENSOR_SUGGESTIONS);
  }, [defensoresOrdenados, deferredNuevoDefensorInput]);

  const defensoresPorId = useMemo(() => {
    const map = new Map();
    defensores.forEach((item) => {
      const id = String(item?.id || '').trim();
      const nombre = String(item?.nombre || '').trim();
      if (!id || !nombre) return;
      map.set(id, nombre);
    });
    return map;
  }, [defensores]);

  const defensoresPorNombreNormalizado = useMemo(() => {
    const map = new Map();
    defensores.forEach((item) => {
      const id = String(item?.id || '').trim();
      const nombre = String(item?.nombre || '').trim();
      if (!id || !nombre) return;
      const key = normalizeDefensorNombre(nombre);
      if (!key || map.has(key)) return;
      map.set(key, { id, nombre });
    });
    return map;
  }, [defensores]);

  const defensoresActualesOrdenados = useMemo(() => {
    const set = new Set();
    rows.forEach((row) => {
      const nombre = String(row?.defensorAsignado || '').trim();
      if (!nombre || nombre === '-') return;
      set.add(nombre);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const rowsPorDocumento = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const doc = String(row?.numeroIdentificacion || '').trim();
      if (doc && !map.has(doc)) map.set(doc, row);
    });
    return map;
  }, [rows]);

  const departamentos = useMemo(() => {
    if (opcionesFiltro.departamentos.length) return opcionesFiltro.departamentos;
    const set = new Set();
    rows.forEach((r) => {
      const val = String(r?.departamentoLugarReclusion || '').trim();
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [opcionesFiltro.departamentos, rows]);

  const municipios = useMemo(() => {
    if (String(fDepartamento || '').trim()) {
      return opcionesFiltroDependientes.municipios;
    }
    if (opcionesFiltro.municipios.length) return opcionesFiltro.municipios;
    const set = new Set();
    rows.forEach((r) => {
      const val = String(r?.municipioLugarReclusion || '').trim();
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [fDepartamento, opcionesFiltroDependientes.municipios, opcionesFiltro.municipios, rows]);

  const lugares = useMemo(() => {
    if (String(fDepartamento || '').trim() || String(fMunicipio || '').trim()) {
      return opcionesFiltroDependientes.lugares;
    }
    if (opcionesFiltro.lugares.length) return opcionesFiltro.lugares;
    const set = new Set();
    rows.forEach((r) => {
      const val = String(r?.lugarReclusion || '').trim();
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [fDepartamento, fMunicipio, opcionesFiltroDependientes.lugares, opcionesFiltro.lugares, rows]);

  const rowsTab = useMemo(() => {
    if (tab === 'asignacion') return rows.filter((r) => !tieneDefensor(r?.defensorAsignado));
    if (tab === 'reasignacion') return rows.filter((r) => tieneDefensor(r?.defensorAsignado));
    return [];
  }, [rows, tab]);

  const rowsFiltradas = useMemo(() => {
    return rowsTab.map((row, idx) => ({
      ...row,
      rowKey: `${String(row?.numeroIdentificacion || '')}-${idx}`,
      accionImpulsarDisplay: getAccionImpulsarDisplay(row),
    }));
  }, [rowsTab]);

  const sugerenciaReasignacion = useMemo(() => {
    if (tab !== 'asignacion') return '';
    const needle = normalizeDocumento(filtrosAplicados.documento);
    if (!needle) return '';

    const hit = rows.find((r) => {
      const doc = normalizeDocumento(r?.numeroIdentificacion);
      return doc.startsWith(needle) && tieneDefensor(r?.defensorAsignado);
    });

    if (!hit) return '';
    return `El documento ${hit.numeroIdentificacion} ya tiene defensor (${hit.defensorAsignado}). Use la pestaña Reasignación.`;
  }, [tab, rows, filtrosAplicados.documento]);

  const defensorActualSeleccionados = useMemo(() => {
    if (tab !== 'reasignacion') return '-';
    const current = Array.from(seleccionados)
      .map((doc) => rowsPorDocumento.get(String(doc)))
      .filter(Boolean)
      .map((r) => String(r?.defensorAsignado || '-'))
      .filter(Boolean);

    if (!current.length) return '-';
    return Array.from(new Set(current)).join(', ');
  }, [rowsPorDocumento, seleccionados, tab]);

  const toggleSeleccion = useCallback((doc) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(doc)) next.delete(doc);
      else next.add(doc);
      return next;
    });
  }, []);

  async function aplicarFiltros() {
    const nextFiltros = {
      documento: String(fDocumento || '').trim(),
      departamento: String(fDepartamento || '').trim(),
      municipio: String(fMunicipio || '').trim(),
      lugar: String(fLugar || '').trim(),
      potencialSubrogado: String(fPotencialSubrogado || '').trim(),
      defensorActual: tab === 'reasignacion' ? String(fDefensorActual || '').trim() : '',
    };

    setError('');
    setToastOpen(false);
    setSeleccionados(new Set());
    setFiltrosAplicados(nextFiltros);
    await cargarPpl(nextFiltros, tab);
  }

  async function limpiarFiltros() {
    const emptyFiltros = {
      documento: '',
      departamento: '',
      municipio: '',
      lugar: '',
      potencialSubrogado: '',
      defensorActual: '',
    };
    setFDocumento('');
    setFDepartamento('');
    setFMunicipio('');
    setFLugar('');
    setFPotencialSubrogado('');
    setFDefensorActual('');
    setFiltrosAplicados(emptyFiltros);
    setSeleccionados(new Set());
    setError('');
    setToastOpen(false);
    await cargarPpl(emptyFiltros, tab);
  }

  async function validarPag() {
    const cedula = normalizeDocumento(pagCedula);
    if (!cedula) {
      setPagValidado(null);
      setError('Ingrese la cedula del PAG.');
      return;
    }

    setValidandoPag(true);
    setError('');
    try {
      const pag = await validatePagCedula(cedula);
      setPagCedula(cedula);
      setPagValidado(pag || { cedula });
    } catch (e) {
      reportError(e, 'asignacion-defensores:validar-pag');
      setPagValidado(null);
      setError(String(e?.message || 'No fue posible validar la cedula del PAG.'));
    } finally {
      setValidandoPag(false);
    }
  }

  async function guardarAsignacion() {
    if (!pagValidado?.cedula) {
      setError('Debe validar la cedula del PAG antes de guardar.');
      return;
    }

    const documentos = Array.from(seleccionados);
    if (!documentos.length) {
      setError('Seleccione al menos un PPL.');
      return;
    }

    let defensor = String(defensoresPorId.get(nuevoDefensorId) || '').trim();
    if (!defensor) {
      const typedKey = normalizeDefensorNombre(nuevoDefensorInput);
      const hit = typedKey ? defensoresPorNombreNormalizado.get(typedKey) : null;
      if (hit?.id) {
        defensor = String(hit.nombre || '').trim();
        setNuevoDefensorId(hit.id);
      }
    }
    if (!defensor) {
      setError('Seleccione un defensor válido de la lista.');
      return;
    }

    if (tab === 'asignacion') {
      const conDefensor = rows.filter(
        (r) =>
          seleccionados.has(String(r.numeroIdentificacion)) &&
          tieneDefensor(r?.defensorAsignado)
      );
      if (conDefensor.length > 0) {
        setError('Hay casos con defensor asignado. Use la pestaña Reasignación.');
        return;
      }
    }

    if (tab === 'reasignacion') {
      const confirmar = window.confirm('¿Confirmar reasignación?');
      if (!confirmar) return;
    }

    setCargando(true);
    setError('');
    setToastOpen(false);
    try {
      const defensorCedula = /^\d+$/.test(String(nuevoDefensorId || '').trim())
        ? String(nuevoDefensorId || '').trim()
        : '';
      const data = await assignDefensorPpl(documentos, defensor, {
        pagCedula: pagValidado.cedula,
        ...(defensorCedula ? { defensorCedula } : {}),
      });

      setToastMessage(
        isQueuedResponse(data)
          ? 'Asignacion guardada en cola. Se sincronizara cuando vuelva la conexion.'
          : 'Aurora - Cambios guardados correctamente'
      );
      setToastOpen(true);
      setSeleccionados(new Set());
      if (!isQueuedResponse(data)) {
        await cargarPpl(filtrosAplicados, tab);
        await cargarDefensoresActuales();
      }
    } catch (e) {
      reportError(e, 'asignacion-defensores:guardar');
      setError(String(e?.message || 'Error guardando la asignación.'));
    } finally {
      setCargando(false);
    }
  }

  async function guardarNuevoDefensor() {
    const cedula = normalizeDocumento(crearDefensorCedula);
    const nombre = normalizeDefensorNombre(crearDefensorNombre);
    setCrearDefensorSuccess('');

    if (!cedula) {
      setCrearDefensorError('La cedula del defensor es obligatoria.');
      return;
    }
    if (!nombre) {
      setCrearDefensorError('El nombre del defensor es obligatorio.');
      return;
    }
    if (!isNombreDefensorValido(nombre)) {
      setCrearDefensorError('El nombre solo puede contener letras y espacios.');
      return;
    }

    const existe = defensores.some((d) => normalizeDefensorNombre(d?.nombre) === nombre);
    if (existe) {
      setCrearDefensorError('El defensor ya existe.');
      return;
    }

    setGuardandoDefensor(true);
    setCrearDefensorError('');
    try {
      const data = await createDefensor({ cedula, nombre });
      const creado = normalizeDefensorNombre(data?.defensor || nombre);
      const opcionCreada = data?.opcion;
      const opcionNormalizada = {
        id: String(opcionCreada?.id || cedula),
        nombre: String(opcionCreada?.nombre || creado),
      };

      setDefensores((prev) => {
        const sinDuplicado = prev.filter(
          (item) =>
            String(item?.id || '') !== opcionNormalizada.id &&
            normalizeDefensorNombre(item?.nombre) !== normalizeDefensorNombre(opcionNormalizada.nombre)
        );
        return [...sinDuplicado, opcionNormalizada];
      });
      setNuevoDefensorId(opcionNormalizada.id);
      setNuevoDefensorInput(opcionNormalizada.nombre);
      setCrearDefensorCedula('');
      setCrearDefensorNombre('');
      setCrearDefensorSuccess(
        isQueuedResponse(data)
          ? 'Defensor guardado en cola. Se sincronizara cuando vuelva la conexion.'
          : 'Defensor creado correctamente'
      );
      if (!isQueuedResponse(data)) {
        await cargarDefensoresActuales();
        setDefensores((prev) => {
          if (prev.some((item) => String(item?.id || '') === opcionNormalizada.id)) return prev;
          return [...prev, opcionNormalizada];
        });
        window.dispatchEvent(new CustomEvent('aurora:defensores-updated'));
      }
    } catch (e) {
      reportError(e, 'asignacion-defensores:crear-defensor');
      setCrearDefensorError(String(e?.message || 'Error guardando defensor.'));
    } finally {
      setGuardandoDefensor(false);
    }
  }

  function cambiarTab(nextTab) {
    setTab(nextTab);
    setSeleccionados(new Set());
    setError('');
    setToastOpen(false);
    setCrearDefensorError('');
    setCrearDefensorSuccess('');
    setNuevoDefensorId('');
    setNuevoDefensorInput('');

    if (nextTab === 'usuariosPag') return;

    if (nextTab === 'asignacion' || nextTab === 'reasignacion') {
      cargarDefensoresActuales();
    }

    if (nextTab === 'asignacion') {
      setFDefensorActual('');
      const nextFiltros = { ...(filtrosAplicados || {}), defensorActual: '' };
      setFiltrosAplicados(nextFiltros);
      if (pagValidado?.cedula) cargarPpl(nextFiltros, nextTab);
      return;
    }

    if (pagValidado?.cedula) cargarPpl(filtrosAplicados, nextTab);
  }

  const botonGuardarDefensorDeshabilitado =
    guardandoDefensor ||
    String(crearDefensorCedula || '').trim() === '' ||
    String(crearDefensorNombre || '').trim() === '';
  const mostrarOverlayCarga = !['crearDefensor', 'usuariosPag'].includes(tab) && (cargando || validandoPag);
  const mensajeOverlayCarga = 'Cargando información...';

  return (
    <div className="card loading-layer-host">
      <h2>PAG - Asignación de casos de condenados</h2>

      <Toast
        open={toastOpen}
        message={toastMessage}
        onClose={() => setToastOpen(false)}
      />

      {!['crearDefensor', 'usuariosPag'].includes(tab) && metaConsulta?.filtered && (
        <p className="hint-text">
          {metaConsulta?.truncated
            ? metaConsulta?.totalMatchedExact === false
              ? `Se muestran los primeros ${metaConsulta?.returned || 0} registros. Hay más resultados; ajuste los filtros para precisar la búsqueda.`
              : `Se encontraron ${metaConsulta?.totalMatched || 0} registros y se muestran los primeros ${metaConsulta?.returned || 0}.`
            : `Se encontraron ${metaConsulta?.returned || metaConsulta?.totalMatched || 0} registros.`}
        </p>
      )}

      {!['crearDefensor', 'usuariosPag'].includes(tab) && error && <p className="hint-text">{error}</p>}
      {!['crearDefensor', 'usuariosPag'].includes(tab) && sugerenciaReasignacion && (
        <p className="hint-text">{sugerenciaReasignacion}</p>
      )}

      <div className="search-row" style={{ marginTop: '0.75rem' }}>
        <button
          className={`primary-button aurora-tab ${tab === 'asignacion' ? 'active' : ''}`}
          type="button"
          aria-pressed={tab === 'asignacion'}
          onClick={() => cambiarTab('asignacion')}
        >
          Asignación
        </button>
        <button
          className={`primary-button aurora-tab ${tab === 'reasignacion' ? 'active' : ''}`}
          type="button"
          aria-pressed={tab === 'reasignacion'}
          onClick={() => cambiarTab('reasignacion')}
        >
          Reasignación
        </button>
        <button
          className={`primary-button aurora-tab ${tab === 'crearDefensor' ? 'active' : ''}`}
          type="button"
          aria-pressed={tab === 'crearDefensor'}
          onClick={() => cambiarTab('crearDefensor')}
        >
          Crear defensor
        </button>
        {isAdmin ? (
          <button
            className={`primary-button aurora-tab ${tab === 'usuariosPag' ? 'active' : ''}`}
            type="button"
            aria-pressed={tab === 'usuariosPag'}
            onClick={() => cambiarTab('usuariosPag')}
          >
            Accesos PAG
          </button>
        ) : null}
      </div>

      {tab === 'crearDefensor' ? (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 className="block-title">Crear defensor</h3>
          <div className="grid-2">
            <div className="form-field">
              <label>Numero de cedula del defensor</label>
              <input
                className="input-text"
                placeholder="Ingrese cedula del defensor"
                value={crearDefensorCedula}
                onChange={(e) => {
                  setCrearDefensorCedula(normalizeDocumento(e.target.value));
                  if (crearDefensorError) setCrearDefensorError('');
                  if (crearDefensorSuccess) setCrearDefensorSuccess('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    guardarNuevoDefensor();
                  }
                }}
              />
            </div>
            <div className="form-field">
              <label>Nombre completo del defensor</label>
              <input
                className="input-text"
                placeholder="Ingrese nombre completo en MAYÚSCULA"
                value={crearDefensorNombre}
                onChange={(e) => {
                  setCrearDefensorNombre(String(e.target.value || '').toUpperCase());
                  if (crearDefensorError) setCrearDefensorError('');
                  if (crearDefensorSuccess) setCrearDefensorSuccess('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    guardarNuevoDefensor();
                  }
                }}
              />
              <p className="hint-text">El nombre debe ingresarse completo y en MAYÚSCULA.</p>
              {crearDefensorError && <p className="hint-text">{crearDefensorError}</p>}
              {crearDefensorSuccess && <p className="hint-text">{crearDefensorSuccess}</p>}
              {guardandoDefensor && <p className="hint-text">Guardando defensor...</p>}
            </div>
          </div>
          <div className="actions-center">
            <button
              className="save-button"
              type="button"
              onClick={guardarNuevoDefensor}
              disabled={botonGuardarDefensorDeshabilitado}
            >
              Guardar defensor
            </button>
          </div>
        </div>
      ) : tab === 'usuariosPag' && isAdmin ? (
        <PagUsuariosAdmin />
      ) : (
        <>
      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 className="block-title">Validacion de PAG</h3>
        <div className="grid-2">
          <div className="form-field">
            <label>Numero de cedula del PAG</label>
            <input
              className="input-text"
              placeholder="Ingrese cedula de PAG"
              value={pagCedula}
              onChange={(e) => {
                const nextCedula = normalizeDocumento(e.target.value);
                setPagCedula(nextCedula);
                if (pagValidado?.cedula !== nextCedula) {
                  setPagValidado(null);
                  setRows([]);
                  setMetaConsulta(null);
                  setSeleccionados(new Set());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  validarPag();
                }
              }}
            />
            {validandoPag && <p className="hint-text">Validando cedula PAG...</p>}
            {pagValidado?.cedula && (
              <p className="hint-text">
                PAG validado: {pagValidado?.nombre || '-'} ({pagValidado.cedula})
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="primary-button" type="button" onClick={validarPag} disabled={validandoPag}>
              Validar PAG
            </button>
          </div>
        </div>
      </div>

      {pagValidado?.cedula ? (
        <>
      <div className="filter-panel" style={{ marginTop: '1rem' }}>
        <h3 className="filter-title">Filtros</h3>

        <div className="grid-2" style={{ marginTop: '1rem' }}>
          {tab === 'reasignacion' && (
            <div className="form-field">
              <label>Defensor público actual</label>
              <input
                list="pag-defensores-actual-list"
                className="input-text"
                placeholder="Filtrar defensor actual"
                value={fDefensorActual}
                onChange={(e) => setFDefensorActual(e.target.value)}
              />
              <datalist id="pag-defensores-actual-list">
                {defensoresActualesOrdenados.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          )}

          <div className="form-field">
            <label>Departamento del lugar de reclusión</label>
            <input
              list="pag-departamentos-list"
              className="input-text"
              placeholder="Filtrar departamento"
              value={fDepartamento}
              onChange={(e) => {
                setFDepartamento(e.target.value);
                setFMunicipio('');
                setFLugar('');
              }}
            />
            <datalist id="pag-departamentos-list">
              {departamentos.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>

          <div className="form-field">
            <label>Municipio del lugar de reclusión</label>
            <input
              list="pag-municipios-list"
              className="input-text"
              placeholder="Filtrar municipio"
              value={fMunicipio}
              onChange={(e) => {
                setFMunicipio(e.target.value);
                setFLugar('');
              }}
            />
            <datalist id="pag-municipios-list">
              {municipios.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div className="form-field">
            <label>Nombre del lugar de privación de la libertad</label>
            <input
              list="pag-lugares-list"
              className="input-text"
              placeholder="Filtrar lugar de reclusión"
              value={fLugar}
              onChange={(e) => setFLugar(e.target.value)}
            />
            <datalist id="pag-lugares-list">
              {lugares.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>

          <div className="form-field">
            <label>Número de identificación</label>
            <input
              className="input-text"
              placeholder="Filtrar por documento"
              value={fDocumento}
              onChange={(e) => setFDocumento(String(e.target.value || '').replace(/\D+/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  aplicarFiltros();
                }
              }}
            />
          </div>

          <div className="form-field">
            <label>Potenciales candidatos de solicitudes</label>
            <select
              value={fPotencialSubrogado}
              onChange={(e) => setFPotencialSubrogado(String(e.target.value || '').trim())}
            >
              <option value="">Todas las personas condenadas</option>
              <option value="potenciales_beneficiarios">Potenciales beneficiarios</option>
              <option value="mujeres_potenciales_utilidad_publica">
                Mujeres potenciales beneficiarias únicamente de Utilidad Pública
              </option>
              <option value="proximos_requisito_temporal">Personas próximas a cumplir requisito temporal</option>
              <option value="no_reunen_requisitos">Condenados que no reúnen los requisitos</option>
            </select>
            <p className="hint-text">
              Criterio: campo CATEGORIZACION de situación carcelaria.
            </p>
          </div>
        </div>

        <div className="actions-center" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <button className="primary-button" type="button" onClick={aplicarFiltros}>
            Filtrar
          </button>
          <button className="primary-button" type="button" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        </div>

        {(filtrosAplicados.departamento ||
          filtrosAplicados.municipio ||
          filtrosAplicados.lugar ||
          filtrosAplicados.documento ||
          filtrosAplicados.potencialSubrogado ||
          (tab === 'reasignacion' && filtrosAplicados.defensorActual)) && (
          <p className="hint-text" style={{ marginTop: '0.75rem' }}>
            Filtros aplicados:{' '}
            {tab === 'reasignacion' ? `${filtrosAplicados.defensorActual || '-'} / ` : ''}
            {filtrosAplicados.departamento || '-'} / {filtrosAplicados.municipio || '-'} /{' '}
            {filtrosAplicados.lugar || '-'} / {filtrosAplicados.documento || '-'} /{' '}
            {filtrosAplicados.potencialSubrogado === 'potenciales_beneficiarios'
              ? 'Potenciales beneficiarios'
              : filtrosAplicados.potencialSubrogado === 'mujeres_potenciales_utilidad_publica'
                ? 'Mujeres potenciales beneficiarias únicamente de Utilidad Pública'
              : filtrosAplicados.potencialSubrogado === 'proximos_requisito_temporal'
                ? 'Próximos a cumplir requisito temporal'
                : filtrosAplicados.potencialSubrogado === 'no_reunen_requisitos'
                  ? 'No reúnen requisitos'
                  : 'Todas las personas condenadas'}
          </p>
        )}
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 className="block-title">
          {tab === 'asignacion' ? 'Asignación de defensor' : 'Reasignación de defensor'}
        </h3>

        {tab === 'reasignacion' && (
          <p className="hint-text">Defensor actual (seleccionados): {defensorActualSeleccionados}</p>
        )}

        <div className="grid-2">
          <div className="form-field">
            <label>Nuevo defensor</label>
            <input
              list="pag-nuevo-defensor-list"
              className="input-text"
              placeholder="Escriba para buscar defensor"
              value={nuevoDefensorInput}
              onChange={(e) => {
                const next = String(e.target.value || '');
                setNuevoDefensorInput(next);
                const hit = defensoresPorNombreNormalizado.get(normalizeDefensorNombre(next));
                setNuevoDefensorId(hit?.id ? String(hit.id) : '');
              }}
            />
            <datalist id="pag-nuevo-defensor-list">
              {defensoresSugeridos.map((d) => (
                <option key={d.id} value={d.nombre} />
              ))}
            </datalist>
            {defensoresError && <p className="hint-text">{defensoresError}</p>}
            {!defensoresError && defensoresOrdenados.length === 0 && (
              <p className="hint-text">No hay defensores para mostrar.</p>
            )}
            <button
              className="primary-button"
              type="button"
              onClick={cargarDefensoresActuales}
              style={{ marginTop: '0.5rem' }}
            >
              Recargar defensores
            </button>
          </div>
          <div />
        </div>

        <div className="actions-center">
          <button className="save-button" onClick={guardarAsignacion} disabled={cargando || !pagValidado?.cedula}>
            {tab === 'asignacion' ? 'GUARDAR ASIGNACIÓN' : 'GUARDAR REASIGNACIÓN'}
          </button>
        </div>
      </div>

      <div className="pag-layout" style={{ marginTop: '1rem' }}>
        <div className="pag-table-shell">
          <div className="table-container tall tabla-asignacion-wrapper pag-table-container">
            <table className="data-table tabla-asignacion pag-table">
              <thead>
                <tr>
                  <th />
                  <th>Situación jurídica</th>
                  <th>Número de identificación</th>
                  <th>Nombre usuario</th>
                  <th>Departamento de reclusión</th>
                  <th>Municipio de reclusión</th>
                  <th>Acción a impulsar</th>
                  <th>Defensor actual</th>
                  <th>Lugar de reclusión</th>
                  <th>Autoridad a cargo</th>
                  <th>Número de proceso</th>
                </tr>
              </thead>
              <tbody>
                {rowsFiltradas.map((r) => {
                  const doc = String(r.numeroIdentificacion);
                  return (
                    <AsignacionRow
                      key={r.rowKey}
                      row={r}
                      selected={seleccionados.has(doc)}
                      onToggle={toggleSeleccion}
                    />
                  );
                })}

                {!cargando && rowsFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '1rem' }}>
                      No hay registros para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
        </>
      ) : (
        <p className="hint-text" style={{ marginTop: '0.75rem' }}>
          Valide la cedula del PAG para habilitar filtros y asignacion.
        </p>
      )}
        </>
      )}
      <LoadingOverlay show={mostrarOverlayCarga} message={mensajeOverlayCarga} />
    </div>
  );
}

export default AsignacionDefensores;
