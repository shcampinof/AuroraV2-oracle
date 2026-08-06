import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getCachedCondenados,
  getCachedCondenadosFilterOptions,
  getCondenados,
  getCondenadosFilterOptions,
} from '../services/api.js';
import { pickActiveCaseData } from '../utils/entrevistaEstado.js';
import { displayOrDash } from '../utils/pplDisplay.js';
import {
  ESTADOS_TRAMITE_OPTIONS,
  buildAssignedUsersFilters,
  normalizeFilterOptions,
  resolveCentroByLabel,
  resolveDefensorIdByLabel,
} from '../utils/asignadosCatalogs.js';
import {
  SITUACION_JURIDICA_INACTIVA,
  isSituacionActiva,
} from '../utils/pplStatus.js';
import {
  getEstadoClassByLabel,
  getEstadoClassForRecord,
  getEstadoDisplayInfo,
} from '../config/estadoActuaciones.rules.ts';
import LoadingOverlay from '../components/LoadingOverlay.jsx';

function prettifyHeader(key) {
  if (!key) return '';
  const spaced = String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const EXTRA_COLUMNS = ['actuacionJudicial'];
const ROWS_PER_PAGE = 25;
const DEFAULT_INITIAL_LIMIT = 50;
const DEFAULT_FILTERED_LIMIT = 100;
const INITIAL_FILTER_OPTIONS_QUERY = { tipo: 'all' };
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
  posibleActuacionJudicial: 'Actuaci\u00f3n judicial a adelantar',
  actuacionJudicial: 'Actuaci\u00f3n judicial a adelantar',
};

function getHeaderLabel(key) {
  if (!key) return '';
  if (HEADER_LABELS[key]) return HEADER_LABELS[key];
  return prettifyHeader(key);
}

function getTableHeaderLabel(key) {
  return getHeaderLabel(key).toLocaleUpperCase('es-CO');
}

function getCellValue(row, key) {
  if (key === 'posibleActuacionJudicial' || key === 'actuacionJudicial') {
    return getActuacionJudicialDisplay(row) || '-';
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

function firstFilledValue(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text && text !== '-' && text !== '—') return text;
  }
  return '';
}

function readFirstField(source, aliases) {
  const obj = source && typeof source === 'object' ? source : {};
  const aliasList = Array.isArray(aliases) ? aliases : [];

  for (const alias of aliasList) {
    const value = String(obj?.[alias] ?? '').trim();
    if (value) return value;
  }

  const normalizedAliases = new Set(aliasList.map((alias) => normalize(alias)).filter(Boolean));
  if (!normalizedAliases.size) return '';

  for (const [key, rawValue] of Object.entries(obj)) {
    if (!normalizedAliases.has(normalize(key))) continue;
    const value = String(rawValue ?? '').trim();
    if (value) return value;
  }

  return '';
}

function getActuacionJudicialDisplay(row) {
  const data = pickActiveCaseData(row);
  const estadoSource = row?.estadoSource && typeof row.estadoSource === 'object' ? row.estadoSource : {};
  const merged = { ...estadoSource, ...(data && typeof data === 'object' ? data : {}) };

  const auroraQ40 = firstFilledValue(readFirstField(merged, ['Actuación a adelantar', 'Actuacion a adelantar']));
  const celesteQ21 = firstFilledValue(
    readFirstField(merged, [
      'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
      'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TERMINOS',
      'Procedencia de la solicitud de vencimiento de términos',
      'Procedencia de la solicitud de vencimiento de terminos',
      'Análisis jurídico y actuación a desplegar',
      'Analisis juridico y actuacion a desplegar',
    ])
  );

  const situacionKey = normalize(
    firstFilledValue(
      data?.['Situación jurídica actualizada (de conformidad con la rama judicial)'],
      data?.['Situacion juridica actualizada (de conformidad con la rama judicial)'],
      data?.['Situación jurídica'],
      data?.['Situacion juridica'],
      data?.situacionJuridicaActualizada,
      data?.situacionJuridica,
      row?.situacionJuridica
    )
  );
  if (situacionKey.includes('condenad')) {
    return firstFilledValue(auroraQ40, celesteQ21, merged?.posibleActuacionJudicial);
  }
  if (situacionKey.includes('sindicad')) {
    return firstFilledValue(celesteQ21, auroraQ40, merged?.posibleActuacionJudicial);
  }
  return firstFilledValue(auroraQ40, celesteQ21, merged?.posibleActuacionJudicial);
}

function distinctSorted(rows, getter) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const val = String(getter(row) || '').trim();
    if (!val) return;
    const key = normalize(val);
    if (!map.has(key)) map.set(key, val);
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

function normalizeRowsPayload(data) {
  if (!data) return null;
  const cols = Array.isArray(data?.columns) ? data.columns : [];
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const inferred = cols.length
    ? cols
    : Array.from(
        rows.reduce((acc, row) => {
          Object.keys(row || {}).forEach((key) => acc.add(key));
          return acc;
        }, new Set())
      );
  const columns = [...inferred];
  for (const extra of EXTRA_COLUMNS) {
    if (!columns.includes(extra)) columns.push(extra);
  }
  return { columns, rows, meta: data?.meta || null };
}

function DropdownField({ label, value, onChange, options, searchable = false, listId }) {
  const normalizedOptions = useMemo(
    () =>
      (Array.isArray(options) ? options : []).map((opt) => {
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
      }),
    [options]
  );
  const selectedLabel = normalizedOptions.find((opt) => opt.value === String(value ?? ''))?.label ?? '';

  return (
    <div className="form-field">
      <label>{label}</label>
      {searchable ? (
        <>
          <input
            list={listId}
            className="input-text"
            placeholder="Escriba para filtrar"
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
  const normalizedOptions = (Array.isArray(options) ? options : [])
    .map((opt) => {
      if (opt && typeof opt === 'object') {
        return {
          value: String(opt.label ?? opt.value ?? '').trim(),
          label: String(opt.homologado === false ? `${opt.label} (no homologado)` : opt.label ?? opt.value ?? '').trim(),
          key: String(opt.id ?? opt.value ?? opt.label ?? '').trim(),
        };
      }
      const value = String(opt ?? '').trim();
      return { value, label: value, key: value };
    })
    .filter((opt) => opt.value);
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
            <option key={opt.key} value={opt.value}>{opt.label}</option>
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
    __accionPendiente__: 165,
    __fuenteInformacion__: 120,
    __fechaCorte__: 115,
    __departamentoReclusion__: 140,
    __municipioReclusion__: 130,
  };
  return widths[col] || 145;
}

export default function RegistrosAsignados({ onSelectRegistro }) {
  const [initialOptions] = useState(() =>
    normalizeFilterOptions(getCachedCondenadosFilterOptions(INITIAL_FILTER_OPTIONS_QUERY))
  );
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);

  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);

  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  const [filtrosDraft, setFiltrosDraft] = useState({
    defensor: '',
    defensorId: '',
    nombre: '',
    documento: '',
    lugar: '',
    centroId: '',
    departamento: '',
    municipio: '',
    estadoCodigo: '',
    accionCodigo: '',
  });
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    defensor: '',
    defensorId: '',
    nombre: '',
    documento: '',
    lugar: '',
    centroId: '',
    departamento: '',
    municipio: '',
    estadoCodigo: '',
    accionCodigo: '',
  });
  const [metaConsulta, setMetaConsulta] = useState(null);
  const [filtroAdicionalSeleccionado, setFiltroAdicionalSeleccionado] = useState('');
  const [pagina, setPagina] = useState(1);

  const [defensores, setDefensores] = useState(() => initialOptions.defensores);
  const [opcionesFiltro, setOpcionesFiltro] = useState(() => initialOptions);
  const isDev = typeof import.meta !== 'undefined' && import.meta?.env?.DEV;
  const estadoInfoCacheRef = useRef(new WeakMap());
  const tableScrollRef = useRef(null);
  const stickyScrollRef = useRef(null);
  const syncingHorizontalScrollRef = useRef(false);
  const [stickyScrollWidth, setStickyScrollWidth] = useState(0);
  const [showStickyScroll, setShowStickyScroll] = useState(false);

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
    if (!isSituacionActiva(data)) return SITUACION_JURIDICA_INACTIVA;
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
    const backendLabel = String(obj?.estadoEtiqueta || obj?.['Estado del caso'] || '').trim();
    const derived = getEstadoDisplayInfo(obj);
    const computed = {
      label: String(derived?.label || backendLabel).trim(),
      className: String(derived?.className || getEstadoClassByLabel(backendLabel)).trim(),
    };
    estadoInfoCacheRef.current.set(obj, computed);
    return computed;
  }

  function setFiltroDraft(key, value) {
    setFiltrosDraft((prev) => ({ ...prev, [key]: value }));
  }

  function setDefensorDraft(value) {
    const defensor = String(value || '');
    const defensorId = resolveDefensorIdByLabel(defensor, opcionesFiltro.defensorOptions);
    setFiltrosDraft((prev) => ({ ...prev, defensor, defensorId }));
  }

  function setCentroDraft(value) {
    const lugar = String(value || '');
    const centro = resolveCentroByLabel(lugar, opcionesFiltro.centros);
    setFiltrosDraft((prev) => ({ ...prev, lugar, centroId: centro?.id || '' }));
  }

  function seleccionarFiltroAdicional(value) {
    const selected = String(value || '').trim();
    setFiltroAdicionalSeleccionado(selected);
    setFiltrosDraft((prev) => ({
      ...prev,
      nombre: selected === 'nombre' ? prev.nombre : '',
      lugar: selected === 'lugar' ? prev.lugar : '',
      centroId: selected === 'lugar' ? prev.centroId : '',
      departamento: selected === 'departamento' ? prev.departamento : '',
      municipio: selected === 'municipio' ? prev.municipio : '',
    }));
    setFiltrosAplicados((prev) => ({
      ...prev,
      nombre: selected === 'nombre' ? prev.nombre : '',
      lugar: selected === 'lugar' ? prev.lugar : '',
      centroId: selected === 'lugar' ? prev.centroId : '',
      departamento: selected === 'departamento' ? prev.departamento : '',
      municipio: selected === 'municipio' ? prev.municipio : '',
    }));
  }

  const cargarRowsFromBackend = useCallback(async (nextFiltros = {}) => {
    const request = {
      tipo: 'all',
      limit: DEFAULT_INITIAL_LIMIT,
      filteredLimit: DEFAULT_FILTERED_LIMIT,
      filters: buildAssignedUsersFilters(nextFiltros),
    };
    const hasCachedRows = Boolean(getCachedCondenados(request));
    setCargando(!hasCachedRows);
    setErrorCarga('');
    try {
      const normalized = normalizeRowsPayload(await getCondenados(request));
      setColumns(normalized?.columns || []);
      setRows(normalized?.rows || []);
      setMetaConsulta(normalized?.meta || null);
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

  const cargarOpcionesFiltro = useCallback(async () => {
    try {
      const data = await getCondenadosFilterOptions(INITIAL_FILTER_OPTIONS_QUERY);
      const next = normalizeFilterOptions(data);
      setOpcionesFiltro(next);
      setDefensores((prev) => {
        const merged = new Map();
        [...(Array.isArray(prev) ? prev : []), ...next.defensores].forEach((value) => {
          const text = String(value || '').trim();
          if (!text) return;
          const key = normalize(text);
          if (!merged.has(key)) merged.set(key, text);
        });
        return Array.from(merged.values()).sort((a, b) => a.localeCompare(b));
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    cargarOpcionesFiltro();
  }, [cargarOpcionesFiltro]);

  useEffect(() => {
    estadoInfoCacheRef.current = new WeakMap();
  }, [rows]);

  useEffect(() => {
    setDefensores((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const set = new Set(base.map((d) => normalize(d)).filter(Boolean));
      const merged = [...base];

      rows.forEach((r) => {
        const val = String(getDefensorValue(r) || '').trim();
        if (!val) return;
        const key = normalize(val);
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

  const lugaresDisponibles = useMemo(() => {
    if (filtroAdicionalSeleccionado !== 'lugar') return [];
    return opcionesFiltro.centros.length ? opcionesFiltro.centros : distinctSorted(rows, getLugarPrivacionValue);
  }, [opcionesFiltro.centros, rows, filtroAdicionalSeleccionado]);
  const departamentosDisponibles = useMemo(() => {
    if (filtroAdicionalSeleccionado !== 'departamento' && filtroAdicionalSeleccionado !== 'municipio') return [];
    return opcionesFiltro.departamentos.length
      ? opcionesFiltro.departamentos
      : distinctSorted(rows, getDepartamentoPrivacionValue);
  }, [opcionesFiltro.departamentos, rows, filtroAdicionalSeleccionado]);

  const estadosDisponibles = useMemo(
    () => (opcionesFiltro.estados.length ? opcionesFiltro.estados : ESTADOS_TRAMITE_OPTIONS),
    [opcionesFiltro.estados]
  );
  const accionesDisponibles = useMemo(() => opcionesFiltro.acciones || [], [opcionesFiltro.acciones]);
  const centroSeleccionado = useMemo(
    () => resolveCentroByLabel(filtrosDraft.lugar, opcionesFiltro.centros),
    [filtrosDraft.lugar, opcionesFiltro.centros]
  );

  const municipiosDisponiblesDraft = useMemo(() => {
    if (filtroAdicionalSeleccionado !== 'municipio') return [];
    const depNeedle = normalize(filtrosDraft.departamento);
    if (opcionesFiltro.municipios.length && !depNeedle) return opcionesFiltro.municipios;
    const candidates = depNeedle
      ? rows.filter((r) => normalize(getDepartamentoPrivacionValue(r)) === depNeedle)
      : rows;
    return distinctSorted(candidates, getMunicipioPrivacionValue);
  }, [opcionesFiltro.municipios, rows, filtrosDraft.departamento, filtroAdicionalSeleccionado]);

  const rowsFiltradas = useMemo(() => {
    const estadoCodigo = String(filtrosAplicados.estadoCodigo || '').trim();
    const accionCodigo = String(filtrosAplicados.accionCodigo || '').trim();
    if (!estadoCodigo && !accionCodigo) return rows;
    const estadoLabel = estadosDisponibles.find((item) => item.value === estadoCodigo)?.label || '';
    const accionSeleccionada = accionesDisponibles.find((item) => item.value === accionCodigo);
    return rows.filter((row) => {
      const rowCodigo = String(row?.estadoCodigo || '').trim();
      const matchesEstado = !estadoCodigo || (rowCodigo
        ? rowCodigo === estadoCodigo
        : estadoLabel && normalize(getEstadoDisplayInfoMemo(row).label) === normalize(estadoLabel));
      const rowAccionCodigo = String(row?.accionPendiente?.codigo || '').trim();
      const matchesAccion = !accionCodigo || (rowAccionCodigo
        ? rowAccionCodigo === accionCodigo
        : accionSeleccionada?.estadoCodigos?.includes(rowCodigo));
      return matchesEstado && matchesAccion;
    });
  }, [rows, filtrosAplicados.estadoCodigo, filtrosAplicados.accionCodigo, estadosDisponibles, accionesDisponibles]);

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

  const syncStickyMetrics = useCallback(() => {
    const container = tableScrollRef.current;
    const sticky = stickyScrollRef.current;
    if (!container || !sticky) return;

    const nextWidth = Math.max(0, Number(container.scrollWidth || 0));
    const hasOverflow = nextWidth > Number(container.clientWidth || 0) + 1;
    setStickyScrollWidth(nextWidth);
    setShowStickyScroll(hasOverflow);

    if (!syncingHorizontalScrollRef.current) {
      syncingHorizontalScrollRef.current = true;
      sticky.scrollLeft = container.scrollLeft;
      syncingHorizontalScrollRef.current = false;
    }
  }, [setShowStickyScroll, setStickyScrollWidth]);

  useEffect(() => {
    const container = tableScrollRef.current;
    if (!container) return undefined;

    let resizeObserver = null;
    const scheduleSync = () => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(syncStickyMetrics);
        return;
      }
      syncStickyMetrics();
    };

    scheduleSync();

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleSync();
      });
      resizeObserver.observe(container);
      const table = container.querySelector('table');
      if (table) resizeObserver.observe(table);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', scheduleSync);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', scheduleSync);
      }
    };
  }, [rowsFiltradas.length, columns.length, paginaActual, syncStickyMetrics]);

  function handleTableHorizontalScroll() {
    if (syncingHorizontalScrollRef.current) return;
    const container = tableScrollRef.current;
    const sticky = stickyScrollRef.current;
    if (!container || !sticky) return;
    syncingHorizontalScrollRef.current = true;
    sticky.scrollLeft = container.scrollLeft;
    syncingHorizontalScrollRef.current = false;
  }

  function handleStickyHorizontalScroll() {
    if (syncingHorizontalScrollRef.current) return;
    const container = tableScrollRef.current;
    const sticky = stickyScrollRef.current;
    if (!container || !sticky) return;
    syncingHorizontalScrollRef.current = true;
    container.scrollLeft = sticky.scrollLeft;
    syncingHorizontalScrollRef.current = false;
  }

  async function aplicarFiltros() {
    const defensor = String(filtrosDraft.defensor || '').trim();
    const lugar = String(filtrosDraft.lugar || '').trim();
    const centro = resolveCentroByLabel(lugar, opcionesFiltro.centros);
    const next = {
      defensor,
      defensorId: resolveDefensorIdByLabel(defensor, opcionesFiltro.defensorOptions),
      nombre: String(filtrosDraft.nombre || '').trim(),
      documento: String(filtrosDraft.documento || '').trim(),
      lugar,
      centroId: centro?.id || '',
      departamento: String(filtrosDraft.departamento || '').trim(),
      municipio: String(filtrosDraft.municipio || '').trim(),
      estadoCodigo: String(filtrosDraft.estadoCodigo || '').trim(),
      accionCodigo: String(filtrosDraft.accionCodigo || '').trim(),
    };

    setFiltrosDraft(next);
    if (!Object.values(next).some((value) => String(value || '').trim() !== '')) {
      setFiltrosAplicados(next);
      setBusquedaRealizada(false);
      setErrorCarga('Ingrese al menos un filtro antes de buscar.');
      setColumns([]);
      setRows([]);
      setMetaConsulta(null);
      setPagina(1);
      return;
    }

    setFiltrosAplicados(next);
    setBusquedaRealizada(true);
    await cargarRowsFromBackend(next);
  }

  function reiniciar() {
    const empty = {
      defensor: '',
      defensorId: '',
      nombre: '',
      documento: '',
      lugar: '',
      centroId: '',
      departamento: '',
      municipio: '',
      estadoCodigo: '',
      accionCodigo: '',
    };
    setFiltrosDraft(empty);
    setFiltrosAplicados(empty);
    setFiltroAdicionalSeleccionado('');
    setBusquedaRealizada(false);
    setErrorCarga('');
    setColumns([]);
    setRows([]);
    setMetaConsulta(null);
    setPagina(1);
  }

  const orderedColumns = useMemo(() => {
    const fixed = [
      '__situacionJuridica__',
      '__numeroIdentificacion__',
      '__nombreUsuario__',
      '__defensor__',
      '__lugarPrivacion__',
      '__accionPendiente__',
      '__fuenteInformacion__',
      '__fechaCorte__',
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
      'defensorAsignado',
      'Defensor',
      'DEFENSOR',
      'defensor',
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
      'situacionActiva',
      'estadoReclusion',
      'fuenteInformacion',
      'fechaCorte',
      'totalSituaciones',
      'tieneHistorialActivoInactivo',
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
      'Acci\u00f3n a impulsar',
      'Accion a impulsar',
      'Acci\u00f3n a realizar',
      'Accion a realizar',
      'accionImpulsar',
      'accionPendiente',
      'estadoCodigo',
      'estadoEtiqueta',
      'centroId',
      'centroHomologado',
      'centroReclusion',
      'lugarReclusionOriginal',
      'casos',
      'activeCaseId',
    ]);

    const rest = (columns || []).filter((c) => !remove.has(c));
    return [...fixed, ...rest];
  }, [columns]);

  function renderHeader(col) {
    if (col === '__situacionJuridica__') return 'SITUACIÓN JURÍDICA';
    if (col === '__numeroIdentificacion__') return 'NÚMERO DE IDENTIFICACIÓN';
    if (col === '__nombreUsuario__') return 'NOMBRE USUARIO';
    if (col === '__defensor__') return 'DEFENSOR';
    if (col === '__lugarPrivacion__') return 'NOMBRE DEL LUGAR DE PRIVACIÓN DE LA LIBERTAD';
    if (col === '__accionPendiente__') return 'ACCIÓN A IMPULSAR';
    if (col === '__fuenteInformacion__') return 'FUENTE DE INFORMACIÓN';
    if (col === '__fechaCorte__') return 'FECHA DE CORTE';
    if (col === '__departamentoReclusion__') return 'DEPARTAMENTO';
    if (col === '__municipioReclusion__') return 'MUNICIPIO';
    return getTableHeaderLabel(col);
  }

  function renderCell(row, col) {
    if (col === '__situacionJuridica__') return displayOrDash(getSituacionJuridicaValue(row));
    if (col === '__numeroIdentificacion__') return displayOrDash(getNumeroIdentificacionValue(row));
    if (col === '__nombreUsuario__') return displayOrDash(getNombreUsuarioValue(row));
    if (col === '__defensor__') return displayOrDash(getDefensorValue(row));
    if (col === '__lugarPrivacion__') {
      const lugar = displayOrDash(getLugarPrivacionValue(row));
      if (row?.centroReclusion?.homologado !== false) return lugar;
      return (
        <div>
          <span>{lugar}</span>
          <small
            title="El nombre de la fuente aún no tiene equivalencia en el catálogo institucional de centros."
            style={{ display: 'block', color: '#8a5a00', marginTop: '0.25rem' }}
          >
            Centro pendiente de homologación
          </small>
        </div>
      );
    }
    if (col === '__accionPendiente__') {
      const accion = row?.accionPendiente;
      const etiqueta = String(accion?.etiqueta || row?.accionImpulsar || '').trim();
      const original = String(accion?.valorOriginal || '').trim();
      if (!etiqueta) return '\u2014';
      const situacionActiva = isSituacionActiva(pickActiveCaseData(row));
      const estadoCanonico = String(row?.estadoEtiqueta || etiqueta).trim();
      const estadoClass = situacionActiva
        ? String(getEstadoClassForRecord(row, estadoCanonico)).trim()
        : 'estado--fuera-prision';
      return (
        <div>
          <span className={`estadoBadge${estadoClass ? ` ${estadoClass}` : ''}`}>{etiqueta}</span>
          {accion?.homologada === false && original && normalize(original) !== normalize(etiqueta) && (
            <small style={{ display: 'block', color: '#8a5a00', marginTop: '0.25rem' }}>
              Valor original no homologado: {original}
            </small>
          )}
        </div>
      );
    }
    if (col === '__fuenteInformacion__') {
      const fuente = displayOrDash(row?.fuenteInformacion);
      return (
        <div>
          <span>{fuente}</span>
          {row?.tieneHistorialActivoInactivo && (
            <small
              title="La persona tiene más de una situación carcelaria y el historial contiene registros ACTIVO=1 y ACTIVO=0. Se muestra la situación con la fecha efectiva más reciente."
              style={{ display: 'block', color: '#6b4f00', marginTop: '0.25rem' }}
            >
              Cambio de situación registrado
            </small>
          )}
        </div>
      );
    }
    if (col === '__fechaCorte__') return displayOrDash(row?.fechaCorte);
    if (col === '__departamentoReclusion__') return displayOrDash(getDepartamentoPrivacionValue(row));
    if (col === '__municipioReclusion__') return displayOrDash(getMunicipioPrivacionValue(row));
    return displayOrDash(getCellValue(row, col));
  }

  function handleRowClick(r) {
    if (cargando) return;
    const doc = String(getNumeroIdentificacionValue(r) || '').trim();
    if (!doc) return;
    if (typeof onSelectRegistro === 'function') {
      onSelectRegistro({ numeroIdentificacion: String(doc) });
    }
  }

  const mostrarOverlayCarga = cargando;
  const mensajeOverlayCarga = 'Cargando información...';

  return (
    <div className="card loading-layer-host">
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

      {!cargando && errorCarga && <p className="hint-text">{errorCarga}</p>}
      {!cargando && metaConsulta?.filtered && (
        <p className="hint-text">
          {metaConsulta?.truncated
            ? metaConsulta?.totalMatchedExact === false
              ? `Se muestran los primeros ${metaConsulta?.returned || 0} registros. Hay más resultados; ajuste los filtros para precisar la búsqueda.`
              : `Se encontraron ${metaConsulta?.totalMatched || 0} registros y se muestran los primeros ${metaConsulta?.returned || 0}.`
            : `Se encontraron ${metaConsulta?.returned || metaConsulta?.totalMatched || 0} registros.`}
        </p>
      )}

      {!cargando && (
        <div className="asignados-layout">
          {mostrarFiltros && (
            <div className="filter-panel">
              <h3 className="filter-title">Búsqueda</h3>

              <DropdownField
                label="Defensor"
                value={filtrosDraft.defensor}
                onChange={setDefensorDraft}
                options={defensoresOrdenados}
                searchable
                listId="filtro-defensor"
              />

              <InputField
                label="Número de identificación"
                value={filtrosDraft.documento}
                onChange={(value) => setFiltroDraft('documento', String(value || '').replace(/\D+/g, ''))}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Ingrese cédula"
              />

              <DropdownField
                label="Acción a Impulsar / estado"
                value={filtrosDraft.accionCodigo}
                onChange={(value) => setFiltroDraft('accionCodigo', value)}
                options={accionesDisponibles}
              />

              <DropdownField
                label="Filtrar"
                value={filtroAdicionalSeleccionado}
                onChange={seleccionarFiltroAdicional}
                options={[
                  { value: 'nombre', label: 'Nombre' },
                  { value: 'lugar', label: 'Nombre del lugar de privación de la libertad' },
                  { value: 'departamento', label: 'Departamento del lugar de privación de la libertad' },
                  { value: 'municipio', label: 'Distrito/municipio del lugar de privación de la libertad' },
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
                  label="Nombre del lugar de privación de la libertad"
                  value={filtrosDraft.lugar}
                  onChange={setCentroDraft}
                  options={lugaresDisponibles}
                  listId="filtro-lugar"
                  placeholder="Ingrese lugar"
                />
              )}
              {filtroAdicionalSeleccionado === 'lugar' && centroSeleccionado?.homologado === false && (
                <p className="hint-text" style={{ color: '#8a5a00' }}>
                  Este es un valor histórico no homologado. Se buscará usando su identidad normalizada sin ocultarlo.
                </p>
              )}
              {filtroAdicionalSeleccionado === 'lugar' &&
                Number(opcionesFiltro.meta?.homologacionCentros?.noHomologados || 0) > 0 && (
                  <p className="hint-text">
                    Valores de centros pendientes de homologación: {opcionesFiltro.meta.homologacionCentros.noHomologados}.
                  </p>
                )}

              {filtroAdicionalSeleccionado === 'departamento' && (
                <InputField
                  label="Departamento del lugar de privación de la libertad"
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
                  label="Distrito/municipio del lugar de privación de la libertad"
                  value={filtrosDraft.municipio}
                  onChange={(value) => setFiltroDraft('municipio', value)}
                  options={municipiosDisponiblesDraft}
                  listId="filtro-municipio"
                  placeholder="Ingrese distrito/municipio"
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
            <div
              ref={tableScrollRef}
              className="table-container tall asignados-table-container"
              onScroll={handleTableHorizontalScroll}
            >
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
                    const situacionActiva = isSituacionActiva(pickActiveCaseData(r));
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
                        className={`clickable-row${situacionActiva ? '' : ' row-fuera-prision'}`}
                        title={situacionActiva ? undefined : 'Fuera de prisión. Registro histórico disponible solo para consulta.'}
                      >
                        {orderedColumns.map((c) => (
                          <td key={c}>
                            {renderCell(r, c)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {rowsFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(orderedColumns.length, 1)} style={{ textAlign: 'center', padding: '1rem' }}>
                        {busquedaRealizada
                          ? 'No se encontraron registros con los filtros aplicados.'
                          : 'Ingrese al menos un filtro y presione Buscar.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div
              ref={stickyScrollRef}
              className={`asignados-scrollbar-sticky${showStickyScroll ? '' : ' is-hidden'}`}
              onScroll={handleStickyHorizontalScroll}
              aria-hidden={!showStickyScroll}
            >
              <div style={{ width: `${stickyScrollWidth}px` }} />
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

            {busquedaRealizada && rowsFiltradas.length > 0 && (
              <p className="hint-text">
                Haga clic sobre una fila para abrir el formulario de entrevista del usuario seleccionado.
              </p>
            )}
          </div>
        </div>
      )}
      <LoadingOverlay show={mostrarOverlayCarga} message={mensajeOverlayCarga} />
    </div>
  );
}
