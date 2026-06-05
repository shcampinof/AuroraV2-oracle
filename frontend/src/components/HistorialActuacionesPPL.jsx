import { useEffect, useMemo, useState } from 'react';
import { getPplActuacionesByDocumento } from '../services/api.js';
import { getEstadoDisplayInfo } from '../config/estadoActuaciones.rules.ts';
import { reportError } from '../utils/reportError.js';
import { getLabelAccionCaso } from '../utils/actuacionesLabels.js';
import './HistorialActuacionesPPL.css';

function decodeUnicodeEscapes(text) {
  return String(text ?? '')
    .replace(/\\\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

const CP1252_REVERSE_MAP = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

function cp1252CharsToBytes(input) {
  const text = String(input ?? '');
  const bytes = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }
    const mapped = CP1252_REVERSE_MAP.get(code);
    if (mapped != null) {
      bytes.push(mapped);
      continue;
    }
    return null;
  }
  return Uint8Array.from(bytes);
}

function maybeDecodeUtf8Mojibake(text) {
  let out = String(text ?? '');
  for (let pass = 0; pass < 3; pass += 1) {
    if (!/[\u00C3\u00C2\u00E2\u0192]/.test(out)) break;
    try {
      const bytes = cp1252CharsToBytes(out);
      if (!bytes) break;
      const decoded = new TextDecoder('utf-8').decode(bytes);
      if (!decoded || decoded === out) break;
      out = decoded;
    } catch {
      break;
    }
  }
  return out;
}

function displayText(value) {
  let out = decodeUnicodeEscapes(String(value ?? ''));
  out = maybeDecodeUtf8Mojibake(out);
  out = out
    .replace(/\best\?/gi, 'est\u00e1')
    .replace(/\bavanzar\?/gi, 'avanzar\u00e1')
    .replace(/\bdemostar\b/gi, 'demostrar')
    .replace(/\?ltima/gi, '\u00faltima');
  return out;
}

function normalizeText(value) {
  return maybeDecodeUtf8Mojibake(decodeUnicodeEscapes(String(value ?? '')))
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function firstFilledValue(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text && text !== '-' && text !== '\u2014') return text;
  }
  return '';
}

function readFirstField(source, aliases) {
  const obj = source && typeof source === 'object' ? source : {};
  const normalizedAliases = new Set((aliases || []).map((alias) => normalizeText(alias)));

  for (const [key, value] of Object.entries(obj)) {
    if (!normalizedAliases.has(normalizeText(key))) continue;
    const text = String(value ?? '').trim();
    if (text) return text;
  }

  return '';
}

function isEmptyHistorialValue(value) {
  const text = String(value ?? '').trim();
  return text === '' || text === '-' || text === '\u2014';
}

function normalizeBloqueField(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const CAMPOS_CLAVE_PARA_INICIAR_ACTUALIZAR = new Set([
  'fecha de analisis juridico del caso',
  'resumen del analisis del caso',
  'resumen del analisis juridico del presente caso',
  'actuacion a adelantar',
  'procedencia de la solicitud de vencimiento de terminos',
  'fecha de entrevista',
  'fecha de presentacion de solicitud a la autoridad',
  'sentido de la decision',
  'sentido de la decision que resuelve la solicitud',
  'sentido de la decision que resuelve recurso',
]);

const CAMPOS_BLOQUE_3_INICIO = new Set([
  'fecha de analisis juridico del caso',
  'resumen del analisis del caso',
  'resumen del analisis juridico del presente caso',
  'procedencia de la solicitud de vencimiento de terminos',
  'procedencia de libertad condicional',
  'procedencia de prision domiciliaria de mitad de pena',
  'procedencia de utilidad publica solo para mujeres',
  'procedencia de pena cumplida',
  'procedencia de acumulacion de penas',
  'con que proceso s debe acumular penas si aplica',
  'otras solicitudes a tramitar',
]);

const CAMPOS_BASE_NUEVA_ACTUACION = new Set([
  'nombre',
  'nombre usuario',
  'tipo de indentificacion',
  'tipo de identificacion',
  'numero de identificacion',
  'numero',
  'situacion juridica',
  'situacion',
  'situacion juridica actualizada de conformidad con la rama judicial',
  'situacion juridica actualizada',
  'genero',
  'enfoque etnico racial cultural',
  'enfoque',
  'nacionalidad',
  'fecha de nacimiento',
  'edad',
  'lugar de privacion de la libertad',
  'lugar de privacion',
  'nombre del lugar de privacion de la libertad',
  'establecimiento',
  'departamento del lugar de privacion de la libertad',
  'departamento',
  'distrito municipio del lugar de privacion de la libertad',
  'municipio',
  'la persona sigue en el cdt',
  'sigue cdt',
  'autoridad a cargo',
  'autoridad',
  'numero de proceso',
  'proceso',
  'delitos',
  'fecha de captura',
  'pena anos meses y dias',
  'pena',
  'pena total en dias',
  'pena dias',
  'tiempo que la persona lleva privada de la libertad en dias',
  'privacion',
  'redencion total acumulada en dias',
  'redencion',
  'tiempo efectivo de pena cumplida en dias teniendo en cuenta la redencion',
  'tiempo efectivo',
  'porcentaje de avance de pena cumplida',
  'porcentaje',
  'fase de tramiento',
  'fase',
  'cuenta con requerimientos judiciales por otros procesos',
  'requerimienotosi',
  'fecha ultima calificacion',
  'fecha calificacion',
  'calificacion de conducta',
  'calificacion',
  'pag',
  'defensor a publico a asignado para tramitar la solicitud',
  'defensor',
  'herramienta',
  '__rowindex',
]);

const CAMPOS_NO_INDICAN_INICIO = new Set([
  'estado del caso',
  'estado del tramite',
  'redirectedtoaurora',
  'tipo',
  'tipo ppl',
  'tipo registro',
]);

function isBaseFieldForNuevaActuacion(fieldName) {
  return CAMPOS_BASE_NUEVA_ACTUACION.has(normalizeBloqueField(fieldName));
}

function hasCamposClaveDiligenciados(registro) {
  const source = registro && typeof registro === 'object' ? registro : {};
  return Object.entries(source).some(([fieldName, fieldValue]) => {
    if (!CAMPOS_CLAVE_PARA_INICIAR_ACTUALIZAR.has(normalizeBloqueField(fieldName))) return false;
    return !isEmptyHistorialValue(fieldValue);
  });
}

function hasBloque3Diligenciado(registro) {
  const source = registro && typeof registro === 'object' ? registro : {};
  return Object.entries(source).some(([fieldName, fieldValue]) => {
    if (!CAMPOS_BLOQUE_3_INICIO.has(normalizeBloqueField(fieldName))) return false;
    return !isEmptyHistorialValue(fieldValue);
  });
}

function hasActividadNoBaseDiligenciada(registro) {
  const source = registro && typeof registro === 'object' ? registro : {};
  return Object.entries(source).some(([fieldName, fieldValue]) => {
    if (isEmptyHistorialValue(fieldValue)) return false;
    const normalizedField = normalizeBloqueField(fieldName);
    if (!normalizedField) return false;
    if (CAMPOS_NO_INDICAN_INICIO.has(normalizedField)) return false;
    return !isBaseFieldForNuevaActuacion(fieldName);
  });
}

function hasActuacionIniciada(registro) {
  return hasCamposClaveDiligenciados(registro) || hasActividadNoBaseDiligenciada(registro);
}

function resolveTipoPpl(registro) {
  const source = registro && typeof registro === 'object' ? registro : {};
  const situacion = firstFilledValue(
    readFirstField(source, [
      'Situaci\u00f3n Jur\u00eddica actualizada (de conformidad con la rama judicial)',
      'Situacion Juridica actualizada (de conformidad con la rama judicial)',
      'Situaci\u00f3n Jur\u00eddica',
      'Situacion Juridica',
    ])
  );

  const key = normalizeText(situacion);
  if (key.includes('condenad')) return 'condenado';
  if (key.includes('sindicad')) return 'sindicado';
  return '';
}

function getFechaAnalisisDisplay(registro) {
  return firstFilledValue(
    readFirstField(registro, [
      'Fecha de an\u00e1lisis jur\u00eddico del caso',
      'Fecha de analisis juridico del caso',
      'aurora_b3_fechaAnalisis',
    ])
  );
}

function getResumenAnalisisDisplay(registro, tipo) {
  const auroraQ37 = firstFilledValue(
    readFirstField(registro, ['Resumen del an\u00e1lisis del caso', 'Resumen del analisis del caso'])
  );
  const celesteQ22 = firstFilledValue(
    readFirstField(registro, [
      'RESUMEN DEL AN\u00c1LISIS JUR\u00cdDICO DEL PRESENTE CASO',
      'RESUMEN DEL ANALISIS JURIDICO DEL PRESENTE CASO',
      'Resumen del an\u00e1lisis jur\u00eddico del caso',
      'Resumen del analisis juridico del caso',
    ])
  );

  if (tipo === 'condenado') return auroraQ37 || celesteQ22;
  if (tipo === 'sindicado') return celesteQ22 || auroraQ37;
  return auroraQ37 || celesteQ22;
}

function getActuacionJudicialDisplay(registro, tipo) {
  const auroraQ40 = firstFilledValue(readFirstField(registro, ['Actuaci\u00f3n a adelantar', 'Actuacion a adelantar']));
  const celesteQ21 = firstFilledValue(
    readFirstField(registro, [
      'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE T\u00c9RMINOS',
      'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TERMINOS',
      'Procedencia de la solicitud de vencimiento de t\u00e9rminos',
      'Procedencia de la solicitud de vencimiento de terminos',
      'An\u00e1lisis jur\u00eddico y actuaci\u00f3n a desplegar',
      'Analisis juridico y actuacion a desplegar',
    ])
  );

  if (tipo === 'condenado') return auroraQ40 || celesteQ21;
  if (tipo === 'sindicado') return celesteQ21 || auroraQ40;
  return auroraQ40 || celesteQ21;
}

export default function HistorialActuacionesPPL({
  registro,
  numeroDocumento,
  onSelectActuacion,
  onCrearNuevaActuacion,
  onIniciarActuacion,
  refreshToken,
  actuacionActivaId,
  creandoActuacion = false,
  onActionLabelChange,
}) {
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [historialError, setHistorialError] = useState('');
  const [actuacionesRaw, setActuacionesRaw] = useState([]);

  const documentoNormalizado = useMemo(() => String(numeroDocumento ?? '').trim(), [numeroDocumento]);

  useEffect(() => {
    let alive = true;

    async function cargarHistorial() {
      if (!documentoNormalizado) {
        setActuacionesRaw([]);
        setHistorialError('');
        return;
      }

      setCargandoHistorial(true);
      setHistorialError('');
      try {
        const response = await getPplActuacionesByDocumento(documentoNormalizado);
        if (!alive) return;

        const rows = Array.isArray(response?.actuaciones) ? response.actuaciones : [];
        setActuacionesRaw(rows);
      } catch (e) {
        reportError(e, 'historial-actuaciones:cargar');
        if (!alive) return;
        setActuacionesRaw([]);
        setHistorialError('No fue posible cargar el historial de actuaciones.');
      } finally {
        if (alive) setCargandoHistorial(false);
      }
    }

    cargarHistorial();

    return () => {
      alive = false;
    };
  }, [documentoNormalizado, refreshToken]);

  const actuaciones = useMemo(() => {
    const activeId = String(actuacionActivaId || '').trim();
    const registroActual = registro && typeof registro === 'object' ? registro : null;
    const activeGestionId = Number(registroActual?.__oracleIdGestion || 0);
    let activeRowFound = false;

    const normalizeActuacion = (item, idx, liveRegistro = null) => {
      const baseRegistro = item?.registro && typeof item.registro === 'object' ? item.registro : {};
      const rowData = liveRegistro && typeof liveRegistro === 'object' ? { ...baseRegistro, ...liveRegistro } : baseRegistro;
      const itemId = String(item?.id ?? `actuacion-${idx + 1}`);
      const rowIndexNumber = Number(item?.rowIndex);
      const tipo = resolveTipoPpl(rowData);
      const estadoInfo = getEstadoDisplayInfo(rowData);

      return {
        id: itemId,
        rowIndex: Number.isFinite(rowIndexNumber) ? rowIndexNumber : idx,
        registro: rowData,
        iniciada: hasActuacionIniciada(rowData),
        bloque3Iniciado: hasBloque3Diligenciado(rowData),
        fechaAnalisisJuridico: getFechaAnalisisDisplay(rowData),
        resumenAnalisis: getResumenAnalisisDisplay(rowData, tipo),
        actuacionJudicial: getActuacionJudicialDisplay(rowData, tipo),
        estadoLabel: String(estadoInfo?.label || '').trim(),
        estadoClass: String(estadoInfo?.className || '').trim(),
      };
    };

    const rows = actuacionesRaw.map((item, idx) => {
      const itemId = String(item?.id ?? `actuacion-${idx + 1}`);
      const itemRowIndex = Number(item?.rowIndex);
      const itemGestionId = Number(item?.registro?.__oracleIdGestion || 0);
      const matchesActiveId = activeId && itemId === activeId;
      const matchesActiveGestion =
        activeGestionId > 0 && (Number(itemRowIndex) === activeGestionId || Number(itemGestionId) === activeGestionId);
      const shouldUseLiveRegistro = Boolean(registroActual && (matchesActiveId || matchesActiveGestion));
      if (shouldUseLiveRegistro) activeRowFound = true;
      return normalizeActuacion(item, idx, shouldUseLiveRegistro ? registroActual : null);
    });

    if (activeId && registroActual && !activeRowFound) {
      rows.push(
        normalizeActuacion(
          {
            id: activeId,
            rowIndex: activeGestionId > 0 ? activeGestionId : rows.length,
            registro: registroActual,
          },
          rows.length,
          registroActual
        )
      );
    }

    return rows;
  }, [actuacionesRaw, actuacionActivaId, registro]);

  const nombreCompleto = useMemo(() => {
    return readFirstField(registro, ['Nombre', 'Nombre usuario', 'nombreUsuario', 'nombre']) || '\u2014';
  }, [registro]);

  const tipoDocumento = useMemo(() => {
    return (
      readFirstField(registro, [
        'Tipo de indentificaci\u00f3n',
        'Tipo de identificaci\u00f3n',
        'Tipo identificaci\u00f3n',
        'tipoIdentificacion',
      ]) || '\u2014'
    );
  }, [registro]);

  const numeroDocumentoLabel = useMemo(() => {
    const fromRegistro = readFirstField(registro, [
      'N\u00famero de identificaci\u00f3n',
      'Numero de identificacion',
      'numeroIdentificacion',
      'title',
      'Title',
      'documento',
      'cedula',
    ]);
    return firstFilledValue(fromRegistro, documentoNormalizado) || '\u2014';
  }, [registro, documentoNormalizado]);

  const actuacionesIniciadas = useMemo(() => actuaciones.filter((actuacion) => Boolean(actuacion?.iniciada)), [actuaciones]);
  const actuacionesPendientes = useMemo(() => actuaciones.filter((actuacion) => !actuacion?.iniciada), [actuaciones]);

  const sinActuaciones = useMemo(
    () => !cargandoHistorial && !historialError && actuacionesIniciadas.length === 0,
    [cargandoHistorial, historialError, actuacionesIniciadas.length]
  );

  const textoAccionCaso = useMemo(() => {
    const activeId = String(actuacionActivaId || '').trim();
    if (activeId) {
      const activa = actuaciones.find((a) => String(a?.id || '').trim() === activeId);
      if (activa) return getLabelAccionCaso(!activa.bloque3Iniciado);
    }
    if (sinActuaciones) return getLabelAccionCaso(true);
    return getLabelAccionCaso(actuacionesPendientes.some((a) => !a?.bloque3Iniciado));
  }, [actuacionActivaId, actuaciones, actuacionesPendientes, sinActuaciones]);

  useEffect(() => {
    onActionLabelChange?.(textoAccionCaso);
  }, [onActionLabelChange, textoAccionCaso]);

  function seleccionarActuacionPendienteMasReciente() {
    const pendiente = actuacionesPendientes.length ? actuacionesPendientes[actuacionesPendientes.length - 1] : null;
    if (!pendiente) return false;
    onSelectActuacion?.(pendiente);
    return true;
  }

  function handleIniciarDesdeFilaVacia() {
    if (seleccionarActuacionPendienteMasReciente()) return;
    if (onIniciarActuacion) {
      onIniciarActuacion();
      return;
    }
    onCrearNuevaActuacion?.({ abrirFormulario: true });
  }

  function handleCrearNuevaActuacionClick() {
    onCrearNuevaActuacion?.({ abrirFormulario: true });
  }

  return (
    <section className="historial-actuaciones">
      <div className="ppl-summary-card">
        <p className="ppl-summary-line">
          <strong>{displayText('Nombre:')}</strong> {displayText(nombreCompleto)}
        </p>
        <p className="ppl-summary-line">
          <strong>{displayText('Documento:')}</strong> {displayText(tipoDocumento)} {displayText(numeroDocumentoLabel)}
        </p>
      </div>

      <div className="historial-actuaciones-header">
        <h3 className="block-title historial-actuaciones-title">{displayText('Historial de actuaciones')}</h3>
      </div>

      {cargandoHistorial && <p className="hint-text">{displayText('Cargando historial de actuaciones...')}</p>}
      {!cargandoHistorial && historialError && <p className="hint-text">{displayText(historialError)}</p>}

      {!cargandoHistorial && !historialError && sinActuaciones && (
        <p className="hint-text">{displayText('Sin actuaciones por el momento')}</p>
      )}

      {!cargandoHistorial && !historialError && (
        <div className="table-container historial-actuaciones-table-container tabla-historial-actuaciones-wrap">
          <table className="data-table historial-actuaciones-table tabla-historial-actuaciones">
            <colgroup>
              <col className="historial-col-numero" />
              <col className="historial-col-fecha" />
              <col className="historial-col-resumen" />
              <col className="historial-col-actuacion" />
              <col className="historial-col-accion" />
              <col className="historial-col-botones" />
            </colgroup>
            <thead>
              <tr>
                <th className="historial-head-numero">{displayText('N\u00famero de actuaci\u00f3n')}</th>
                <th>{displayText('Fecha de an\u00e1lisis jur\u00eddico del caso')}</th>
                <th>{displayText('Resumen del an\u00e1lisis del caso')}</th>
                <th>{displayText('Actuaci\u00f3n judicial a adelantar')}</th>
                <th>{displayText('Acci\u00f3n a impulsar')}</th>
                <th>{displayText('Acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {!sinActuaciones &&
                actuacionesIniciadas.map((actuacion, index) => {
                  const isActive =
                    String(actuacionActivaId || '').trim() &&
                    String(actuacion?.id || '').trim() === String(actuacionActivaId || '').trim();
                  const textoAccionFila = getLabelAccionCaso(!actuacion?.bloque3Iniciado);

                  return (
                    <tr key={String(actuacion?.id || '')} className={isActive ? 'historial-row-active' : ''}>
                      <td className="historial-col-numero-cell">{index + 1}</td>
                      <td>{displayText(firstFilledValue(actuacion?.fechaAnalisisJuridico) || '\u2014')}</td>
                      <td>{displayText(firstFilledValue(actuacion?.resumenAnalisis) || '\u2014')}</td>
                      <td>{displayText(firstFilledValue(actuacion?.actuacionJudicial) || '\u2014')}</td>
                      <td>
                        {actuacion?.estadoLabel ? (
                          actuacion?.estadoClass ? (
                            <span className={`estadoBadge ${actuacion.estadoClass}`}>{displayText(actuacion.estadoLabel)}</span>
                          ) : (
                            displayText(actuacion.estadoLabel)
                          )
                        ) : (
                          '\u2014'
                        )}
                      </td>
                      <td className="historial-col-acciones-cell">
                        <button
                          type="button"
                          className="primary-button historial-action-button"
                          onClick={() => onSelectActuacion?.(actuacion)}
                        >
                          {displayText(textoAccionFila)}
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {sinActuaciones && (
                <tr className="historial-empty-row">
                  <td className="historial-col-numero-cell">-</td>
                  <td colSpan={4} className="historial-empty-message">
                    {displayText('Sin actuaciones por el momento')}
                  </td>
                  <td className="historial-col-acciones-cell">
                    <button
                      type="button"
                      className="primary-button historial-action-button"
                      onClick={handleIniciarDesdeFilaVacia}
                    >
                      {displayText(textoAccionCaso)}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="historial-create-button-wrap">
        <button
          className="save-button historial-create-button"
          type="button"
          onClick={handleCrearNuevaActuacionClick}
          disabled={creandoActuacion || !documentoNormalizado}
        >
          {creandoActuacion ? displayText('Creando...') : displayText('Crear nueva actuaci\u00f3n')}
        </button>
      </div>
    </section>
  );
}
