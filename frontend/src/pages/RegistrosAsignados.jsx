import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCondenados, getDefensoresCatalogo } from '../services/api.js';
import { pickActiveCaseData } from '../utils/entrevistaEstado.js';
import { displayOrDash } from '../utils/pplDisplay.js';
import { getEstadoDisplayInfo } from '../config/estadoActuaciones.rules.ts';

function prettifyHeader(key) {
  if (!key) return '';
  const spaced = String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const EXTRA_COLUMNS = ['posibleActuacionJudicial'];
const ROWS_PER_PAGE = 200;
const DEFAULT_INITIAL_LIMIT = 1000;
const DEFAULT_FILTERED_LIMIT = 200;
const ESTADOS_TRAMITE_OPTIONS = [
  'Analizar el caso',
  'Entrevistar al usuario',
  'Presentar solicitud',
  'Pendiente decisi\u00f3n',
  'Caso cerrado',
];

const HEADER_LABELS = {
  Title: 'N\u00famero de identificaci\u00f3n',
  TITLE: 'N\u00famero de identificaci\u00f3n',
  title: 'N\u00famero de identificaci\u00f3n',
  numeroIdentificacion: 'N\u00famero de identificaci\u00f3n',
  establecimientoReclusion: 'Lugar de reclusi\u00f3n',
  departamentoEron: 'Departamento del lugar de reclusi\u00f3n',
  municipioEron: 'Municipio del lugar de reclusi\u00f3n',
  numeroProceso: 'N\u00famero de proceso',
  numeroProcesoJudicial: 'N\u00famero de proceso',
  proceso: 'N\u00famero de proceso',
  Proceso: 'N\u00famero de proceso',
  PROCESO: 'N\u00famero de proceso',
  posibleActuacionJudicial: 'Posible actuaci\u00f3n judicial a adelantar',
};

function getHeaderLabel(key) {
  if (!key) return '';
  if (HEADER_LABELS[key]) return HEADER_LABELS[key];
  return prettifyHeader(key);
}

function getCellValue(row, key) {
  if (key === 'posibleActuacionJudicial') {
    return row?.posibleActuacionJudicial ?? '-';
  }
  const data = pickActiveCaseData(row);
  return data?.[key];
}

function findDocumentoKey(columns) {
  if (!Array.isArray(columns)) return null;
  const candidates = [
    'N\u00famero de identificaci\u00f3n',
    'Numero de identificacion',
    'numeroIdentificacion',
    'documento',
    'cedula',
    'noDocumento',
    'numero_documento',
    'id',
    'identificacion',
  ];
  const lowerMap = new Map(columns.map((c) => [String(c).toLowerCase(), c]));
  for (const cand of candidates) {
    const hit = lowerMap.get(cand.toLowerCase());
    if (hit) return hit;
  }
  const fallback = columns.find((c) => /doc|ident|cedul|id/i.test(String(c)));
  return fallback || null;
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function distinctSorted(rows, getter) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const val = String(getter(row) || '').trim();
    if (!val) return;
    const key = val.toLowerCase();
    if (!map.has(key)) map.set(key, val);
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

function DropdownField({ label, value, onChange, options, searchable = false, listId }) {
  const normalizedOptions = (Array.isArray(options) ? options : []).map((opt) => {
    if (opt && typeof opt === 'object') {
      return {
        value: String(opt.value ?? ''),
        label: String(opt.label ?? opt.value ?? ''),
      };
    }
    return {
      value: String(opt ?? ''),
      label: String(opt ?? ''),
    };
  });
  const selectedLabel = normalizedOptions.find((opt) => opt.value === String(value ?? ''))?.label ?? '';

  return (
    <div className="form-field">
      <label>{label}</label>
      {searchable ? (
        <>
          <input
            list={listId}
            className="input-text"
            placeholder="Seleccione"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <datalist id={listId}>
            {normalizedOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </datalist>
        </>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          title={selectedLabel || undefined}
        >
          <option value="">Todos</option>
          {normalizedOptions.map((opt) => (
            <option key={opt.value} value={opt.value} title={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder = 'Escriba para buscar',
  listId,
  options,
  type = 'text',
  inputMode,
  pattern,
}) {
  const normalizedOptions = (Array.isArray(options) ? options : []).map((opt) => String(opt ?? '').trim()).filter(Boolean);
  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        list={listId}
        className="input-text"
        type={type}
        inputMode={inputMode}
        pattern={pattern}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {listId && normalizedOptions.length > 0 && (
        <datalist id={listId}>
          {normalizedOptions.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      )}
    </div>
  );
}

function getColumnWidth(col) {
  const widths = {
    __situacionJuridica__: 110,
    __numeroIdentificacion__: 130,
    __nombreUsuario__: 145,
    __defensor__: 120,
    __lugarPrivacion__: 155,
    __estadoTramite__: 100,
    __departamentoReclusion__: 140,
    __municipioReclusion__: 130,
  };
  return widths[col] || 145;
}

export default function RegistrosAsignados({ onSelectRegistro }) {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);

  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  const [filtrosDraft, setFiltrosDraft] = useState({
    defensor: '',
    nombre: '',
    documento: '',
    lugar: '',
    departamento: '',
    municipio: '',
    estado: '',
  });
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    defensor: '',
    nombre: '',
    documento: '',
    lugar: '',
    departamento: '',
    municipio: '',
    estado: '',
  });
  const [metaConsulta, setMetaConsulta] = useState(null);
  const [filtroAdicionalSeleccionado, setFiltroAdicionalSeleccionado] = useState('');
  const [pagina, setPagina] = useState(1);

  const [defensores, setDefensores] = useState([]);
  const isDev = typeof import.meta !== 'undefined' && import.meta?.env?.DEV;
  const estadoInfoCacheRef = useRef(new WeakMap());

  function getNumeroIdentificacionValue(obj) {
    const data = pickActiveCaseData(obj);
    return (
      data?.['N\u00famero de identificaci\u00f3n'] ??
      data?.['Numero de identificacion'] ??
      data?.numeroIdentificacion ??
      data?.Title ??
      data?.title ??
      ''
    );
  }

  function getNombreUsuarioValue(obj) {
    const data = pickActiveCaseData(obj);
    return data?.Nombre ?? data?.['Nombre usuario'] ?? data?.nombreUsuario ?? data?.nombre ?? '';
  }

  function getSituacionJuridicaValue(obj) {
    const data = pickActiveCaseData(obj);
    return (
      data?.['Situaci\u00f3n jur\u00eddica actualizada (de conformidad con la rama judicial)'] ??
      data?.['Situacion juridica actualizada (de conformidad con la rama judicial)'] ??
      data?.['Situaci\u00f3n jur\u00eddica'] ??
      data?.['Situacion juridica'] ??
      data?.situacionJuridicaActualizada ??
      data?.situacionJuridica ??
      ''
    );
  }

  function getDefensorValue(obj) {
    const data = pickActiveCaseData(obj);
    return (
      data?.['Defensor(a) P\u00fablico(a) Asignado para tramitar la solicitud'] ??
      data?.['Defensor(a) Publico(a) Asignado para tramitar la solicitud'] ??
      data?.defensorAsignado ??
      data?.defensor ??
      ''
    );
  }

  function getLugarPrivacionValue(obj) {
    const data = pickActiveCaseData(obj);
    return (
      data?.['Nombre del lugar de privaci\u00f3n de la libertad'] ??
      data?.['Nombre del lugar de privacion de la libertad'] ??
      data?.establecimientoReclusion ??
      data?.Establecimiento ??
      data?.lugarReclusion ??
      ''
    );
  }

  function getDepartamentoPrivacionValue(obj) {
    const data = pickActiveCaseData(obj);
    return (
      data?.['Departamento del lugar de privaci\u00f3n de la libertad'] ??
      data?.['Departamento del lugar de privacion de la libertad'] ??
      data?.departamentoLugarReclusion ??
      data?.departamentoEron ??
      data?.departamento ??
      ''
    );
  }

  function getMunicipioPrivacionValue(obj) {
    const data = pickActiveCaseData(obj);
    return (
      data?.['Distrito/municipio del lugar de privaci\u00f3n de la libertad'] ??
      data?.['Distrito/municipio del lugar de privacion de la libertad'] ??
      data?.municipioLugarReclusion ??
      data?.municipioEron ??
      data?.municipio ??
      ''
    );
  }

  function getEstadoDisplayInfoMemo(obj) {
    if (!obj || typeof obj !== 'object') return getEstadoDisplayInfo(obj);
    const cached = estadoInfoCacheRef.current.get(obj);
    if (cached) return cached;
    const computed = getEstadoDisplayInfo(obj);
    estadoInfoCacheRef.current.set(obj, computed);
    return computed;
  }

  function setFiltroDraft(key, value) {
    setFiltrosDraft((prev) => ({ ...prev, [key]: value }));
  }

  function seleccionarFiltroAdicional(value) {
    const selected = String(value || '').trim();
    setFiltroAdicionalSeleccionado(selected);
    setFiltrosDraft((prev) => ({
      ...prev,
      nombre: selected === 'nombre' ? prev.nombre : '',
      lugar: selected === 'lugar' ? prev.lugar : '',
      departamento: selected === 'departamento' ? prev.departamento : '',
      municipio: selected === 'municipio' ? prev.municipio : '',
      estado: selected === 'estado' ? prev.estado : '',
    }));
    setFiltrosAplicados((prev) => ({
      ...prev,
      nombre: selected === 'nombre' ? prev.nombre : '',
      lugar: selected === 'lugar' ? prev.lugar : '',
      departamento: selected === 'departamento' ? prev.departamento : '',
      municipio: selected === 'municipio' ? prev.municipio : '',
      estado: selected === 'estado' ? prev.estado : '',
    }));
  }

  function buildBackendFilters(filters) {
    const safe = filters && typeof filters === 'object' ? filters : {};
    return {
      defensor: String(safe.defensor || '').trim(),
      nombre: String(safe.nombre || '').trim(),
      documento: String(safe.documento || '').trim(),
      lugar: String(safe.lugar || '').trim(),
      departamento: String(safe.departamento || '').trim(),
      municipio: String(safe.municipio || '').trim(),
      estado: String(safe.estado || '').trim(),
    };
  }

  const cargarRowsFromBackend = useCallback(async (nextFiltros = {}) => {
    setCargando(true);
    setErrorCarga('');
    try {
      const data = await getCondenados({
        limit: DEFAULT_INITIAL_LIMIT,
        filteredLimit: DEFAULT_FILTERED_LIMIT,
        filters: buildBackendFilters(nextFiltros),
      });

      const cols = Array.isArray(data?.columns) ? data.columns : [];
      const rws = Array.isArray(data?.rows) ? data.rows : [];

      const inferred =
        cols.length > 0
          ? cols
          : Array.from(
              rws.reduce((acc, r) => {
                Object.keys(r || {}).forEach((k) => acc.add(k));
                return acc;
              }, new Set())
            );

      const withExtras = [...inferred];
      for (const extra of EXTRA_COLUMNS) {
        if (!withExtras.includes(extra)) withExtras.push(extra);
      }

      setColumns(withExtras);
      setRows(rws);
      setMetaConsulta(data?.meta || null);
      setPagina(1);
    } catch (e) {
      console.error(e);
      setErrorCarga(String(e?.message || 'No fue posible cargar los usuarios asignados.'));
      setColumns([]);
      setRows([]);
      setMetaConsulta(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    async function cargarDefensores() {
      try {
        const catalogo = await getDefensoresCatalogo();
        const a = catalogo.map((item) => String(item?.nombre || '').trim()).filter(Boolean);

        const map = new Map();
        a.forEach((name) => {
          const val = String(name || '').trim();
          if (!val) return;
          const key = val.toLowerCase();
          if (!map.has(key)) map.set(key, val);
        });

        if (alive) setDefensores(Array.from(map.values()));
      } catch (e) {
        console.error(e);
        if (alive) setDefensores([]);
      }
    }

    cargarDefensores();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    cargarRowsFromBackend();
  }, [cargarRowsFromBackend]);

  useEffect(() => {
    estadoInfoCacheRef.current = new WeakMap();
  }, [rows]);

  useEffect(() => {
    setDefensores((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const set = new Set(base.map((d) => String(d || '').trim()).filter(Boolean).map((d) => d.toLowerCase()));
      const merged = [...base];

      rows.forEach((r) => {
        const val = String(getDefensorValue(r) || '').trim();
        if (!val) return;
        const key = val.toLowerCase();
        if (set.has(key)) return;
        set.add(key);
        merged.push(val);
      });

      merged.sort((a, b) => a.localeCompare(b));
      return merged;
    });
  }, [rows]);

  const defensoresOrdenados = useMemo(() => {
    return [...defensores].sort((a, b) => a.localeCompare(b));
  }, [defensores]);

  const documentoKey = useMemo(() => findDocumentoKey(columns), [columns]);

  const lugaresDisponibles = useMemo(() => distinctSorted(rows, getLugarPrivacionValue), [rows]);
  const departamentosDisponibles = useMemo(() => distinctSorted(rows, getDepartamentoPrivacionValue), [rows]);

  const estadosDisponibles = useMemo(() => ESTADOS_TRAMITE_OPTIONS, []);


  const municipiosDisponiblesDraft = useMemo(() => {
    const depNeedle = normalize(filtrosDraft.departamento);
    const candidates = depNeedle
      ? rows.filter((r) => normalize(getDepartamentoPrivacionValue(r)) === depNeedle)
      : rows;
    return distinctSorted(candidates, getMunicipioPrivacionValue);
  }, [rows, filtrosDraft.departamento]);

  useEffect(() => {
    if (!filtrosDraft.municipio) return;
    const exists = municipiosDisponiblesDraft.some((m) => normalize(m) === normalize(filtrosDraft.municipio));
    if (!exists) {
      setFiltrosDraft((prev) => ({ ...prev, municipio: '' }));
    }
  }, [filtrosDraft.municipio, municipiosDisponiblesDraft]);

  const rowsFiltradas = useMemo(() => rows, [rows]);

  const totalPaginas = useMemo(() => Math.max(1, Math.ceil(rowsFiltradas.length / ROWS_PER_PAGE)), [rowsFiltradas.length]);
  const paginaActual = Math.min(pagina, totalPaginas);

  const rowsPaginaActual = useMemo(() => {
    const inicio = (paginaActual - 1) * ROWS_PER_PAGE;
    return rowsFiltradas.slice(inicio, inicio + ROWS_PER_PAGE);
  }, [rowsFiltradas, paginaActual]);

  useEffect(() => {
    if (!isDev) return;
  }, [isDev, rowsFiltradas.length, rowsPaginaActual.length]);

  useEffect(() => {
    setPagina(1);
  }, [filtrosAplicados, rows]);

  useEffect(() => {
    if (pagina > totalPaginas) {
      setPagina(totalPaginas);
    }
  }, [pagina, totalPaginas]);

  async function aplicarFiltros() {
    const next = {
      defensor: String(filtrosDraft.defensor || '').trim(),
      nombre: String(filtrosDraft.nombre || '').trim(),
      documento: String(filtrosDraft.documento || '').trim(),
      lugar: String(filtrosDraft.lugar || '').trim(),
      departamento: String(filtrosDraft.departamento || '').trim(),
      municipio: String(filtrosDraft.municipio || '').trim(),
      estado: String(filtrosDraft.estado || '').trim(),
    };

    setFiltrosDraft(next);
    setFiltrosAplicados(next);
    await cargarRowsFromBackend(next);
  }

  async function reiniciar() {
    const empty = {
      defensor: '',
      nombre: '',
      documento: '',
      lugar: '',
      departamento: '',
      municipio: '',
      estado: '',
    };
    setFiltrosDraft(empty);
    setFiltrosAplicados(empty);
    setFiltroAdicionalSeleccionado('');
    await cargarRowsFromBackend(empty);
  }

  const orderedColumns = useMemo(() => {
    const fixed = [
      '__situacionJuridica__',
      '__numeroIdentificacion__',
      '__nombreUsuario__',
      '__defensor__',
      '__lugarPrivacion__',
      '__estadoTramite__',
      '__departamentoReclusion__',
      '__municipioReclusion__',
    ];

    const remove = new Set([
      'Situaci\u00f3n jur\u00eddica',
      'Situacion juridica',
      'Situaci\u00f3n jur\u00eddica actualizada (de conformidad con la rama judicial)',
      'Situacion juridica actualizada (de conformidad con la rama judicial)',
      'N\u00famero de identificaci\u00f3n',
      'Numero de identificacion',
      'Nombre',
      'Defensor(a) P\u00fablico(a) Asignado para tramitar la solicitud',
      'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
      'Nombre del lugar de privaci\u00f3n de la libertad',
      'Nombre del lugar de privacion de la libertad',
      'Departamento del lugar de privaci\u00f3n de la libertad',
      'Departamento del lugar de privacion de la libertad',
      'Distrito/municipio del lugar de privaci\u00f3n de la libertad',
      'Distrito/municipio del lugar de privacion de la libertad',
      'Estado del caso',
      'numeroIdentificacion',
      'Title',
      'title',
      'TITLE',
      'Nombre usuario',
      'nombre',
      'nombreUsuario',
      'NombreUsuario',
      'Situaci\u00f3n jur\u00eddica ',
      'Situacion juridica ',
      'situacionJuridica',
      'situacionJuridicaActualizada',
      'Departamento del lugar de reclusi\u00f3n',
      'Departamento del lugar de reclusion',
      'departamentoLugarReclusion',
      'departamentoEron',
      'departamento',
      'Municipio del lugar de reclusi\u00f3n',
      'Municipio del lugar de reclusion',
      'municipioLugarReclusion',
      'municipioEron',
      'municipio',
      'Estado entrevista',
      'estadoEntrevista',
      'estado',
      'casos',
      'activeCaseId',
    ]);

    const rest = (columns || []).filter((c) => !remove.has(c));
    return [...fixed, ...rest];
  }, [columns]);

  function renderHeader(col) {
    if (col === '__situacionJuridica__') return 'SITUACI\u00d3N JUR\u00cdDICA';
    if (col === '__numeroIdentificacion__') return 'N\u00daMERO DE IDENTIFICACI\u00d3N';
    if (col === '__nombreUsuario__') return 'NOMBRE USUARIO';
    if (col === '__defensor__') return 'DEFENSOR';
    if (col === '__lugarPrivacion__') return 'Nombre del lugar de privaci\u00f3n de la libertad';
    if (col === '__estadoTramite__') return 'ESTADO';
    if (col === '__departamentoReclusion__') return 'DEPARTAMENTO';
    if (col === '__municipioReclusion__') return 'MUNICIPIO';
    return getHeaderLabel(col);
  }

  function renderCell(row, col) {
    if (col === '__situacionJuridica__') return displayOrDash(getSituacionJuridicaValue(row));
    if (col === '__numeroIdentificacion__') return displayOrDash(getNumeroIdentificacionValue(row));
    if (col === '__nombreUsuario__') return displayOrDash(getNombreUsuarioValue(row));
    if (col === '__defensor__') return displayOrDash(getDefensorValue(row));
    if (col === '__lugarPrivacion__') return displayOrDash(getLugarPrivacionValue(row));
    if (col === '__estadoTramite__') {
      const estadoInfo = getEstadoDisplayInfoMemo(row);
      const estado = String(estadoInfo.label || '').trim();
      if (!estado) return '\u2014';
      const estadoClass = String(estadoInfo.className || '').trim();
      if (!estadoClass) return estado;
      return <span className={`estadoBadge ${estadoClass}`}>{estado}</span>;
    }
    if (col === '__departamentoReclusion__') return displayOrDash(getDepartamentoPrivacionValue(row));
    if (col === '__municipioReclusion__') return displayOrDash(getMunicipioPrivacionValue(row));
    return displayOrDash(getCellValue(row, col));
  }

  function getCellTitle(row, col) {
    if (col === '__situacionJuridica__') return String(displayOrDash(getSituacionJuridicaValue(row)));
    if (col === '__numeroIdentificacion__') return String(displayOrDash(getNumeroIdentificacionValue(row)));
    if (col === '__nombreUsuario__') return String(displayOrDash(getNombreUsuarioValue(row)));
    if (col === '__defensor__') return String(displayOrDash(getDefensorValue(row)));
    if (col === '__lugarPrivacion__') return String(displayOrDash(getLugarPrivacionValue(row)));
    if (col === '__estadoTramite__') return String(displayOrDash(getEstadoDisplayInfoMemo(row).label));
    if (col === '__departamentoReclusion__') return String(displayOrDash(getDepartamentoPrivacionValue(row)));
    if (col === '__municipioReclusion__') return String(displayOrDash(getMunicipioPrivacionValue(row)));
    return String(displayOrDash(getCellValue(row, col)));
  }

  function handleRowClick(r) {
    const doc = String(getNumeroIdentificacionValue(r) || '').trim();
    if (!doc) return;
    if (typeof onSelectRegistro === 'function') {
      onSelectRegistro({ numeroIdentificacion: String(doc) });
    }
  }

  return (
    <div className="card">
      <h2>Usuarios asignados</h2>

      <div className="search-row" style={{ marginBottom: '0.75rem' }}>
        <button
          className="primary-button primary-button--search"
          type="button"
          onClick={() => setMostrarFiltros((v) => !v)}
          aria-expanded={mostrarFiltros}
        >
          {mostrarFiltros ? 'Ocultar filtros' : 'Mostrar filtros'}
        </button>
      </div>

      {cargando && <p>Cargando.</p>}
      {!cargando && errorCarga && <p className="hint-text">{errorCarga}</p>}
      {!cargando && metaConsulta?.filtered && (
        <p className="hint-text">
          {metaConsulta?.truncated
            ? `Se encontraron ${metaConsulta?.totalMatched || 0} registros y se muestran los primeros ${metaConsulta?.returned || 0}.`
            : `Se encontraron ${metaConsulta?.totalMatched || 0} registros.`}
        </p>
      )}

      {!cargando && (
        <div className="asignados-layout">
          {mostrarFiltros && (
            <div className="filter-panel">
              <h3 className="filter-title">{'B\u00fasqueda'}</h3>

              <DropdownField
                label="Defensor"
                value={filtrosDraft.defensor}
                onChange={(value) => setFiltroDraft('defensor', value)}
                options={defensoresOrdenados}
                searchable={defensoresOrdenados.length > 20}
                listId="filtro-defensor"
              />

              <InputField
                label={'N\u00famero de identificaci\u00f3n'}
                value={filtrosDraft.documento}
                onChange={(value) => setFiltroDraft('documento', String(value || '').replace(/\D+/g, ''))}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={'Ingrese c\u00e9dula'}
              />

              <DropdownField
                label="Filtrar"
                value={filtroAdicionalSeleccionado}
                onChange={seleccionarFiltroAdicional}
                options={[
                  { value: 'nombre', label: 'Nombre' },
                  { value: 'lugar', label: 'Nombre del lugar de privaci\u00f3n de la libertad' },
                  { value: 'departamento', label: 'Departamento del lugar de privaci\u00f3n de la libertad' },
                  { value: 'municipio', label: 'Distrito/municipio del lugar de privaci\u00f3n de la libertad' },
                  { value: 'estado', label: 'Estado del tr\u00e1mite' },
                ]}
              />

              {filtroAdicionalSeleccionado === 'nombre' && (
                <InputField
                  label="Nombre"
                  value={filtrosDraft.nombre}
                  onChange={(value) => setFiltroDraft('nombre', value)}
                  placeholder="Ingrese nombre"
                />
              )}

              {filtroAdicionalSeleccionado === 'lugar' && (
                <InputField
                  label={'Nombre del lugar de privaci\u00f3n de la libertad'}
                  value={filtrosDraft.lugar}
                  onChange={(value) => setFiltroDraft('lugar', value)}
                  options={lugaresDisponibles}
                  listId="filtro-lugar"
                  placeholder="Ingrese lugar"
                />
              )}

              {filtroAdicionalSeleccionado === 'departamento' && (
                <InputField
                  label={'Departamento del lugar de privaci\u00f3n de la libertad'}
                  value={filtrosDraft.departamento}
                  onChange={(value) =>
                    setFiltrosDraft((prev) => ({
                      ...prev,
                      departamento: value,
                      municipio: '',
                    }))
                  }
                  options={departamentosDisponibles}
                  listId="filtro-departamento"
                  placeholder="Ingrese departamento"
                />
              )}

              {filtroAdicionalSeleccionado === 'municipio' && (
                <InputField
                  label={'Distrito/municipio del lugar de privaci\u00f3n de la libertad'}
                  value={filtrosDraft.municipio}
                  onChange={(value) => setFiltroDraft('municipio', value)}
                  options={municipiosDisponiblesDraft}
                  listId="filtro-municipio"
                  placeholder="Ingrese distrito/municipio"
                />
              )}

              {filtroAdicionalSeleccionado === 'estado' && (
                <DropdownField
                  label={'Estado del tr\u00e1mite'}
                  value={filtrosDraft.estado}
                  onChange={(value) => setFiltroDraft('estado', value)}
                  options={estadosDisponibles}
                />
              )}

              <div className="search-row" style={{ marginTop: '0.75rem' }}>
                <button className="primary-button primary-button--search" type="button" onClick={aplicarFiltros}>
                  Buscar
                </button>
                <button className="primary-button" type="button" onClick={reiniciar}>
                  Limpiar
                </button>
              </div>
            </div>
          )}

          <div className="asignados-table-shell">
            <div className="table-container tall asignados-table-container">
              <table className="data-table aurora-table asignados-table">
                <colgroup>
                  {orderedColumns.map((c) => (
                    <col key={`col-${c}`} style={{ width: `${getColumnWidth(c)}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {orderedColumns.map((c) => (
                      <th key={c} title={renderHeader(c)}>
                        <span className="aurora-th-label">{renderHeader(c)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rowsPaginaActual.map((r, idx) => {
                    const rawKey =
                      (documentoKey && pickActiveCaseData(r)?.[documentoKey]) ||
                      getNumeroIdentificacionValue(r) ||
                      r?.id ||
                      `${paginaActual}-${idx}`;
                    const key = `${String(rawKey)}-${paginaActual}-${idx}`;

                    return (
                      <tr
                        key={String(key)}
                        onClick={() => handleRowClick(r)}
                        className="clickable-row"
                      >
                        {orderedColumns.map((c) => (
                          <td key={c} title={getCellTitle(r, c)}>
                            {renderCell(r, c)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {rowsFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(orderedColumns.length, 1)} style={{ textAlign: 'center', padding: '1rem' }}>
                        No hay registros para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {rowsFiltradas.length > 0 && (
              <div className="search-row" style={{ marginTop: '0.75rem', justifyContent: 'space-between' }}>
                <p className="hint-text" style={{ margin: 0 }}>
                  Mostrando {rowsPaginaActual.length} de {rowsFiltradas.length} registros. Pagina {paginaActual} de {totalPaginas}.
                </p>
                <div className="search-row" style={{ gap: '0.5rem' }}>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={paginaActual <= 1}
                  >
                    Anterior
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual >= totalPaginas}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}

            <p className="hint-text">
              Haga clic sobre una fila para abrir el formulario de entrevista del usuario seleccionado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
