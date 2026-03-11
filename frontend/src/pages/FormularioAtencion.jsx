import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createPplActuacion,
  getDefensoresCatalogo,
  getPplActuacionesByDocumento,
  getPplByDocumento,
  updatePpl,
} from '../services/api.js';
import Toast from '../components/Toast.jsx';
import HistorialActuacionesPPL from '../components/HistorialActuacionesPPL.jsx';
import { evaluateAuroraRules } from '../utils/evaluateAuroraRules.ts';
import { evaluateCelesteRules } from '../utils/evaluateCelesteRules.ts';
import { AURORA_FIELD_IDS } from '../config/auroraFieldIds.ts';
import { reportError } from '../utils/reportError.js';
import { getLabelAccionCaso } from '../utils/actuacionesLabels.js';

const OPCIONES_TIPO_IDENTIFICACION = ['CC', 'CE', 'PASAPORTE', 'OTRA'];
const OPCIONES_SI_NO = ['SÃ­', 'No'];
const OPCIONES_PODER = ['SÃ­ se requiere', 'Ya se cuenta con poder'];
const KEY_Q35_LEGACY = 'Con qu? proceso(s) debe acumular penas (si aplica)';
const KEY_Q35_UTF8 = 'Con quÃ© proceso(s) debe acumular penas (si aplica)';
const KEY_FECHA_ULTIMA_CALIFICACION = 'Fecha ?ltima calificaciÃ³n';
const KEY_ACTA_CALIFICACION = 'No.Acta de calificaciÃ³n de conducta';
const KEY_EVALUACION_DESDE = 'EvaluaciÃ³n de conducta desde';
const KEY_EVALUACION_HASTA = 'EvaluaciÃ³n de conducta hasta';
const KEY_CALIFICACION_CONDUCTA = 'CalificaciÃ³n de conducta';

// AURORA (PPL CONDENADOS)
const OPCIONES_SITUACION_JURIDICA = ['Condenado', 'Sindicado'];
const OPCIONES_GENERO_AURORA = [
  'Masculino',
  'Femenino',
  'Queer',
  'Mujer trans',
  'Hombre trans',
  'Persona no binaria',
  'Prefiere no responder',
  'Otra identidad',
];
const OPCIONES_ENFOQUE_ETNICO = [
  'Negro',
  'Afrocolombiano (a) / Afrodescendiente',
  'Raizal',
  'Palenquero',
  'Gitano (a) o Rrom',
  'IndÃ­gena',
];
const OPCIONES_LUGAR_PRIVACION = ['CDT', 'ERON'];
const OPCIONES_FASE_TRATAMIENTO = [
  'ObservaciÃ³n',
  'Alta',
  'Mediana',
  'MÃ­nima',
  'Confianza',
  'No reporta',
];
const OPCIONES_CALIFICACION_CONDUCTA = [
  'Ejemplar',
  'Excelente',
  'Buena',
  'Regular',
  'Mala',
  'Pendiente',
  'Sin registro',
];

const OPCIONES_PROCEDENCIA_LIBERTAD_CONDICIONAL = [
  'SÃ­ procede solicitud de libertad condicional',
  'No aplica porque ya hay solicitud de libertad o subrogado penal en trÃ¡mite',
  'No aplica porque ya est? en libertad por pena cumplida',
  'No aplica porque ya se concediÃ³ libertad condicional',
  'No aplica porque ya se concediÃ³ prisiÃ³n domiciliaria',
  'No aplica porque ya se concediÃ³ utilidad pÃºblica',
  'No aplica porque el proceso no ha sido asignado a JEPMS',
  'No aplica porque el proceso est? en otro circuito judicial (falta trasladar el proceso al actual)',
  'No aplica porque la condena est? por delito excluido del subrogado',
  'No aplica porque recientemente se le revocÃ³ subrogado penal',
  'No aplica porque recientemente se le negÃ³ subrogado penal',
  'No aplica porque la evaluaciÃ³n de conducta es negativa',
  'No aplica porque se determinÃ³ que no ha cumplido requisito temporal para acceder',
  'No aplica porque tiene acumulaciÃ³n de penas',
  'No aplica porque la persona fue trasladada a otro ERON',
  'No aplica porque la persona est? sindicada',
  'No aplica porque la cartilla biogrÃ¡fica no est? actualizada',
  'RevisiÃ³n suspendida porque se requiere primero trÃ¡mite de acumulaciÃ³n de penas',
  'No aplica porque el usuario no puede demostrar arraigo',
];

const OPCIONES_PROCEDENCIA_PRISION_DOMICILIARIA = [
  'SÃ­ procede solicitud de prisiÃ³n domiciliaria de mitad de pena',
  'No aplica porque ya hay solicitud de libertad o subrogado penal en trÃ¡mite',
  'No aplica porque ya est? en libertad por pena cumplida',
  'No aplica porque ya se concediÃ³ libertad condicional',
  'No aplica porque ya se concediÃ³ prisiÃ³n domiciliaria',
  'No aplica porque ya se concediÃ³ utilidad pÃºblica',
  'No aplica porque el proceso no ha sido asignado a jepms',
  'No aplica porque el proceso est? en otro circuito judicial (falta trasladar el proceso al actual)',
  'No aplica porque la condena est? por delito excluido del subrogado',
  'No aplica porque recientemente se le revocÃ³ un subrogado penal',
  'No aplica porque recientemente se le negÃ³ subrogado penal',
  'No aplica porque la evaluaciÃ³n de conducta es negativa',
  'No aplica porque se determinÃ³ que no ha cumplido requisito temporal para acceder',
  'No aplica porque tiene acumulaciÃ³n de penas',
  'No aplica porque la persona fue trasladada a otro ERON',
  'No aplica porque la persona est? sindicada',
  'No aplica porque la cartilla biogrÃ¡fica no est? actualizada',
  'RevisiÃ³n suspendida porque se requiere primero trÃ¡mite de acumulaciÃ³n de penas',
  'No aplica porque el usuario no puede demostrar arraigo',
];

const OPCIONES_PROCEDENCIA_UTILIDAD_PUBLICA = [
  'SÃ­ cumple requisitos objetivos',
  'No cumple por tipo de delito',
  'No cumple monto de pena',
  'No cumple por reincidencia',
  'No cumple por delito excluido',
];

const OPCIONES_OTRAS_SOLICITUDES = [
  'Ninguna',
  'Solicitud de actualizaciÃ³n de conducta',
  'Solicitud de asignaciÃ³n de JEPMS',
  'Solicitud de traslado del proceso al distrito judicial correspondiente',
  'Solicitud de actualizaciÃ³n de cartilla biogrÃ¡fica',
  'Solicitud de redenciÃ³n de pena 2x3 trabajo',
  'Solicitud de redenciÃ³n de pena 2x3 analÃ³gica en actividades distintas a trabajo',
  'Permiso de 72 horas',
  'Otra',
];

const OPCIONES_AURORA_DECISION_USUARIO = [
  'SÃ­, desea que el defensor(a) pÃºblico(a) avance con la solicitud',
  'SÃ­ desea que el defensor presente solicitud, pero suscrita por la persona privada de la Libertad.',
  'No, porque desea tramitar la solicitud a travÃ©s de su defensor de confianza',
  'No desea tramitar la solicitud',
  'No avanzar? porque no puede demostar arraigo fuera de prisiÃ³n',
  'El usuario es renuente a la atenciÃ³n',
];

const OPCIONES_AURORA_ACTUACION_A_ADELANTAR = [
  'Libertad condicional',
  'PrisiÃ³n domiciliaria',
  'Utilidad pÃºblica (solo para mujeres)',
  'Utilidad pÃºblica y prisiÃ³n domiciliaria',
  'Utilidad pÃºblica y libertad condicional',
  'RedenciÃ³n de pena y libertad condicional',
  'RedenciÃ³n de pena y prisiÃ³n domiciliaria',
  'Libertad condicional y en subsidio prisiÃ³n domiciliaria',
  'AcumulaciÃ³n de penas',
  'Libertad por pena cumplida',
  'RedenciÃ³n de pena y libertad por pena cumplida',
  'RedenciÃ³n de pena',
  'Permiso de 72 horas',
  'Solicitud de actualizaciÃ³n de conducta',
  'Solicitud de asginaciÃ³n de JEPMS',
  'Solicitud de traslado del proceso al distrito judicial correspondiente',
  'Reiterar solicitud de subrogado penal ya radicada',
  'Solicitud de actualizaciÃ³n de cartilla biogrÃ¡fica',
  'Otra',
  'Ninguna porque la persona est? sindicada',
  'Ninguna porque est? en trÃ¡mite una solicitud de subrogado penal o pena cumplida',
  'Ninguna porque no procede subrogado penal en este momento por falta de cumplimiento de requisitos',
  'Ninguna porque no procede subrogado penal por exclusiÃ³n de delito',
  'Ninguna porque ya no est? en prisiÃ³n',
];

const ACTUACIONES_UTILIDAD_PUBLICA = new Set([
  'Utilidad pÃºblica (solo para mujeres)',
  'Utilidad pÃºblica y prisiÃ³n domiciliaria',
  'Utilidad pÃºblica y libertad condicional',
]);
const ACTUACIONES_UTILIDAD_PUBLICA_NORMALIZADAS = new Set(
  Array.from(ACTUACIONES_UTILIDAD_PUBLICA).map((v) => norm(maybeDecodeUtf8Mojibake(v)))
);

const OPCIONES_BLOQUE_5A_SENTIDO_DECISION = ['Otorga utilidad pÃºblica', 'Niega utilidad pÃºblica'];
const OPCIONES_BLOQUE_5A_MOTIVO_DECISION_NEGATIVA = [
  'No concede por requisito objetivo',
  'No concende por requisito subjetivo',
  'No concede por requisitos objetivos y subjetivos',
  'Niega por falta de pruebas',
  'Concede otro beneficio',
  'Pena cumplida',
];
const OPCIONES_BLOQUE_5A_SENTIDO_DECISION_RESUELVE_RECURSO = [
  'Otorga utilidad pÃºblica',
  'Niega utilidad pÃºblica',
];

const OPCIONES_BLOQUE_5B_SENTIDO_DECISION = ['Concede subrogado penal', 'No concede subrogado penal'];
const OPCIONES_BLOQUE_5B_MOTIVO_DECISION_NEGATIVA = [
  'Porque no cumple aÃºn con el tiempo para aplicar al subrogado',
  'Porque falta documentaciÃ³n a remitir por parte del Inpec',
  'Porque la autoridad judicial no tuvo en cuenta todo el tiempo de privaciÃ³n de libertad de la persona en otros ERON o centro de detenciÃ³n transitoria',
  'Por la valoraciÃ³n de la conducta punible contenida en la sentencia',
  'Porque el juez encuentra que el avance en el tratamiento penitenciario de la persona aÃºn no es suficiente',
  'Porque tiene calificaciones de conducta negativa de periodos anteriores',
  'Porque no se demostrÃ³ el arraigo familiar o social de la persona privada de la libertad',
  'Porque no se ha reparado a la vÃ­ctima o asegurado el pago de la indemnizaciÃ³n a esta a travÃ©s de garantÃ­a personal, real, bancaria o acuerdo de pago y tampoco se ha demostrado la insolvencia del condenado',
  'Porque determinÃ³ que hay un delito excluido que impide concesiÃ³n',
  'Porque la persona privada de la libertad pertenece al grupo familiar de la vÃ­ctima',
  'Porque no se demostrÃ³ el arraigo familiar o social de la persona privada de la libertad',
  'Porque la persona no tiene un lugar al que ir por fuera de prisiÃ³n (no tiene arraigo)',
  'Porque no cumple requisito de jefatura de hogar para utilidad pÃºblica',
  'Porque no cumple requisito de marginalidad para utilidad pÃºblica',
  'Se considerÃ³ que no cumple algÃºn requisito para su procedencia',
];
const OPCIONES_BLOQUE_5B_SENTIDO_DECISION_RESUELVE_SOLICITUD = ['Favorable', 'Desfavorable'];
const OPCIONES_CIERRE_CASO_IMPOSIBILIDAD_AVANZAR = [
  '-',
  'Se cierra porque la persona ya no est\u00e1 en el ERON por raz\u00f3n ajena a este tr\u00e1mite.',
  'Otro motivo.',
];

// CELESTE (PPL SINDICADOS)
const OPCIONES_SITUACION_JURIDICA_ACTUALIZADA = ['Condenado', 'Sindicado'];
const OPCIONES_CELESTE_ANALISIS_ACTUACION = [
  'Se avanzar? con solicitud de revocatoria o sustituciÃ³n de la medida',
  'No se avanzar? con la revocatoria porque la persona ya fue condenada',
  'No se avanzar? con la revocatoria porque aÃºn no reÃºne el tiempo exigido por la norma para solicitar el levantamiento de la detenciÃ³n preventiva',
  'No se avanzar? con la revocatoria porque la persona est? procesada por delitos en los que procede prÃ³rroga de la detenciÃ³n preventiva y aÃºn no cumple ese tiempo',
  'No se avanzar? con la revocatoria porque son tres o mÃ¡s los acusados y aÃºn no se cumple el tiempo para solicitar el levantamiento de la detenciÃ³n preventiva en este supuesto',
  'No se avanzar? con la revocatoria porque la persona est? procesada por delitos atribuibles a Grupos Delictivos Organizados (GDO) o Grupos Armados Organizados (GAO) y aÃºn no cumple el tiempo permitido',
  'No se avanzar? con la revocatoria porque ya hay una solicitud en trÃ¡mite',
];
const OPCIONES_SENTIDO_DECISION_CELESTE = [
  'Revoca medida de aseguramiento privativa de la libertad',
  'Sustituye medida de aseguramiento privativa de la libertad',
  'Niega la solicitud',
];
const OPCIONES_MOTIVO_DECISION_NEGATIVA_CELESTE = [
  'Porque no cumple aÃºn con los tÃ©rminos exigidos',
  'Porque est? procesado por causales en las que procede la prÃ³rroga de la medida',
  'Otra',
];
const OPCIONES_SENTIDO_DECISION_RECURSO_CELESTE = [
  'Concede levantamiento de medida de aseguramiento',
  'No concede levantamiento de medida de aseguramiento',
];

function norm(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isFilled(value) {
  return String(value ?? '').trim() !== '';
}

function isCierreImposibilidadSeleccionado(value) {
  const v = String(value ?? '').trim();
  return v !== '' && v !== '-';
}

function resolveTipoFromText(value) {
  const text = norm(value);
  if (!text || text === '-') return null;
  if (text.includes('condenad')) return 'condenado';
  if (text.includes('sindicad')) return 'sindicado';
  if (text === 'condenado' || text === 'sindicado') return text;
  return null;
}

function computeFlow(formData, fallbackTipo = '') {
  // Regla principal: flujo por "Situación Jurídica"; fallback por tipo informado por API cuando el CSV viene vacío.
  const fromSituacion = resolveTipoFromText(formData?.['SituaciÃ³n JurÃ­dica']);
  if (fromSituacion) return fromSituacion;

  const fromSituacionActualizada = resolveTipoFromText(
    formData?.['SituaciÃ³n JurÃ­dica actualizada (de conformidad con la rama judicial)']
  );
  if (fromSituacionActualizada) return fromSituacionActualizada;

  const fromHint =
    resolveTipoFromText(fallbackTipo) ||
    resolveTipoFromText(formData?.__tipoApi) ||
    resolveTipoFromText(formData?.tipo) ||
    resolveTipoFromText(formData?.tipoPpl);
  if (fromHint) return fromHint;

  return null;
}

function isEquivalenteNo(valor) {
  const v = norm(valor);
  if (!v) return false;
  if (v === 'no') return true;
  if (v.startsWith('no aplica')) return true;
  if (v.startsWith('no cumple')) return true;
  return false;
}

function isEquivalenteSi(valor) {
  const decoded = maybeDecodeUtf8Mojibake(decodeUnicodeEscapes(String(valor ?? '')));
  const v = norm(decoded);
  return v === 'si' || v === 's?';
}

function isNoConcedeSubrogadoPenal(valor) {
  return norm(valor) === norm('No concede subrogado penal');
}

function decisionUsuarioPermiteAvance(valor) {
  const v = norm(valor);
  if (!v) return false;
  if (v.startsWith('si')) return true;
  if (v.includes('desea que el defensor') && v.includes('avance con la solicitud')) return true;
  if (v.includes('desea que el defensor presente solicitud')) return true;
  return false;
}

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

function normalizeFieldName(value) {
  return maybeDecodeUtf8Mojibake(decodeUnicodeEscapes(String(value ?? '')))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isDefensorFieldName(value) {
  const normalized = normalizeFieldName(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (
    normalized === 'defensor a publico a asignado para tramitar la solicitud' ||
    normalized === 'defensor asignado' ||
    normalized === 'defensor'
  );
}

function isDefensorLikeFieldName(value) {
  const normalized = normalizeFieldName(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.includes('defensor');
}

const DEFENSOR_DIRECT_KEYS = [
  'Defensor(a) Público(a) Asignado para tramitar la solicitud',
  'Defensor(a) PÃºblico(a) Asignado para tramitar la solicitud',
  'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
  'Defensor(a) PÃƒÂºblico(a) Asignado para tramitar la solicitud',
  'Defensor',
  'defensorAsignado',
];

function getDefensorAsignadoValue(registro) {
  const source = registro && typeof registro === 'object' ? registro : {};

  for (const key of DEFENSOR_DIRECT_KEYS) {
    const value = String(source?.[key] ?? '');
    if (value.trim()) return value;
  }

  for (const [key, rawValue] of Object.entries(source)) {
    const normalized = normalizeFieldName(key);
    const normalizedLoose = normalized
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const isDefensorField =
      normalizedLoose === 'defensor a publico a asignado para tramitar la solicitud' ||
      normalizedLoose === 'defensor asignado' ||
      normalizedLoose === 'defensor';
    if (!isDefensorField) continue;
    const value = String(rawValue ?? '');
    if (value.trim()) return value;
  }

  return '';
}

function hydrateDefensorAliases(registro) {
  const source = registro && typeof registro === 'object' ? registro : {};
  const defensor = getDefensorAsignadoValue(source);
  if (!defensor) return { ...source };

  return {
    ...source,
    'Defensor(a) Público(a) Asignado para tramitar la solicitud': defensor,
    'Defensor(a) PÃºblico(a) Asignado para tramitar la solicitud': defensor,
    'Defensor(a) Publico(a) Asignado para tramitar la solicitud': defensor,
    Defensor: defensor,
    defensorAsignado: defensor,
  };
}

const REGISTRO_PROXY_TARGET = new WeakMap();

function wrapRegistroForLookup(rawRegistro) {
  if (!rawRegistro || typeof rawRegistro !== 'object') return null;
  if (REGISTRO_PROXY_TARGET.has(rawRegistro)) return rawRegistro;

  const target = hydrateDefensorAliases(rawRegistro);
  const normalizedIndex = new Map();
  Object.keys(target).forEach((key) => {
    const nk = normalizeFieldName(key);
    if (nk && !normalizedIndex.has(nk)) normalizedIndex.set(nk, key);
  });

  const proxy = new Proxy(target, {
    get(obj, prop, receiver) {
      if (typeof prop !== 'string') return Reflect.get(obj, prop, receiver);
      if (Reflect.has(obj, prop)) return Reflect.get(obj, prop, receiver);
      const alt = normalizedIndex.get(normalizeFieldName(prop));
      if (alt && Reflect.has(obj, alt)) return Reflect.get(obj, alt, receiver);
      return undefined;
    },
  });

  REGISTRO_PROXY_TARGET.set(proxy, target);
  return proxy;
}

function unwrapRegistro(record) {
  if (!record || typeof record !== 'object') return {};
  return REGISTRO_PROXY_TARGET.get(record) || record;
}

function readRegistroTextByAliases(record, aliases = []) {
  const source = record && typeof record === 'object' ? record : {};
  const aliasList = Array.isArray(aliases) ? aliases : [];

  for (const alias of aliasList) {
    const value = String(source?.[alias] ?? '').trim();
    if (value) return value;
  }

  const normalizedAliases = new Set(aliasList.map((alias) => normalizeFieldName(alias)).filter(Boolean));
  if (!normalizedAliases.size) return '';

  for (const [key, rawValue] of Object.entries(source)) {
    if (!normalizedAliases.has(normalizeFieldName(key))) continue;
    const value = String(rawValue ?? '').trim();
    if (value) return value;
  }

  return '';
}

function displayText(value) {
  let out = decodeUnicodeEscapes(String(value ?? ''));
  out = maybeDecodeUtf8Mojibake(out);
  out = out
    .replace(/\u00C2(?=[Â¿Â¡])/g, '')
    .replace(/\best\?/gi, 'est\u00e1')
    .replace(/\bavanzar\?/gi, 'avanzar\u00e1')
    .replace(/\bdemostar\b/gi, 'demostrar')
    .replace(/\?ltima/gi, '\u00faltima');
  return out;
}

const ALIASES_FECHA_ULTIMA_CALIFICACION = [
  KEY_FECHA_ULTIMA_CALIFICACION,
  'Fecha última calificación',
  'Fecha ultima calificacion',
  'Fecha calificacion',
];

const ALIASES_ACTA_CALIFICACION = [
  KEY_ACTA_CALIFICACION,
  'No.Acta de calificación de conducta',
  'No.Acta de calificacion de conducta',
  'No de acta de calificacion de conducta',
  'No acta de calificacion de conducta',
  'No acta',
];

const ALIASES_EVALUACION_DESDE = [
  KEY_EVALUACION_DESDE,
  'Evaluación de conducta desde',
  'Evaluacion de conducta desde',
  'Evaluacion desde',
];

const ALIASES_EVALUACION_HASTA = [
  KEY_EVALUACION_HASTA,
  'Evaluación de conducta hasta',
  'Evaluacion de conducta hasta',
  'Evaluacion hasta',
];

const ALIASES_CALIFICACION_CONDUCTA = [
  KEY_CALIFICACION_CONDUCTA,
  'Calificación de conducta',
  'Calificacion de conducta',
  'Calificacion',
];

function buildCalificacionSnapshot(record) {
  return {
    fechaUltimaCalificacion: readRegistroTextByAliases(record, ALIASES_FECHA_ULTIMA_CALIFICACION),
    numeroActa: readRegistroTextByAliases(record, ALIASES_ACTA_CALIFICACION),
    evaluacionDesde: readRegistroTextByAliases(record, ALIASES_EVALUACION_DESDE),
    evaluacionHasta: readRegistroTextByAliases(record, ALIASES_EVALUACION_HASTA),
    calificacionConducta: readRegistroTextByAliases(record, ALIASES_CALIFICACION_CONDUCTA),
  };
}

function hasCalificacionSnapshotData(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  return [source.fechaUltimaCalificacion, source.numeroActa, source.evaluacionDesde, source.evaluacionHasta, source.calificacionConducta].some(
    (value) => isFilled(value)
  );
}

function formatCalificacionDate(value) {
  const normalized = toDateInputValue(value);
  if (!normalized) {
    const raw = String(value ?? '').trim();
    return raw || '\u2014';
  }
  const [year, month, day] = normalized.split('-');
  return `${day}/${month}/${year}`;
}

function parseRowIndexFromActuacionId(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/-(\d+)$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseDateParts(rawValue) {
  const text = String(rawValue ?? '').trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { year, month, day };
    return null;
  }

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    const hasTime = /\d{1,2}:\d{2}/.test(text);
    let day = null;
    let month = null;

    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else if (a <= 12 && b <= 12) {
      // CSVs tipo Excel suelen traer M/D/YYYY con hora; formularios manuales suelen venir D/M/YYYY.
      if (hasTime) {
        month = a;
        day = b;
      } else {
        day = a;
        month = b;
      }
    }

    if (month != null && day != null && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

function toDateInputValue(rawValue) {
  const parts = parseDateParts(rawValue);
  if (!parts) return '';
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

function parseDateValue(rawValue) {
  const parts = parseDateParts(rawValue);
  if (!parts) return null;
  const parsed = new Date(parts.year, parts.month - 1, parts.day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePercentageValue(rawValue) {
  const text = String(rawValue ?? '').trim().replace(',', '.');
  if (!text) return null;
  const hasPercentSymbol = text.includes('%');
  const match = text.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  if (!Number.isFinite(parsed)) return null;
  const normalized = !hasPercentSymbol && parsed >= 0 && parsed <= 2 ? parsed * 100 : parsed;
  return Math.max(0, normalized);
}

function normalizePercentageStorageValue(rawValue) {
  const parsed = parsePercentageValue(rawValue);
  if (parsed == null) return String(rawValue ?? '').trim();
  const rounded = Number(parsed.toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatPercentageDisplayValue(rawValue) {
  const parsed = parsePercentageValue(rawValue);
  if (parsed == null) return String(rawValue ?? '').trim();
  const rounded = Number(parsed.toFixed(2));
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `${text}%`;
}

const META_REGISTRO_KEYS = new Set(['casos', 'activeCaseId', 'caseId']);
const CAMPOS_BASE_NUEVA_ACTUACION = new Set([
  'nombre',
  'nombre usuario',
  'tipo de indentificacion',
  'tipo de identificacion',
  'numero de identificacion',
  'situacion juridica',
  'situacion juridica actualizada (de conformidad con la rama judicial)',
  'genero',
  'enfoque etnico/racial/cultural',
  'nacionalidad',
  'fecha de nacimiento',
  'edad',
  'lugar de privacion de la libertad',
  'nombre del lugar de privacion de la libertad',
  'departamento del lugar de privacion de la libertad',
  'distrito municipio del lugar de privacion de la libertad',
  'la persona sigue en el cdt',
  'autoridad a cargo',
  'numero de proceso',
  'delitos',
  'fecha de captura',
  'pena anos meses y dias',
  'pena total en dias',
  'tiempo que la persona lleva privada de la libertad en dias',
  'redencion total acumulada en dias',
  'tiempo efectivo de pena cumplida en dias teniendo en cuenta la redencion',
  'porcentaje de avance de pena cumplida',
  'fase de tramiento',
  'cuenta con requerimientos judiciales por otros procesos',
  'fecha ultima calificacion',
  'calificacion de conducta',
  'no acta de calificacion de conducta',
  'evaluacion de conducta desde',
  'evaluacion de conducta hasta',
  'defensor(a) publico(a) asignado para tramitar la solicitud',
  'pag',
  '__rowindex',
]);

function normalizeFieldKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

const CAMPOS_BASE_NUEVA_ACTUACION_NORMALIZED = new Set(
  Array.from(CAMPOS_BASE_NUEVA_ACTUACION).map((field) => normalizeFieldKey(field))
);

function isBaseFieldForNuevaActuacion(key) {
  return CAMPOS_BASE_NUEVA_ACTUACION_NORMALIZED.has(normalizeFieldKey(key));
}

function buildNuevaActuacionDraft(source) {
  const target = source && typeof source === 'object' ? source : {};
  const next = {};

  Object.keys(target).forEach((key) => {
    if (META_REGISTRO_KEYS.has(key)) return;

    const value = target[key];
    if (Array.isArray(value)) return;
    if (value && typeof value === 'object') return;

    if (isBaseFieldForNuevaActuacion(key)) {
      next[key] = value;
      return;
    }
    next[key] = '';
  });

  return next;
}

const CAMPOS_LIMPIABLES_DESDE_BLOQUE_3 = new Set(
  [
    'Defensor(a) Público(a) Asignado para tramitar la solicitud',
    'Fecha de análisis jurídico del caso',
    'Procedencia de libertad condicional',
    'Procedencia de prisión domiciliaria de mitad de pena',
    'Procedencia de utilidad pública (solo para mujeres)',
    'Procedencia de pena cumplida',
    'Procedencia de acumulación de penas',
    KEY_Q35_LEGACY,
    KEY_Q35_UTF8,
    'Otras solicitudes a tramitar',
    'Resumen del análisis del caso',
    'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
    'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO',
    'Fecha de entrevista',
    'Decisión del usuario',
    'Actuación a adelantar',
    'Requiere pruebas',
    'Poder en caso de avanzar con la solicitud',
    'Fecha de entrevista psicosocial',
    'Cumple el requisito de marginalidad',
    'Cumple el requisito de jefatura de hogar',
    'Se requiere misión de trabajo',
    'Fecha de solicitud de misión de trabajo',
    'Fecha de asignación de investigador',
    'Fecha en la que se reciben todas las pruebas',
    'Fecha de radicación de solicitud de utilidad pública',
    'Fecha de recepción de pruebas aportadas por el usuario (si aplica)',
    'Fecha de solicitud de documentos al Inpec (si aplica)',
    'Fecha de presentación de la solicitud a la autoridad',
    'Fecha de decisión de la autoridad',
    'Sentido de la decisión',
    'Motivo de la decisión negativa',
    'Se presenta recurso',
    'Fecha de recurso en caso desfavorable',
    'Sentido de la decisión que resuelve recurso',
    'Sentido de la decisión que resuelve la solicitud',
    'Cierre del caso por imposibilidad de avanzar (si aplica)',
    'Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad pública',
    'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA',
    'FECHA DE REALIZACIÓN DE AUDIENCIA',
    'SENTIDO DE LA DECISIÓN',
    'MOTIVO DE LA DECISIÓN NEGATIVA',
    '¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?',
    'Fecha de presentación del recurso',
    'SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO',
  ].map((field) => normalizeFieldName(field))
);

function isCampoLimpiableDesdeBloque3(name) {
  return CAMPOS_LIMPIABLES_DESDE_BLOQUE_3.has(normalizeFieldName(name));
}

function Campo({
  label,
  name,
  type = 'text',
  value,
  onChange,
  options,
  readOnly = false,
  disabled = false,
  required = true,
  showObligatoria = false,
}) {
  const isDisabled = Boolean(readOnly || disabled);
  const canClear = isCampoLimpiableDesdeBloque3(name);
  const clearTitle = `Limpiar ${displayText(label)}`;
  const clearValue = () => {
    if (isDisabled || !canClear) return;
    onChange(name, '');
  };
  const labelNode = (
    <label>
      {displayText(label)}
      {showObligatoria && <span className="required-note"> *Obligatoria*</span>}
    </label>
  );
  if (type === 'select') {
    const normalizedValue = value === '-' ? '' : value ?? '';
    const normalizedOptions = (options || OPCIONES_SI_NO).map((opt) => {
      const optionValue = typeof opt === 'string' ? opt : String(opt?.value ?? '');
      const optionLabel = typeof opt === 'string' ? opt : String(opt?.label ?? opt?.value ?? '');
      return { value: optionValue, label: optionLabel };
    });
    const hasDashOption = normalizedOptions.some((opt) => String(opt?.value ?? '').trim() === '-');
    const selectedLabel = normalizedOptions.find((opt) => opt.value === normalizedValue)?.label ?? '';
    const selectTitle = selectedLabel ? displayText(selectedLabel) : undefined;
    return (
      <div className={`form-field${isDisabled ? ' is-disabled' : ''}`}>
        {labelNode}
        <select
          name={name}
          value={normalizedValue}
          onChange={(e) => onChange(name, e.target.value)}
          disabled={isDisabled}
          required={required}
          title={selectTitle}
        >
          {canClear && !hasDashOption ? <option value="">-</option> : <option value="" disabled hidden />}
          {normalizedOptions.map((opt, idx) => {
            const optionValue = opt.value;
            const optionLabel = opt.label;
            return (
              <option
                key={`${idx}-${optionValue}`}
                value={optionValue}
                title={displayText(optionLabel)}
              >
                {displayText(optionLabel)}
              </option>
            );
          })}
        </select>
      </div>
    );
  }

  if (type === 'textarea') {
    const hasValue = String(value ?? '').trim() !== '';
    return (
      <div className={`form-field${isDisabled ? ' is-disabled' : ''}`}>
        {labelNode}
        <textarea
          name={name}
          value={value ?? ''}
          onChange={(e) => {
            if (!isDisabled) onChange(name, e.target.value);
          }}
          rows={4}
          readOnly={isDisabled}
          disabled={isDisabled}
          required={required}
        />
        {canClear && !isDisabled && hasValue && (
          <button type="button" className="field-clear-button" onClick={clearValue} title={clearTitle}>
            Limpiar
          </button>
        )}
      </div>
    );
  }

  if (type === 'datalist') {
    const normalizedOptions = (options || [])
      .map((opt) => (typeof opt === 'string' ? opt : String(opt?.label ?? opt?.value ?? '')))
      .map((opt) => String(opt ?? '').trim())
      .filter(Boolean);
    const safeName = String(name ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-');
    const listId = `datalist-${safeName || 'campo'}`;
    const hasValue = String(value ?? '').trim() !== '';

    return (
      <div className={`form-field${isDisabled ? ' is-disabled' : ''}`}>
        {labelNode}
        <input
          type="text"
          name={name}
          list={listId}
          value={value ?? ''}
          onChange={(e) => {
            if (!isDisabled) onChange(name, e.target.value);
          }}
          readOnly={isDisabled}
          disabled={isDisabled}
          required={required}
        />
        <datalist id={listId}>
          {normalizedOptions.map((opt, idx) => (
            <option key={`${idx}-${opt}`} value={opt} />
          ))}
        </datalist>
        {canClear && !isDisabled && hasValue && (
          <button type="button" className="field-clear-button" onClick={clearValue} title={clearTitle}>
            Limpiar
          </button>
        )}
      </div>
    );
  }

  if (type === 'date') {
    const normalizedDateValue = toDateInputValue(value);
    const hasValue = String(normalizedDateValue ?? '').trim() !== '';
    return (
      <div className={`form-field${isDisabled ? ' is-disabled' : ''}`}>
        {labelNode}
        <input
          type="date"
          name={name}
          value={normalizedDateValue}
          onChange={(e) => {
            if (!isDisabled) onChange(name, e.target.value);
          }}
          readOnly={isDisabled}
          disabled={isDisabled}
          required={required}
          title={String(value ?? '').trim() || undefined}
        />
        {canClear && !isDisabled && hasValue && (
          <button type="button" className="field-clear-button" onClick={clearValue} title={clearTitle}>
            Limpiar
          </button>
        )}
      </div>
    );
  }

  const hasValue = String(value ?? '').trim() !== '';
  return (
    <div className={`form-field${isDisabled ? ' is-disabled' : ''}`}>
      {labelNode}
      <input
        type={type}
        name={name}
        value={value ?? ''}
        onChange={(e) => {
          if (!isDisabled) onChange(name, e.target.value);
        }}
        readOnly={isDisabled}
        disabled={isDisabled}
        required={required}
      />
      {canClear && !isDisabled && hasValue && (
        <button type="button" className="field-clear-button" onClick={clearValue} title={clearTitle}>
          Limpiar
        </button>
      )}
    </div>
  );
}

export default function FormularioAtencion({ numeroInicial }) {
  const [numeroBusqueda, setNumeroBusqueda] = useState(numeroInicial || '');
  const [registro, setRegistro] = useState(null);
  const [tipoRegistro, setTipoRegistro] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('Aurora - Cambios guardados correctamente');
  const [saltoCelesteGuardando, setSaltoCelesteGuardando] = useState(false);
  const [auroraAbrirBloque2, setAuroraAbrirBloque2] = useState(false);
  const [historialRefreshToken, setHistorialRefreshToken] = useState(0);
  const [actuacionActivaId, setActuacionActivaId] = useState('');
  const [textoAccionCaso, setTextoAccionCaso] = useState(getLabelAccionCaso(false));
  const [creandoActuacion, setCreandoActuacion] = useState(false);
  const [mostrarFormularioDetalle, setMostrarFormularioDetalle] = useState(false);
  const [defensoresCatalogo, setDefensoresCatalogo] = useState([]);
  const [actuacionesCalificacion, setActuacionesCalificacion] = useState([]);
  const bloque2AuroraRef = useRef(null);

  useEffect(() => {
    if (numeroInicial) buscarRegistro(numeroInicial);
  }, [numeroInicial]);

  useEffect(() => {
    let ignore = false;
    const cargarDefensores = async () => {
      try {
        const catalogo = await getDefensoresCatalogo();
        if (ignore) return;
        setDefensoresCatalogo(Array.isArray(catalogo) ? catalogo : []);
      } catch (e) {
        reportError(e, 'formulario-entrevista:defensores-catalogo');
      }
    };
    cargarDefensores();
    return () => {
      ignore = true;
    };
  }, []);

  const opcionesDefensores = useMemo(() => {
    const dedup = new Set();
    defensoresCatalogo.forEach((item) => {
      const nombre = String(item?.nombre ?? '').trim();
      if (nombre) dedup.add(nombre);
    });
    return Array.from(dedup).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [defensoresCatalogo]);

  const flow = useMemo(() => (registro ? computeFlow(registro, tipoRegistro) : null), [registro, tipoRegistro]);
  const tiempoPrivacionMeses = useMemo(() => {
    if (!registro) return '';

    const rawDays = String(registro['Tiempo que la persona lleva privada de la libertad (en dÃ­as)'] ?? '').trim();
    const days = Number(rawDays.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(days)) return String(Math.floor(days / 30));

    const rawFecha = String(registro['Fecha de captura'] ?? '').trim();
    if (!rawFecha) return '';
    const fc = parseDateValue(rawFecha);
    if (!fc) return '';
    const diffDays = Math.floor((Date.now() - fc.getTime()) / 86400000);
    if (!Number.isFinite(diffDays) || diffDays < 0) return '';
    return String(Math.floor(diffDays / 30));
  }, [registro]);

  const getDocumentoActual = useCallback(
    (fromRegistro = registro) => {
      const source = fromRegistro && typeof fromRegistro === 'object' ? fromRegistro : {};
      const explicit = source.numeroIdentificacion ?? source['NÃºmero de identificaciÃ³n'] ?? source['Numero de identificacion'];
      if (String(explicit ?? '').trim()) return String(explicit).trim();

      const docKey = Object.keys(source).find((k) => {
        const normalized = String(k || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        return normalized === 'numero de identificacion' || normalized === 'numeroidentificacion';
      });

      return String((docKey ? source[docKey] : '') ?? numeroBusqueda ?? '').trim();
    },
    [numeroBusqueda, registro]
  );

  const documentoActual = useMemo(() => getDocumentoActual(registro), [getDocumentoActual, registro]);

  useEffect(() => {
    let ignore = false;
    const doc = String(documentoActual ?? '').trim();

    if (!doc) {
      setActuacionesCalificacion([]);
      return () => {
        ignore = true;
      };
    }

    const cargarActuacionesCalificacion = async () => {
      try {
        const response = await getPplActuacionesByDocumento(doc);
        if (ignore) return;
        const rows = Array.isArray(response?.actuaciones) ? response.actuaciones : [];
        setActuacionesCalificacion(rows);
      } catch (e) {
        reportError(e, 'formulario-entrevista:actuaciones-calificacion');
        if (ignore) return;
        setActuacionesCalificacion([]);
      }
    };

    cargarActuacionesCalificacion();

    return () => {
      ignore = true;
    };
  }, [documentoActual, historialRefreshToken]);

  const buildUpdatePayload = useCallback(
    (nextData) => {
      const payload = { data: nextData };
      const id = String(actuacionActivaId || '').trim();
      if (id) payload.actuacionId = id;
      return payload;
    },
    [actuacionActivaId]
  );

  const handleActionLabelChange = useCallback((nextLabel) => {
    const incoming = String(nextLabel || '').trim();
    if (!incoming) return;
    setTextoAccionCaso((prev) => (prev === incoming ? prev : incoming));
  }, []);

  async function buscarRegistro(numero) {
    const doc = String(numero || '').trim();
    if (!doc) {
      setError('Ingrese un numero de identificacion.');
      return;
    }

    setCargando(true);
    setError('');
    setGuardadoOk(false);
    setToastOpen(false);
    try {
      const data = await getPplByDocumento(doc);
      const tipo = String(data?.tipo ?? '').trim();
      const registroData =
        data?.registro && typeof data.registro === 'object'
          ? { ...data.registro, __tipoApi: tipo }
          : null;
      setNumeroBusqueda(doc);
      setTipoRegistro(tipo);
      setRegistro(wrapRegistroForLookup(registroData));
      setActuacionActivaId('');
      setTextoAccionCaso(getLabelAccionCaso(false));
      setMostrarFormularioDetalle(false);
      setHistorialRefreshToken((prev) => prev + 1);
    } catch (e) {
      reportError(e, 'formulario-entrevista:buscar');
      setTipoRegistro('');
      setRegistro(null);
      setActuacionActivaId('');
      setTextoAccionCaso(getLabelAccionCaso(false));
      setMostrarFormularioDetalle(false);
      setError('No se encontro el usuario con ese numero.');
    } finally {
      setCargando(false);
    }
  }

  function handleConsultarOtro() {
    setTipoRegistro('');
    setRegistro(null);
    setNumeroBusqueda('');
    setActuacionActivaId('');
    setTextoAccionCaso(getLabelAccionCaso(false));
    setMostrarFormularioDetalle(false);
    setError('');
    setGuardadoOk(false);
    setToastOpen(false);
  }

  function handleChange(name, value) {
    setRegistro((prev) => {
      const base = { ...unwrapRegistro(prev) };
      if (isDefensorFieldName(name)) {
        const nextValue = String(value ?? '');
        const shouldClear = nextValue.trim() === '';
        let touched = false;
        Object.keys(base).forEach((k) => {
          const matchesDefensor = isDefensorFieldName(k) || (shouldClear && isDefensorLikeFieldName(k));
          if (!matchesDefensor) return;
          base[k] = nextValue;
          touched = true;
        });
        if (shouldClear) {
          DEFENSOR_DIRECT_KEYS.forEach((k) => {
            base[k] = '';
          });
        }
        if (!touched) {
          base[name] = nextValue;
        }
        return wrapRegistroForLookup(base);
      }

      const normalizedName = normalizeFieldName(name);
      const existingKey = Object.keys(base).find((k) => normalizeFieldName(k) === normalizedName);
      if (existingKey) {
        base[existingKey] = value;
      } else {
        base[name] = value;
      }
      return wrapRegistroForLookup(base);
    });
  }

  function handleSeleccionarActuacion(actuacion) {
    const selectedRegistro = actuacion?.registro && typeof actuacion.registro === 'object' ? actuacion.registro : null;
    if (!selectedRegistro) return;

    const selectedDoc = getDocumentoActual(selectedRegistro);
    if (selectedDoc) setNumeroBusqueda(selectedDoc);

    setError('');
    setGuardadoOk(false);
    setToastOpen(false);
    setRegistro(wrapRegistroForLookup({ ...selectedRegistro, __tipoApi: tipoRegistro }));
    setActuacionActivaId(String(actuacion?.id ?? ''));
    setMostrarFormularioDetalle(true);
  }

  async function handleCrearNuevaActuacion(options = {}) {
    if (!registro) {
      setError('Debe cargar un usuario antes de crear una nueva actuacion.');
      return;
    }

    const doc = getDocumentoActual(registro);
    if (!doc) {
      setError('Debe cargar un usuario antes de crear una nueva actuacion.');
      return;
    }

    setCreandoActuacion(true);
    try {
      const nextDraft = buildNuevaActuacionDraft(registro);
      const response = await createPplActuacion(doc, { data: nextDraft });
      const createdActuacion =
        response?.actuacion && typeof response.actuacion === 'object' ? response.actuacion : null;
      const createdRegistro =
        createdActuacion?.registro && typeof createdActuacion.registro === 'object'
          ? createdActuacion.registro
          : response?.registro && typeof response.registro === 'object'
            ? response.registro
            : null;

      if (!createdRegistro) throw new Error('Respuesta invalida al crear actuacion');

      setRegistro(wrapRegistroForLookup({ ...createdRegistro, __tipoApi: tipoRegistro }));
      setActuacionActivaId(String(createdActuacion?.id ?? ''));
      setError('');
      setGuardadoOk(false);
      setToastMessage('Nueva actuacion iniciada. Complete el formulario y guarde cuando finalice.');
      setToastOpen(true);
      setMostrarFormularioDetalle(Boolean(options?.abrirFormulario));
      setHistorialRefreshToken((prev) => prev + 1);
    } catch (e) {
      reportError(e, 'formulario-entrevista:crear-actuacion');
      setError('No fue posible iniciar una nueva actuacion para este PPL.');
    } finally {
      setCreandoActuacion(false);
    }
  }

  const habilitarPregunta35 = useMemo(() => {
    return isEquivalenteSi(registro?.['Procedencia de acumulaciÃ³n de penas']);
  }, [registro]);

  const cierreRegla1Bloque3 = useMemo(() => {
    if (!registro) return false;

    const respuestas30a33 = [
      registro['Procedencia de libertad condicional'],
      registro['Procedencia de prisiÃ³n domiciliaria de mitad de pena'],
      registro['Procedencia de utilidad pÃºblica (solo para mujeres)'],
      registro['Procedencia de pena cumplida'],
    ];

    const todasRespondidas = respuestas30a33.every((v) => isFilled(v));
    if (!todasRespondidas) return false;

    return respuestas30a33.every((v) => isEquivalenteNo(v));
  }, [registro]);

  const decisionUsuario = useMemo(
    () => readRegistroTextByAliases(registro, ['Decisión del usuario', 'Decision del usuario']),
    [registro]
  );
  const decisionUsuarioDesbloquea = useMemo(() => decisionUsuarioPermiteAvance(decisionUsuario), [decisionUsuario]);
  const decisionUsuarioBloquea = useMemo(() => Boolean(decisionUsuario && !decisionUsuarioDesbloquea), [
    decisionUsuario,
    decisionUsuarioDesbloquea,
  ]);

  const actuacionAdelantar = useMemo(
    () => readRegistroTextByAliases(registro, ['Actuación a adelantar', 'Actuacion a adelantar']),
    [registro]
  );
  const actuacionBloqueaPorNinguna = useMemo(
    () => Boolean(actuacionAdelantar && actuacionAdelantar.startsWith('Ninguna')),
    [actuacionAdelantar]
  );
  const actuacionIncluyeUtilidadPublica = useMemo(
    () => ACTUACIONES_UTILIDAD_PUBLICA_NORMALIZADAS.has(norm(maybeDecodeUtf8Mojibake(actuacionAdelantar))),
    [actuacionAdelantar]
  );
  const cierreImposibilidadTramite = useMemo(
    () => readRegistroTextByAliases(registro, ['Cierre del caso por imposibilidad de avanzar (si aplica)']),
    [registro]
  );
  const cierreImposibilidadUtilidad = useMemo(
    () =>
      readRegistroTextByAliases(registro, [
        'Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad pública',
        'Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad publica',
      ]),
    [registro]
  );
  const sentidoDecisionBloque5 = useMemo(
    () => readRegistroTextByAliases(registro, ['Sentido de la decisión', 'Sentido de la decision']),
    [registro]
  );

  const calificacionActual = useMemo(() => buildCalificacionSnapshot(registro), [registro]);
  const calificacionAnterior = useMemo(() => {
    const rows = Array.isArray(actuacionesCalificacion) ? actuacionesCalificacion : [];
    if (!rows.length) return buildCalificacionSnapshot(null);

    const sortedRows = [...rows].sort((a, b) => {
      const left = Number.isFinite(Number(a?.rowIndex)) ? Number(a.rowIndex) : 0;
      const right = Number.isFinite(Number(b?.rowIndex)) ? Number(b.rowIndex) : 0;
      return left - right;
    });

    const activeId = String(actuacionActivaId ?? '').trim();
    let activeIndex = activeId ? sortedRows.findIndex((item) => String(item?.id ?? '') === activeId) : -1;

    if (activeIndex < 0 && activeId) {
      const parsedRowIndex = parseRowIndexFromActuacionId(activeId);
      if (parsedRowIndex != null) {
        activeIndex = sortedRows.findIndex((item) => Number(item?.rowIndex) === parsedRowIndex);
      }
    }
    if (activeIndex < 0) activeIndex = sortedRows.length - 1;

    for (let idx = activeIndex - 1; idx >= 0; idx -= 1) {
      const snapshot = buildCalificacionSnapshot(sortedRows[idx]?.registro);
      if (hasCalificacionSnapshotData(snapshot)) return snapshot;
    }

    return buildCalificacionSnapshot(null);
  }, [actuacionesCalificacion, actuacionActivaId]);

  const calificacionesCompactas = useMemo(
    () => [
      {
        id: 'actual',
        label: 'Calificación actual',
        editable: true,
        ...calificacionActual,
      },
      {
        id: 'anterior',
        label: hasCalificacionSnapshotData(calificacionAnterior) ? 'Calificación anterior' : 'Calificación anterior (sin registro)',
        editable: false,
        ...calificacionAnterior,
      },
    ],
    [calificacionActual, calificacionAnterior]
  );

  const saltoAuroraDesdeCeleste = false;
  const auroraActivo = useMemo(() => flow === 'condenado' || saltoAuroraDesdeCeleste, [flow, saltoAuroraDesdeCeleste]);
  const cierrePorDecisionFinalBloque5 = useMemo(() => {
    if (!auroraActivo) return false;
    const cierrePorQ57 =
      isCierreImposibilidadSeleccionado(cierreImposibilidadTramite) ||
      isCierreImposibilidadSeleccionado(cierreImposibilidadUtilidad);
    const cierrePorQ52Utilidad = actuacionIncluyeUtilidadPublica && isFilled(sentidoDecisionBloque5);
    return cierrePorQ57 || cierrePorQ52Utilidad;
  }, [
    auroraActivo,
    cierreImposibilidadTramite,
    cierreImposibilidadUtilidad,
    actuacionIncluyeUtilidadPublica,
    sentidoDecisionBloque5,
  ]);
  const auroraRuleState = useMemo(
    () => evaluateAuroraRules({ answers: registro || {} }),
    [registro]
  );
  const auroraVisibleBlocks = useMemo(
    () => new Set(auroraRuleState?.visibleBlocks || []),
    [auroraRuleState]
  );
  const auroraDisabledFields = useMemo(
    () => new Set(auroraRuleState?.disabledFields || []),
    [auroraRuleState]
  );
  const isAuroraFieldDisabled = (name, base = false) =>
    Boolean(base || auroraDisabledFields.has(String(name || '')));
  const celesteRuleState = useMemo(
    () => evaluateCelesteRules({ answers: registro || {} }),
    [registro]
  );
  const celesteVisibleBlocks = useMemo(
    () => new Set(celesteRuleState?.visibleBlocks || []),
    [celesteRuleState]
  );
  const bloque4IncompletoParaAlertaGuardado = useMemo(() => {
    if (!auroraActivo) return false;
    if (!auroraVisibleBlocks.has('bloque4')) return false;
    if (!isFilled(decisionUsuario)) return true;
    if (!decisionUsuarioDesbloquea) return false;
    return !isFilled(actuacionAdelantar);
  }, [
    auroraActivo,
    auroraVisibleBlocks,
    decisionUsuario,
    decisionUsuarioDesbloquea,
    actuacionAdelantar,
  ]);

  const defensorAsignadoBloque3 = useMemo(() => getDefensorAsignadoValue(registro), [registro]);

  const mensajeBloqueoAvanceBloque3 = useMemo(() => {
    if (!registro || !auroraActivo) return '';
    if (!auroraVisibleBlocks.has('bloque3') || auroraVisibleBlocks.has('bloque4')) return '';
    if (auroraRuleState?.locked) return '';
    if (!defensorAsignadoBloque3) {
      return 'No se puede avanzar al Bloque 4. Falta completar la pregunta 28 (Defensor(a) publico(a) asignado para tramitar la solicitud).';
    }
    return 'No se puede avanzar al Bloque 4. Completa los campos obligatorios del Bloque 3.';
  }, [registro, auroraActivo, auroraVisibleBlocks, auroraRuleState, defensorAsignadoBloque3]);

  const casoCerrado = useMemo(() => {
    if (auroraActivo && cierrePorDecisionFinalBloque5) return true;

    // BLOQUE 4
    if (auroraActivo && decisionUsuarioBloquea) return true;
    if (auroraActivo && actuacionBloqueaPorNinguna) return true;

    // BLOQUE 3 (Caso cerrado - Regla 1)
    if (auroraActivo && cierreRegla1Bloque3) return true;

    // BLOQUE 5A
    const cumpleMarginalidad = String(registro?.['Cumple el requisito de marginalidad'] ?? '').trim();
    const cumpleJefatura = String(registro?.['Cumple el requisito de jefatura de hogar'] ?? '').trim();
    if (auroraActivo && actuacionIncluyeUtilidadPublica) {
      if (cumpleMarginalidad === 'No' || cumpleJefatura === 'No') return true;

      const sePresentaRecurso = String(registro?.['Se presenta recurso'] ?? '').trim();
      if (sePresentaRecurso === 'No') return true;

      const sentidoResuelveRecurso = String(registro?.['Sentido de la decisiÃ³n que resuelve recurso'] ?? '').trim();
      if (sentidoResuelveRecurso) return true;
    }

    // BLOQUE 5B
    if (auroraActivo && !actuacionIncluyeUtilidadPublica) {
      const sePresentaRecurso = String(registro?.['Se presenta recurso'] ?? '').trim();
      if (sePresentaRecurso === 'No') return true;

      const sentidoResuelveSolicitud = String(
        registro?.['Sentido de la decisiÃ³n que resuelve la solicitud'] ?? ''
      ).trim();
      if (sentidoResuelveSolicitud) return true;
    }
    return false;
  }, [
    registro,
    actuacionIncluyeUtilidadPublica,
    decisionUsuarioBloquea,
    actuacionBloqueaPorNinguna,
    cierreRegla1Bloque3,
    auroraActivo,
    cierrePorDecisionFinalBloque5,
  ]);

  const motivoCierre = useMemo(() => {
    if (!registro) return '';
    if (auroraActivo && cierrePorDecisionFinalBloque5) {
      if (isCierreImposibilidadSeleccionado(cierreImposibilidadTramite)) {
        return `Caso cerrado: ${cierreImposibilidadTramite}`;
      }
      if (isCierreImposibilidadSeleccionado(cierreImposibilidadUtilidad)) {
        return `Caso cerrado: ${cierreImposibilidadUtilidad}`;
      }
      if (actuacionIncluyeUtilidadPublica && isFilled(sentidoDecisionBloque5)) {
        return `Caso cerrado por decisión final de la autoridad: ${sentidoDecisionBloque5}.`;
      }
      return 'Caso cerrado por resultado final del bloque 5.';
    }
    if (auroraActivo && cierreRegla1Bloque3) {
      return 'Caso cerrado: en las preguntas 30 a 33 se marcó que no procede la solicitud (No/No aplica/No cumple).';
    }
    if (auroraActivo && decisionUsuarioBloquea) {
      return decisionUsuario
        ? `Caso cerrado por decisión del usuario: ${decisionUsuario}.`
        : 'Caso cerrado por decisión del usuario.';
    }
    if (auroraActivo && actuacionBloqueaPorNinguna) {
      return actuacionAdelantar
        ? `Caso cerrado por actuación seleccionada: ${actuacionAdelantar}.`
        : 'Caso cerrado por actuación bloqueante.';
    }
    const cumpleMarginalidad = String(registro?.['Cumple el requisito de marginalidad'] ?? '').trim();
    const cumpleJefatura = String(registro?.['Cumple el requisito de jefatura de hogar'] ?? '').trim();
    if (auroraActivo && actuacionIncluyeUtilidadPublica) {
      if (cumpleMarginalidad === 'No' || cumpleJefatura === 'No') {
        return 'Caso cerrado: no cumple requisitos de marginalidad o jefatura de hogar.';
      }
      const sePresentaRecurso = String(registro?.['Se presenta recurso'] ?? '').trim();
      if (sePresentaRecurso === 'No') return 'Caso cerrado: no se presenta recurso.';
      const sentidoResuelveRecurso = String(registro?.['Sentido de la decisiÃ³n que resuelve recurso'] ?? '').trim();
      if (sentidoResuelveRecurso) {
        return `Caso cerrado: decisión que resuelve recurso = ${sentidoResuelveRecurso}.`;
      }
    }

    if (auroraActivo && !actuacionIncluyeUtilidadPublica) {
      const sePresentaRecurso = String(registro?.['Se presenta recurso'] ?? '').trim();
      if (sePresentaRecurso === 'No') return 'Caso cerrado: no se presenta recurso.';
      const sentidoResuelveSolicitud = String(
        registro?.['Sentido de la decisiÃ³n que resuelve la solicitud'] ?? ''
      ).trim();
      if (sentidoResuelveSolicitud) {
        return `Caso cerrado: decisión que resuelve la solicitud = ${sentidoResuelveSolicitud}.`;
      }
    }

    return '';
  }, [
    registro,
    actuacionIncluyeUtilidadPublica,
    cierreRegla1Bloque3,
    decisionUsuarioBloquea,
    actuacionBloqueaPorNinguna,
    auroraActivo,
    cierrePorDecisionFinalBloque5,
    cierreImposibilidadTramite,
    cierreImposibilidadUtilidad,
    sentidoDecisionBloque5,
    decisionUsuario,
    actuacionAdelantar,
  ]);

  const bloqueCierre = useMemo(() => {
    if (!registro) return '';
    if (auroraActivo && cierrePorDecisionFinalBloque5) return 'bloque5';
    if (auroraActivo && decisionUsuarioBloquea) return 'bloque4';
    if (auroraActivo && actuacionBloqueaPorNinguna) return 'bloque4';
    if (auroraActivo && cierreRegla1Bloque3) return 'bloque3';

    const cumpleMarginalidad = String(registro?.['Cumple el requisito de marginalidad'] ?? '').trim();
    const cumpleJefatura = String(registro?.['Cumple el requisito de jefatura de hogar'] ?? '').trim();
    if (auroraActivo && actuacionIncluyeUtilidadPublica) {
      if (cumpleMarginalidad === 'No' || cumpleJefatura === 'No') return 'bloque5';
      const sePresentaRecurso = String(registro?.['Se presenta recurso'] ?? '').trim();
      if (sePresentaRecurso === 'No') return 'bloque5';
      const sentidoResuelveRecurso = String(registro?.['Sentido de la decisiÃ³n que resuelve recurso'] ?? '').trim();
      if (sentidoResuelveRecurso) return 'bloque5';
    }

    if (auroraActivo && !actuacionIncluyeUtilidadPublica) {
      const sePresentaRecurso = String(registro?.['Se presenta recurso'] ?? '').trim();
      if (sePresentaRecurso === 'No') return 'bloque5';
      const sentidoResuelveSolicitud = String(
        registro?.['Sentido de la decisiÃ³n que resuelve la solicitud'] ?? ''
      ).trim();
      if (sentidoResuelveSolicitud) return 'bloque5';
    }

    return '';
  }, [
    registro,
    actuacionIncluyeUtilidadPublica,
    cierreRegla1Bloque3,
    decisionUsuarioBloquea,
    actuacionBloqueaPorNinguna,
    auroraActivo,
    cierrePorDecisionFinalBloque5,
  ]);

  useEffect(() => {
    if (!registro) return;
    const next = casoCerrado ? 'Cerrado' : 'Activo';
    const current = String(registro['Estado del caso'] ?? '').trim();
    if (current === next) return;
    setRegistro((prev) => {
      if (!prev) return prev;
      const cur = String(prev['Estado del caso'] ?? '').trim();
      if (cur === next) return prev;
      return wrapRegistroForLookup({ ...unwrapRegistro(prev), 'Estado del caso': next });
    });
  }, [registro, casoCerrado]);

  useEffect(() => {
    if (!registro || !auroraActivo || !cierrePorDecisionFinalBloque5) return;
    const doc = getDocumentoActual(registro);
    if (!doc) return;
    const estadoActual = String(registro['Estado del caso'] ?? '').trim();
    if (estadoActual === 'Cerrado') return;

    const persistirCierreAutomatico = async () => {
      try {
        const nextRecord = { ...unwrapRegistro(registro), 'Estado del caso': 'Cerrado' };
        await updatePpl(doc, buildUpdatePayload(nextRecord));
        setRegistro(wrapRegistroForLookup(nextRecord));
        setToastMessage('Caso cerrado y avances guardados autom\u00E1ticamente');
        setToastOpen(true);
        setGuardadoOk(true);
        setHistorialRefreshToken((prev) => prev + 1);
      } catch (e) {
        reportError(e, 'formulario-entrevista:cierre-automatico');
        setError('Se intent\u00F3 guardar el cierre autom\u00E1tico, pero ocurri\u00F3 un error.');
      }
    };

    persistirCierreAutomatico();
  }, [registro, auroraActivo, cierrePorDecisionFinalBloque5, getDocumentoActual, buildUpdatePayload]);

  useEffect(() => {
    if (!registro || !auroraActivo) return;
    const next = String(auroraRuleState?.derivedStatus || '').trim();
    if (!next) return;
    const current = String(registro['Estado del trÃ¡mite'] ?? '').trim();
    if (current === next) return;
    setRegistro((prev) => {
      if (!prev) return prev;
      const cur = String(prev['Estado del trÃ¡mite'] ?? '').trim();
      if (cur === next) return prev;
      return wrapRegistroForLookup({ ...unwrapRegistro(prev), 'Estado del trÃ¡mite': next });
    });
  }, [registro, auroraActivo, auroraRuleState]);

  useEffect(() => {
    if (!registro || !auroraActivo) return;
    if (!auroraRuleState?.locked) return;
    const reason = String(auroraRuleState.lockReason || 'El formulario est? bloqueado por reglas de negocio.');
    setError(reason);
  }, [registro, auroraActivo, auroraRuleState]);

  useEffect(() => {
    if (!registro || flow !== 'sindicado') return;
    if (!celesteRuleState?.locked) return;
    const reason = String(celesteRuleState.lockReason || 'Se cierra el caso');
    setError(reason);
  }, [registro, flow, celesteRuleState]);

  useEffect(() => {
    // REGLA: P35 solo se habilita si P34 = "SÃ­". Si no, queda deshabilitada y vacÃ­a.
    if (habilitarPregunta35) return;
    setRegistro((prev) => {
      if (!prev) return prev;
      const currentLegacy = String(prev[KEY_Q35_LEGACY] ?? '');
      const currentUtf8 = String(prev[KEY_Q35_UTF8] ?? '');
      if (currentLegacy === '' && currentUtf8 === '') return prev;
      return wrapRegistroForLookup({ ...unwrapRegistro(prev), [KEY_Q35_LEGACY]: '', [KEY_Q35_UTF8]: '' });
    });
  }, [habilitarPregunta35]);

  const habilitarNegativaUtilidadPublica = useMemo(() => {
    const sentido = String(registro?.['Sentido de la decisiÃ³n'] ?? '').trim();
    const sentidoResuelve = String(registro?.['Sentido de la decisiÃ³n que resuelve recurso'] ?? '').trim();
    return sentido === 'Niega utilidad pÃºblica' || sentidoResuelve === 'Niega utilidad pÃºblica';
  }, [registro]);

  const habilitarNegativaTramiteNormal = useMemo(() => {
    if (!auroraActivo) return false;
    if (actuacionIncluyeUtilidadPublica) return false;
    const sentido = String(registro?.['Sentido de la decisiÃ³n'] ?? '').trim();
    return isNoConcedeSubrogadoPenal(sentido);
  }, [auroraActivo, actuacionIncluyeUtilidadPublica, registro]);

  useEffect(() => {
    // Regla: AURORA.B5A.LIMPIEZA.1
    // Si no aplica negativa de utilidad publica, limpiar campos de motivo/recurso en 5A.
    if (!registro) return;
    if (habilitarNegativaUtilidadPublica) return;

    const keys = ['Motivo de la decisiÃ³n negativa', 'Se presenta recurso', 'Fecha de recurso en caso desfavorable'];
    setRegistro((prev) => {
      if (!prev) return prev;
      let changed = false;
      const next = { ...unwrapRegistro(prev) };
      for (const k of keys) {
        const cur = String(prev[k] ?? '');
        if (cur === '') continue;
        next[k] = '';
        changed = true;
      }
      return changed ? wrapRegistroForLookup(next) : prev;
    });
  }, [registro, habilitarNegativaUtilidadPublica]);

  useEffect(() => {
    // Regla: AURORA.B5B.DEPENDENCIA.4
    // Si en tramite normal Q47 != "No concede subrogado penal", limpiar motivo y campos de recurso.
    if (!registro || !auroraActivo || actuacionIncluyeUtilidadPublica) return;
    if (habilitarNegativaTramiteNormal) return;

    const keys = [
      'Motivo de la decisiÃ³n negativa',
      'Se presenta recurso',
      'Fecha de recurso en caso desfavorable',
      'Sentido de la decisiÃ³n que resuelve la solicitud',
    ];

    setRegistro((prev) => {
      if (!prev) return prev;
      let changed = false;
      const next = { ...unwrapRegistro(prev) };
      for (const k of keys) {
        const cur = String(prev[k] ?? '');
        if (cur === '') continue;
        next[k] = '';
        changed = true;
      }
      return changed ? wrapRegistroForLookup(next) : prev;
    });
  }, [registro, auroraActivo, actuacionIncluyeUtilidadPublica, habilitarNegativaTramiteNormal]);

  useEffect(() => {
    // Regla: AURORA.B5B.DEPENDENCIA.1
    // Si no hay recurso en 5B, limpiar fecha y sentido que resuelve la solicitud.
    if (!registro || !auroraActivo || actuacionIncluyeUtilidadPublica) return;
    if (!habilitarNegativaTramiteNormal) return;
    if (isEquivalenteSi(registro?.['Se presenta recurso'])) return;

    const keys = ['Fecha de recurso en caso desfavorable', 'Sentido de la decisiÃ³n que resuelve la solicitud'];
    setRegistro((prev) => {
      if (!prev) return prev;
      let changed = false;
      const next = { ...unwrapRegistro(prev) };
      for (const k of keys) {
        const cur = String(prev[k] ?? '');
        if (cur === '') continue;
        next[k] = '';
        changed = true;
      }
      return changed ? wrapRegistroForLookup(next) : prev;
    });
  }, [registro, auroraActivo, actuacionIncluyeUtilidadPublica, habilitarNegativaTramiteNormal]);

  const habilitarCelesteMotivoNegativa = useMemo(() => {
    const sentido = String(registro?.['SENTIDO DE LA DECISIÃ“N'] ?? '').trim();
    return norm(sentido) === norm('Niega la solicitud');
  }, [registro]);

  const habilitarCelesteRecurso = useMemo(() => {
    const v = String(registro?.['Â¿SE RECURRIÃ“ EN CASO DE DECISIÃ“N NEGATIVA?'] ?? '').trim();
    return isEquivalenteSi(v);
  }, [registro]);

  useEffect(() => {
    // Regla: CELESTE.B5.DEPENDENCIA.3
    // Si C_Q26 != "Niega la solicitud", limpiar motivo de decision negativa.
    if (!registro || flow !== 'sindicado') return;
    if (habilitarCelesteMotivoNegativa) return;

    const key = 'MOTIVO DE LA DECISIÃ“N NEGATIVA';
    setRegistro((prev) => {
      if (!prev) return prev;
      const cur = String(prev[key] ?? '');
      if (cur === '') return prev;
      return wrapRegistroForLookup({ ...unwrapRegistro(prev), [key]: '' });
    });
  }, [registro, flow, habilitarCelesteMotivoNegativa]);

  useEffect(() => {
    // Regla: CELESTE.B5.LIMPIEZA.1
    // Si no se presenta recurso, limpiar fecha y sentido de recurso.
    if (!registro) return;
    if (habilitarCelesteRecurso) return;
    setRegistro((prev) => {
      if (!prev) return prev;
      const keys = ['Fecha de presentaciÃ³n del recurso', 'SENTIDO DE LA DECISIÃ“N QUE RESUELVE RECURSO'];
      let changed = false;
      const next = { ...unwrapRegistro(prev) };
      for (const k of keys) {
        const cur = String(prev[k] ?? '');
        if (cur === '') continue;
        next[k] = '';
        changed = true;
      }
      return changed ? wrapRegistroForLookup(next) : prev;
    });
  }, [registro, habilitarCelesteRecurso]);

  async function handleGuardar() {
    const doc = getDocumentoActual(registro);
    if (!doc) {
      setError('Debe cargar un usuario antes de guardar.');
      return;
    }

    try {
      setError('');
      setToastOpen(false);
      const payloadBase = { ...unwrapRegistro(registro) };
      if (auroraActivo) {
        payloadBase['Estado del caso'] = casoCerrado ? 'Cerrado' : 'Activo';
      }
      const updated = await updatePpl(doc, buildUpdatePayload(payloadBase));
      const nextTipo = String(updated?.tipo ?? tipoRegistro ?? '').trim();
      if (nextTipo) setTipoRegistro(nextTipo);
      if (bloque4IncompletoParaAlertaGuardado) {
        window.alert('Antes de guardar, por favor complete los campos obligatorios del bloque 4.');
      } else {
        setToastMessage('Aurora - Cambios guardados correctamente');
        setToastOpen(true);
      }
      setGuardadoOk(true);
      setHistorialRefreshToken((prev) => prev + 1);
    } catch (e) {
      reportError(e, 'formulario-entrevista:guardar');
      setError('Error al guardar el registro.');
    }
  }

  const handleSaltoCelesteAAurora = useCallback(async (nextSituacionActualizada) => {
    const celesteEval = evaluateCelesteRules({
      answers: {
        ...(registro || {}),
        'SituaciÃ³n JurÃ­dica actualizada (de conformidad con la rama judicial)': nextSituacionActualizada,
      },
    });
    if (!celesteEval.jumpToAurora) return;

    const doc = getDocumentoActual(registro);
    if (!doc) {
      setError('Debe cargar un usuario antes de guardar.');
      return;
    }

    const yaRedirigido = String(registro?.redirectedToAurora ?? '').trim().toLowerCase() === 'true';
    if (yaRedirigido) {
      // Evita bucle de redirecciÃ³n: no vuelve a guardar/redirigir. Solo navega a AURORA (BLOQUE 2).
      setTipoRegistro('condenado');
      setRegistro((prev) => ({
        ...(prev || {}),
        __tipoApi: 'condenado',
        redirectedToAurora: true,
        'SituaciÃ³n JurÃ­dica': 'Condenado',
        'SituaciÃ³n JurÃ­dica actualizada (de conformidad con la rama judicial)': 'CONDENADO',
      }));
      setAuroraAbrirBloque2(celesteEval.jumpPayload?.startBlock === 2);
      return;
    }

    if (saltoCelesteGuardando) return;

    const next = {
      ...(registro || {}),
      'SituaciÃ³n JurÃ­dica actualizada (de conformidad con la rama judicial)': 'CONDENADO',
      redirectedToAurora: true,
    };

    setSaltoCelesteGuardando(true);
    setError('');
    setToastOpen(false);

    try {
      await updatePpl(doc, buildUpdatePayload(next));
      setToastMessage('Formulario guardado');
      setToastOpen(true);

      // Redirigir/navegar a AURORA del mismo usuario y abrir Bloque 2 como siguiente paso.
      const refreshed = await getPplByDocumento(doc);
      const r = refreshed?.registro || next;
      const refreshedTipo = String(refreshed?.tipo ?? 'condenado').trim() || 'condenado';
      setTipoRegistro('condenado');

      setRegistro({
        ...(r || next),
        __tipoApi: refreshedTipo,
        // Fuerza el flujo AURORA por regla de salto (sin reiniciar caso).
        redirectedToAurora: true,
        'SituaciÃ³n JurÃ­dica': 'Condenado',
        'SituaciÃ³n JurÃ­dica actualizada (de conformidad con la rama judicial)': 'CONDENADO',
      });
      setAuroraAbrirBloque2(celesteEval.jumpPayload?.startBlock === 2);
    } catch (e) {
      reportError(e, 'formulario-entrevista:salto-celeste-aurora');
      setError('Error al guardar el formulario. No se redirigiÃ³ a AURORA.');
    } finally {
      setSaltoCelesteGuardando(false);
    }
  }, [buildUpdatePayload, getDocumentoActual, registro, saltoCelesteGuardando]);

  useEffect(() => {
    if (!auroraAbrirBloque2) return;
    if (flow !== 'condenado') return;
    const el = bloque2AuroraRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setAuroraAbrirBloque2(false);
  }, [auroraAbrirBloque2, flow]);

  useEffect(() => {
    if (!registro) return;
    if (flow !== 'sindicado') return;
    if (!celesteRuleState?.jumpToAurora) return;
    const value =
      registro?.['SituaciÃ³n JurÃ­dica actualizada (de conformidad con la rama judicial)'] ??
      '';
    handleSaltoCelesteAAurora(String(value));
  }, [registro, flow, celesteRuleState?.jumpToAurora, handleSaltoCelesteAAurora]);

  const porcentajeAvancePena = parsePercentageValue(registro?.['Porcentaje de avance de pena cumplida']);
  const porcentajeAvancePenaBarra =
    porcentajeAvancePena == null ? null : Math.max(0, Math.min(100, porcentajeAvancePena));

  useEffect(() => {
    if (!registro) return;
    const field = 'Porcentaje de avance de pena cumplida';
    const currentRaw = String(registro?.[field] ?? '').trim();
    if (!currentRaw) return;
    const normalized = normalizePercentageStorageValue(currentRaw);
    if (!normalized || normalized === currentRaw) return;

    setRegistro((prev) => {
      if (!prev) return prev;
      const cur = String(prev[field] ?? '').trim();
      if (!cur || cur === normalized) return prev;
      return wrapRegistroForLookup({ ...unwrapRegistro(prev), [field]: normalized });
    });
  }, [registro]);

  return (
    <>
      <div className="card">
        <h2>Buscar Usuario</h2>

        <Toast
          open={toastOpen}
          message={displayText(toastMessage)}
          durationMs={3000}
          placement="center"
          emphasis
          onClose={() => setToastOpen(false)}
        />

        <div className="search-row search-row--form-main">
          <div className="form-field">
            <label>Numero de Identificacion</label>
            <input
              type="text"
              placeholder="Ingrese Documento"
              value={numeroBusqueda}
              onChange={(e) => setNumeroBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  buscarRegistro(numeroBusqueda);
                }
              }}
            />
          </div>
          <button
            className="primary-button primary-button--search"
            type="button"
            onClick={() => buscarRegistro(numeroBusqueda)}
          >
            CONSULTAR PPL
          </button>
        </div>

        {cargando && <p>{displayText('Cargando informaciÃ³n...')}</p>}
        {error && <p className="hint-text">{displayText(error)}</p>}
      </div>

      {!cargando && registro && (
        <>
          <div className="card" style={{ marginTop: '1rem' }}>
            <HistorialActuacionesPPL
              registro={registro}
              numeroDocumento={getDocumentoActual(registro)}
              onSelectActuacion={handleSeleccionarActuacion}
              onCrearNuevaActuacion={handleCrearNuevaActuacion}
              onIniciarActuacion={() => handleCrearNuevaActuacion({ abrirFormulario: true })}
              refreshToken={historialRefreshToken}
              actuacionActivaId={actuacionActivaId}
              creandoActuacion={creandoActuacion}
              onActionLabelChange={handleActionLabelChange}
            />
          </div>

          {!mostrarFormularioDetalle && (
            <p className="hint-text" style={{ marginTop: '0.75rem' }}>
              {displayText(`Vista previa activa. Seleccione "${textoAccionCaso}" para abrir el formulario precargado.`)}
            </p>
          )}

          {mostrarFormularioDetalle && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3 className="block-title">{displayText('BLOQUE 1. InformaciÃ³n de la persona privada de la libertad')}</h3>

          <div className="grid-2">
            <Campo label="1. Nombre" name="Nombre" value={registro['Nombre']} onChange={handleChange} />

            <Campo
              label="2. Tipo de indentificaciÃ³n"
              name="Tipo de indentificaciÃ³n"
              type="select"
              value={registro['Tipo de indentificaciÃ³n']}
              onChange={handleChange}
              options={OPCIONES_TIPO_IDENTIFICACION}
            />

            <Campo
              label="3. NÃºmero de identificaciÃ³n"
              name="NÃºmero de identificaciÃ³n"
              value={registro['NÃºmero de identificaciÃ³n']}
              onChange={handleChange}
              readOnly={Boolean(String(registro['NÃºmero de identificaciÃ³n'] ?? '').trim())}
            />

            <Campo
              label="4. SituaciÃ³n JurÃ­dica"
              name="SituaciÃ³n JurÃ­dica"
              type="select"
              value={registro['SituaciÃ³n JurÃ­dica']}
              onChange={handleChange}
              options={OPCIONES_SITUACION_JURIDICA}
              disabled
            />

            <Campo
              label="5. GÃ©nero"
              name="GÃ©nero"
              type="select"
              value={registro['GÃ©nero']}
              onChange={handleChange}
              options={OPCIONES_GENERO_AURORA}
            />

            <Campo
              label="6. Enfoque Ã‰tnico/Racial/Cultural"
              name="Enfoque Ã‰tnico/Racial/Cultural"
              type="select"
              value={registro['Enfoque Ã‰tnico/Racial/Cultural']}
              onChange={handleChange}
              options={OPCIONES_ENFOQUE_ETNICO}
            />

            <Campo
              label="7. Nacionalidad"
              name="Nacionalidad"
              value={registro['Nacionalidad']}
              onChange={handleChange}
            />

            <Campo
              label="8. Fecha de nacimiento"
              name="Fecha de nacimiento"
              type="date"
              value={registro['Fecha de nacimiento']}
              onChange={handleChange}
            />

            <Campo label="9. Edad" name="Edad" type="number" value={registro['Edad']} onChange={handleChange} />

            <Campo
              label="10. Lugar de privaciÃ³n de la libertad"
              name="Lugar de privaciÃ³n de la libertad"
              type="select"
              value={registro['Lugar de privaciÃ³n de la libertad']}
              onChange={handleChange}
              options={OPCIONES_LUGAR_PRIVACION}
            />

            <Campo
              label="11. Nombre del lugar de privaciÃ³n de la libertad"
              name="Nombre del lugar de privaciÃ³n de la libertad"
              value={registro['Nombre del lugar de privaciÃ³n de la libertad']}
              onChange={handleChange}
            />

            <Campo
              label="12. Departamento del lugar de privaciÃ³n de la libertad"
              name="Departamento del lugar de privaciÃ³n de la libertad"
              value={registro['Departamento del lugar de privaciÃ³n de la libertad']}
              onChange={handleChange}
            />

            <Campo
              label="13. Distrito/municipio del lugar de privaciÃ³n de la libertad"
              name="Distrito/municipio del lugar de privaciÃ³n de la libertad"
              value={registro['Distrito/municipio del lugar de privaciÃ³n de la libertad']}
              onChange={handleChange}
            />
          </div>

          {flow === 'condenado' && (
            <>
              <fieldset
                disabled={Boolean(auroraRuleState?.locked)}
                style={{ border: 'none', margin: 0, padding: 0, minInlineSize: 0 }}
              >
              {auroraVisibleBlocks.has('bloque2Aurora') && (
                <>
                <h3 className="block-title" ref={bloque2AuroraRef}>
                  {displayText('BLOQUE 2 (AURORA) - InformaciÃ³n del proceso SISIPEC')}
                </h3>
                <div className="grid-2">
                <Campo
                  label="14. Autoridad a cargo"
                  name="Autoridad a cargo"
                  value={registro['Autoridad a cargo']}
                  onChange={handleChange}
                />
                <Campo
                  label="15. NÃºmero de proceso"
                  name="NÃºmero de proceso"
                  value={registro['NÃºmero de proceso']}
                  onChange={handleChange}
                />
                <Campo
                  label="16. Delitos"
                  name="Delitos"
                  type="textarea"
                  value={registro['Delitos']}
                  onChange={handleChange}
                />
                <Campo
                  label="17. Fecha de captura"
                  name="Fecha de captura"
                  type="date"
                  value={registro['Fecha de captura']}
                  onChange={handleChange}
                />
                <Campo
                  label="18. Pena (aÃ±os, meses y dÃ­as)"
                  name="Pena (aÃ±os, meses y dÃ­as)"
                  value={registro['Pena (aÃ±os, meses y dÃ­as)']}
                  onChange={handleChange}
                />
                <Campo
                  label="19. Pena total en dÃ­as"
                  name="Pena total en dÃ­as"
                  type="number"
                  value={registro['Pena total en dÃ­as']}
                  onChange={handleChange}
                />
                <Campo
                  label="20. Tiempo que la persona lleva privada de la libertad (en dÃ­as)"
                  name="Tiempo que la persona lleva privada de la libertad (en dÃ­as)"
                  type="number"
                  value={registro['Tiempo que la persona lleva privada de la libertad (en dÃ­as)']}
                  onChange={handleChange}
                />
                <Campo
                  label="21. RedenciÃ³n total acumulada en dÃ­as"
                  name="RedenciÃ³n total acumulada en dÃ­as"
                  type="number"
                  value={registro['RedenciÃ³n total acumulada en dÃ­as']}
                  onChange={handleChange}
                />
                <Campo
                  label="22. Tiempo efectivo de pena cumplida en dÃ­as (teniendo en cuenta la redenciÃ³n)"
                  name="Tiempo efectivo de pena cumplida en dÃ­as (teniendo en cuenta la redenciÃ³n)"
                  type="number"
                  value={registro['Tiempo efectivo de pena cumplida en dÃ­as (teniendo en cuenta la redenciÃ³n)']}
                  onChange={handleChange}
                />
                <div className="form-field">
                  <label>{displayText('23. Porcentaje de avance de pena cumplida')}</label>
                  <input
                    type="text"
                    name="Porcentaje de avance de pena cumplida"
                    value={formatPercentageDisplayValue(registro['Porcentaje de avance de pena cumplida'] ?? '')}
                    onChange={(e) =>
                      handleChange(
                        'Porcentaje de avance de pena cumplida',
                        normalizePercentageStorageValue(e.target.value)
                      )
                    }
                  />
                  {porcentajeAvancePenaBarra != null && (
                    <div className="progress-wrap progress-wrap--q23" aria-label="Barra de avance de pena cumplida">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${porcentajeAvancePenaBarra}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <Campo
                  label="24. Fase de tramiento"
                  name="Fase de tramiento"
                  type="select"
                  value={registro['Fase de tramiento']}
                  onChange={handleChange}
                  options={OPCIONES_FASE_TRATAMIENTO}
                />
                <Campo
                  label="25. Â¿Cuenta con requerimientos judiciales por otros procesos?"
                  name="Â¿ Cuenta con requerimientos judiciales por otros procesos ?"
                  type="select"
                  value={registro['Â¿ Cuenta con requerimientos judiciales por otros procesos ?']}
                  onChange={handleChange}
                  options={OPCIONES_SI_NO}
                />
                <div className="form-field calificacion-resumen-field">
                  <label>{displayText('26 y 27. Resumen de calificaciones de conducta (últimas 2)')}</label>
                  <div className="calificacion-resumen-table-wrap">
                    <table className="calificacion-resumen-table">
                      <thead>
                        <tr>
                          <th>{displayText('Registro')}</th>
                          <th>{displayText('26. Fecha ?ltima calificaciÃ³n')}</th>
                          <th>{displayText('26A. NÃºmero de acta')}</th>
                          <th>{displayText('26B. EvaluaciÃ³n desde')}</th>
                          <th>{displayText('26C. EvaluaciÃ³n hasta')}</th>
                          <th>{displayText('27. CalificaciÃ³n de conducta')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calificacionesCompactas.map((item) => (
                          <tr key={item.id}>
                            <td className="calificacion-resumen-row-label">{displayText(item.label)}</td>
                            <td>
                              {item.editable ? (
                                <input
                                  type="date"
                                  name={KEY_FECHA_ULTIMA_CALIFICACION}
                                  value={toDateInputValue(item.fechaUltimaCalificacion)}
                                  onChange={(e) => handleChange(KEY_FECHA_ULTIMA_CALIFICACION, e.target.value)}
                                  required
                                />
                              ) : (
                                <span>{formatCalificacionDate(item.fechaUltimaCalificacion)}</span>
                              )}
                            </td>
                            <td>
                              {item.editable ? (
                                <input
                                  type="text"
                                  name={KEY_ACTA_CALIFICACION}
                                  value={item.numeroActa ?? ''}
                                  onChange={(e) => handleChange(KEY_ACTA_CALIFICACION, e.target.value)}
                                />
                              ) : (
                                <span>{String(item.numeroActa ?? '').trim() || '\u2014'}</span>
                              )}
                            </td>
                            <td>
                              {item.editable ? (
                                <input
                                  type="date"
                                  name={KEY_EVALUACION_DESDE}
                                  value={toDateInputValue(item.evaluacionDesde)}
                                  onChange={(e) => handleChange(KEY_EVALUACION_DESDE, e.target.value)}
                                />
                              ) : (
                                <span>{formatCalificacionDate(item.evaluacionDesde)}</span>
                              )}
                            </td>
                            <td>
                              {item.editable ? (
                                <input
                                  type="date"
                                  name={KEY_EVALUACION_HASTA}
                                  value={toDateInputValue(item.evaluacionHasta)}
                                  onChange={(e) => handleChange(KEY_EVALUACION_HASTA, e.target.value)}
                                />
                              ) : (
                                <span>{formatCalificacionDate(item.evaluacionHasta)}</span>
                              )}
                            </td>
                            <td>
                              {item.editable ? (
                                <select
                                  name={KEY_CALIFICACION_CONDUCTA}
                                  value={item.calificacionConducta ?? ''}
                                  onChange={(e) => handleChange(KEY_CALIFICACION_CONDUCTA, e.target.value)}
                                  required
                                >
                                  <option value="" disabled hidden />
                                  {OPCIONES_CALIFICACION_CONDUCTA.map((option) => (
                                    <option key={option} value={option}>
                                      {displayText(option)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span>{displayText(String(item.calificacionConducta ?? '').trim() || '\u2014')}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
                </>
              )}

              {auroraVisibleBlocks.has('bloque3') && (
                <>
                <h3 className="block-title">{displayText('BLOQUE 3 - AnÃ¡lisis jurÃ­dico')}</h3>
                <div className="grid-2">
                <Campo
                  label="28. Defensor(a) pÃºblico(a) asignado para tramitar la solicitud"
                  name="Defensor(a) PÃºblico(a) Asignado para tramitar la solicitud"
                  type="datalist"
                  value={getDefensorAsignadoValue(registro)}
                  onChange={handleChange}
                  options={opcionesDefensores}
                  showObligatoria
                />

                <Campo
                  label="29. Fecha de anÃ¡lisis jurÃ­dico del caso"
                  name="Fecha de anÃ¡lisis jurÃ­dico del caso"
                  type="date"
                  value={registro['Fecha de anÃ¡lisis jurÃ­dico del caso']}
                  onChange={handleChange}
                  showObligatoria
                />

                <Campo
                  label="30. Procedencia de libertad condicional"
                  name="Procedencia de libertad condicional"
                  type="select"
                  value={registro['Procedencia de libertad condicional']}
                  onChange={handleChange}
                  options={OPCIONES_PROCEDENCIA_LIBERTAD_CONDICIONAL}
                  showObligatoria
                />

                <Campo
                  label="31. Procedencia de prisiÃ³n domiciliaria de mitad de pena"
                  name="Procedencia de prisiÃ³n domiciliaria de mitad de pena"
                  type="select"
                  value={registro['Procedencia de prisiÃ³n domiciliaria de mitad de pena']}
                  onChange={handleChange}
                  options={OPCIONES_PROCEDENCIA_PRISION_DOMICILIARIA}
                  showObligatoria
                />

                <Campo
                  label="32. Procedencia de utilidad pÃºblica (solo para mujeres)"
                  name="Procedencia de utilidad pÃºblica (solo para mujeres)"
                  type="select"
                  value={registro['Procedencia de utilidad pÃºblica (solo para mujeres)']}
                  onChange={handleChange}
                  options={OPCIONES_PROCEDENCIA_UTILIDAD_PUBLICA}
                  required={false}
                />

                <Campo
                  label="33. Procedencia de pena cumplida"
                  name="Procedencia de pena cumplida"
                  type="select"
                  value={registro['Procedencia de pena cumplida']}
                  onChange={handleChange}
                  options={OPCIONES_SI_NO}
                  showObligatoria
                />

                <Campo
                  label="34. Procedencia de acumulaciÃ³n de penas"
                  name="Procedencia de acumulaciÃ³n de penas"
                  type="select"
                  value={registro['Procedencia de acumulaciÃ³n de penas']}
                  onChange={handleChange}
                  options={OPCIONES_SI_NO}
                  showObligatoria
                />

                <Campo
                  label="35. Con quÃ© proceso(s) debe acumular penas (si aplica)"
                  name={KEY_Q35_LEGACY}
                  value={registro[KEY_Q35_LEGACY] ?? registro[KEY_Q35_UTF8] ?? ''}
                  onChange={handleChange}
                  required={false}
                  disabled={!habilitarPregunta35}
                  showObligatoria
                />

                <Campo
                  label="36. Otras solicitudes a tramitar"
                  name="Otras solicitudes a tramitar"
                  type="select"
                  value={registro['Otras solicitudes a tramitar']}
                  onChange={handleChange}
                  options={OPCIONES_OTRAS_SOLICITUDES}
                />

                <Campo
                  label="37. Resumen del anÃ¡lisis del caso"
                  name="Resumen del anÃ¡lisis del caso"
                  type="textarea"
                  value={registro['Resumen del anÃ¡lisis del caso']}
                  onChange={handleChange}
                  showObligatoria
                />

                {bloqueCierre === 'bloque3' && motivoCierre && (
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <p className="hint-text">{displayText(motivoCierre)}</p>
                  </div>
                )}
                {mensajeBloqueoAvanceBloque3 && (
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <p className="hint-text">{displayText(mensajeBloqueoAvanceBloque3)}</p>
                  </div>
                )}
              </div>
                </>
              )}

              {auroraVisibleBlocks.has('bloque4') && (
                <>
                <h3 className="block-title">{displayText('BLOQUE 4 - Entrevista con el usuario')}</h3>
                <div className="grid-2">
                <Campo
                  label="38. Fecha de la entrevista"
                  name="Fecha de entrevista"
                  type="date"
                  value={registro['Fecha de entrevista']}
                  onChange={handleChange}
                  disabled={cierreRegla1Bloque3}
                  showObligatoria
                />

                <Campo
                  label="39. DecisiÃ³n del usuario"
                  name="DecisiÃ³n del usuario"
                  type="select"
                  value={registro['DecisiÃ³n del usuario']}
                  onChange={handleChange}
                  options={OPCIONES_AURORA_DECISION_USUARIO}
                  disabled={cierreRegla1Bloque3}
                  showObligatoria
                />

                <div className="question-40-highlight">
                <Campo
                  label="40. ActuaciÃ³n a adelantar"
                  name="ActuaciÃ³n a adelantar"
                  type="select"
                  value={registro['ActuaciÃ³n a adelantar']}
                  onChange={handleChange}
                  options={OPCIONES_AURORA_ACTUACION_A_ADELANTAR}
                  disabled={cierreRegla1Bloque3 || decisionUsuarioBloquea}
                  showObligatoria
                />
                {cierreRegla1Bloque3 && (
                  <p className="hint-text">
                    La pregunta 40 esta bloqueada porque el caso se cerro en Bloque 3 (preguntas 30 a 33 sin procedencia).
                  </p>
                )}
                </div>

                <Campo
                  label="41. Requiere pruebas"
                  name="Requiere pruebas"
                  type="select"
                  value={registro['Requiere pruebas']}
                  onChange={handleChange}
                  options={OPCIONES_SI_NO}
                  disabled={cierreRegla1Bloque3 || decisionUsuarioBloquea || actuacionBloqueaPorNinguna}
                  showObligatoria
                />

                <Campo
                  label="42. Poder en caso de avanzar con la solicitud"
                  name="Poder en caso de avanzar con la solicitud"
                  type="select"
                  value={registro['Poder en caso de avanzar con la solicitud']}
                  onChange={handleChange}
                  options={OPCIONES_PODER}
                  disabled={cierreRegla1Bloque3 || decisionUsuarioBloquea || actuacionBloqueaPorNinguna}
                  showObligatoria
                />

                {decisionUsuarioBloquea && (
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <p className="hint-text">
                      {displayText('El resto del formulario estÃ¡ bloqueado por la selecciÃ³n en "DecisiÃ³n del usuario".')}
                    </p>
                  </div>
                )}
                {bloqueCierre === 'bloque4' && motivoCierre && (
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <p className="hint-text">{displayText(motivoCierre)}</p>
                  </div>
                )}
              </div>
                </>
              )}

              {auroraRuleState?.locked && (
                <div className="form-field" style={{ marginTop: '0.35rem' }}>
                  <p className="hint-text">{displayText(auroraRuleState.lockReason || 'Formulario bloqueado por reglas de negocio.')}</p>
                </div>
              )}

              {(
                auroraVisibleBlocks.has('bloque5UtilidadPublica') ||
                auroraVisibleBlocks.has('bloque5TramiteNormal')
              ) ? (() => {
                const show5A = auroraVisibleBlocks.has('bloque5UtilidadPublica');
                const show5B = auroraVisibleBlocks.has('bloque5TramiteNormal');

                const bloquearBloque5 = cierreRegla1Bloque3 || decisionUsuarioBloquea || actuacionBloqueaPorNinguna;

                const requiereMisionTrabajo = String(registro?.['Se requiere misiÃ³n de trabajo'] ?? '').trim();
                const deshabilitarMision = requiereMisionTrabajo === 'No';

                return (
                  <>
                    {show5A && (
                      <>
                        <h3 className="block-title">{displayText('BLOQUE 5. Utilidad pÃºblica')}</h3>
                        <div className="grid-2">
                          <Campo
                            label="43. Fecha de entrevista psicosocial"
                            name="Fecha de entrevista psicosocial"
                            type="date"
                            value={registro['Fecha de entrevista psicosocial']}
                            onChange={handleChange}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="44. Cumple el requisito de marginalidad"
                            name="Cumple el requisito de marginalidad"
                            type="select"
                            value={registro['Cumple el requisito de marginalidad']}
                            onChange={handleChange}
                            options={OPCIONES_SI_NO}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="45. Cumple el requisito de jefatura de hogar"
                            name="Cumple el requisito de jefatura de hogar"
                            type="select"
                            value={registro['Cumple el requisito de jefatura de hogar']}
                            onChange={handleChange}
                            options={OPCIONES_SI_NO}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="46. Se requiere misiÃ³n de trabajo"
                            name="Se requiere misiÃ³n de trabajo"
                            type="select"
                            value={registro['Se requiere misiÃ³n de trabajo']}
                            onChange={handleChange}
                            options={OPCIONES_SI_NO}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="47. Fecha de solicitud de misiÃ³n de trabajo"
                            name="Fecha de solicitud de misiÃ³n de trabajo"
                            type="date"
                            value={registro['Fecha de solicitud de misiÃ³n de trabajo']}
                            onChange={handleChange}
                            required={false}
                            disabled={isAuroraFieldDisabled('Fecha de solicitud de misiÃ³n de trabajo', bloquearBloque5 || deshabilitarMision)}
                          />
                          <Campo
                            label="48. Fecha de asignaciÃ³n de investigador"
                            name="Fecha de asignaciÃ³n de investigador"
                            type="date"
                            value={registro['Fecha de asignaciÃ³n de investigador']}
                            onChange={handleChange}
                            required={false}
                            disabled={isAuroraFieldDisabled('Fecha de asignaciÃ³n de investigador', bloquearBloque5 || deshabilitarMision)}
                          />
                          <Campo
                            label="49. Fecha en la que se reciben todas las pruebas"
                            name="Fecha en la que se reciben todas las pruebas"
                            type="date"
                            value={registro['Fecha en la que se reciben todas las pruebas']}
                            onChange={handleChange}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="50. Fecha de radicaciÃ³n de solicitud de utilidad pÃºblica"
                            name="Fecha de radicaciÃ³n de solicitud de utilidad pÃºblica"
                            type="date"
                            value={registro['Fecha de radicaciÃ³n de solicitud de utilidad pÃºblica']}
                            onChange={handleChange}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="51. Fecha de decisiÃ³n de la autoridad"
                            name="Fecha de decisiÃ³n de la autoridad"
                            type="date"
                            value={registro['Fecha de decisiÃ³n de la autoridad']}
                            onChange={handleChange}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="52. Sentido de la decisiÃ³n"
                            name="Sentido de la decisiÃ³n"
                            type="select"
                            value={registro['Sentido de la decisiÃ³n']}
                            onChange={handleChange}
                            options={OPCIONES_BLOQUE_5A_SENTIDO_DECISION}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="53. Motivo de la decisiÃ³n negativa"
                            name="Motivo de la decisiÃ³n negativa"
                            type="select"
                            value={registro['Motivo de la decisiÃ³n negativa']}
                            onChange={handleChange}
                            options={OPCIONES_BLOQUE_5A_MOTIVO_DECISION_NEGATIVA}
                            required={false}
                            disabled={bloquearBloque5 || !habilitarNegativaUtilidadPublica}
                          />
                          <Campo
                            label="54. Se presenta recurso"
                            name="Se presenta recurso"
                            type="select"
                            value={registro['Se presenta recurso']}
                            onChange={handleChange}
                            options={OPCIONES_SI_NO}
                            required={false}
                            disabled={bloquearBloque5 || !habilitarNegativaUtilidadPublica}
                          />
                          <Campo
                            label="55. Fecha de recurso en caso desfavorable"
                            name="Fecha de recurso en caso desfavorable"
                            type="date"
                            value={registro['Fecha de recurso en caso desfavorable']}
                            onChange={handleChange}
                            required={false}
                            disabled={
                              bloquearBloque5 ||
                              !habilitarNegativaUtilidadPublica ||
                              !isEquivalenteSi(registro?.['Se presenta recurso'])
                            }
                          />
                          <Campo
                            label="56. Sentido de la decisiÃ³n que resuelve recurso"
                            name="Sentido de la decisiÃ³n que resuelve recurso"
                            type="select"
                            value={registro['Sentido de la decisiÃ³n que resuelve recurso']}
                            onChange={handleChange}
                            options={OPCIONES_BLOQUE_5A_SENTIDO_DECISION_RESUELVE_RECURSO}
                            required={false}
                            disabled={bloquearBloque5 || !isEquivalenteSi(registro?.['Se presenta recurso'])}
                          />
                          <Campo
                            label="57. Cierre del caso por imposibilidad de avanzar (si aplica)"
                            name="Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad pÃºblica"
                            type="select"
                            value={registro['Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad pÃºblica']}
                            onChange={handleChange}
                            options={OPCIONES_CIERRE_CASO_IMPOSIBILIDAD_AVANZAR}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                        </div>
                      </>
                    )}

                    {show5B && (
                      <>
                        <h3 className="block-title">{displayText('BLOQUE 5. TrÃ¡mite de la solicitud')}</h3>
                        <div className="grid-2">
                          <Campo
                            label="43. Fecha de recepciÃ³n de pruebas aportadas por el usuario (si aplica)"
                            name="Fecha de recepciÃ³n de pruebas aportadas por el usuario (si aplica)"
                            type="date"
                            value={registro['Fecha de recepciÃ³n de pruebas aportadas por el usuario (si aplica)']}
                            onChange={handleChange}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="44. Fecha de solicitud de documentos al Inpec (si aplica)"
                            name="Fecha de solicitud de documentos al Inpec (si aplica)"
                            type="date"
                            value={registro['Fecha de solicitud de documentos al Inpec (si aplica)']}
                            onChange={handleChange}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="45. Fecha de presentaciÃ³n de la solicitud a la autoridad"
                            name="Fecha de presentaciÃ³n de la solicitud a la autoridad"
                            type="date"
                            value={registro['Fecha de presentaciÃ³n de la solicitud a la autoridad']}
                            onChange={handleChange}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="46. Fecha de decisiÃ³n de la autoridad"
                            name="Fecha de decisiÃ³n de la autoridad"
                            type="date"
                            value={registro['Fecha de decisiÃ³n de la autoridad']}
                            onChange={handleChange}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="47. Sentido de la decisiÃ³n"
                            name="Sentido de la decisiÃ³n"
                            type="select"
                            value={registro['Sentido de la decisiÃ³n']}
                            onChange={handleChange}
                            options={OPCIONES_BLOQUE_5B_SENTIDO_DECISION}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="48. Motivo de la decisiÃ³n negativa"
                            name="Motivo de la decisiÃ³n negativa"
                            type="select"
                            value={registro['Motivo de la decisiÃ³n negativa']}
                            onChange={handleChange}
                            options={OPCIONES_BLOQUE_5B_MOTIVO_DECISION_NEGATIVA}
                            required={false}
                            disabled={bloquearBloque5 || !habilitarNegativaTramiteNormal}
                          />
                          <Campo
                            label="49. Se presenta recurso"
                            name="Se presenta recurso"
                            type="select"
                            value={registro['Se presenta recurso']}
                            onChange={handleChange}
                            options={OPCIONES_SI_NO}
                            required={false}
                            disabled={bloquearBloque5 || !habilitarNegativaTramiteNormal}
                          />
                          <Campo
                            label="50. Fecha de recurso en caso desfavorable"
                            name="Fecha de recurso en caso desfavorable"
                            type="date"
                            value={registro['Fecha de recurso en caso desfavorable']}
                            onChange={handleChange}
                            required={false}
                            disabled={
                              bloquearBloque5 ||
                              !habilitarNegativaTramiteNormal ||
                              !isEquivalenteSi(registro?.['Se presenta recurso'])
                            }
                          />
                          <Campo
                            label="51. Sentido de la decisiÃ³n que resuelve recurso"
                            name="Sentido de la decisiÃ³n que resuelve la solicitud"
                            type="select"
                            value={registro['Sentido de la decisiÃ³n que resuelve la solicitud']}
                            onChange={handleChange}
                            options={OPCIONES_BLOQUE_5B_SENTIDO_DECISION_RESUELVE_SOLICITUD}
                            required={false}
                            disabled={
                              bloquearBloque5 ||
                              !habilitarNegativaTramiteNormal ||
                              !isEquivalenteSi(registro?.['Se presenta recurso'])
                            }
                          />
                          <Campo
                            label="52. Cierre del caso por imposibilidad de avanzar (si aplica)"
                            name="Cierre del caso por imposibilidad de avanzar (si aplica)"
                            type="select"
                            value={registro['Cierre del caso por imposibilidad de avanzar (si aplica)']}
                            onChange={handleChange}
                            options={OPCIONES_CIERRE_CASO_IMPOSIBILIDAD_AVANZAR}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                        </div>
                      </>
                    )}
                    {bloqueCierre === 'bloque5' && motivoCierre && (
                      <div className="form-field" style={{ marginTop: '0.35rem' }}>
                        <p className="hint-text">{displayText(motivoCierre)}</p>
                      </div>
                    )}
                  </>
                );
              })() : null}
              </fieldset>
            </>
          )}

          {flow === 'sindicado' && (
            <>
              {celesteVisibleBlocks.has('bloque2Celeste') && (
                <>
                  <h3 className="block-title">{displayText('BLOQUE 2 (CELESTE) - InformaciÃ³n del proceso SISIPEC')}</h3>
                  <div className="grid-2">
                    <Campo
                      label="14. Autoridad a cargo"
                      name="Autoridad a cargo"
                      value={registro['Autoridad a cargo']}
                      onChange={handleChange}
                      required
                    />
                    <Campo
                      label="15. NÃºmero de proceso"
                      name="NÃºmero de proceso"
                      value={registro['NÃºmero de proceso']}
                      onChange={handleChange}
                      required
                    />
                    <Campo
                      label="16. Delitos"
                      name="Delitos"
                      type="textarea"
                      value={registro['Delitos']}
                      onChange={handleChange}
                      required
                    />
                    <Campo
                      label="17. Fecha de captura"
                      name="Fecha de captura"
                      type="date"
                      value={registro['Fecha de captura']}
                      onChange={handleChange}
                      required
                    />
                    <Campo
                      label="18. Tiempo que la persona lleva privada de la libertad (en meses)"
                      name="TIEMPO QUE LA PERSONA LLEVA PRIVADA DE LA LIBERTAD (EN MESES)"
                      type="number"
                      value={tiempoPrivacionMeses}
                      onChange={handleChange}
                      readOnly
                      required
                    />
                  </div>
                </>
              )}

              {celesteVisibleBlocks.has('bloque3Celeste') && (
                <>
                  <h3 className="block-title">{displayText('BLOQUE 3 (CELESTE) - AnÃ¡lisis jurÃ­dico')}</h3>
                  <div className="grid-2">
                    <Campo
                      label="19. Defensor(a) p\u00fablico(a) asignado para tramitar la solicitud"
                      name="Defensor(a) PÃºblico(a) Asignado para tramitar la solicitud"
                      type="datalist"
                      value={getDefensorAsignadoValue(registro)}
                      onChange={handleChange}
                      options={opcionesDefensores}
                      required
                      showObligatoria
                    />
                    <Campo
                      label="20. Fecha de an\u00e1lisis jur\u00eddico del caso"
                      name="Fecha de anÃ¡lisis jurÃ­dico del caso"
                      type="date"
                      value={registro['Fecha de anÃ¡lisis jurÃ­dico del caso']}
                      onChange={handleChange}
                      required
                      showObligatoria
                    />
                    <div className="question-40-highlight">
                      <Campo
                        label="21. An\u00e1lisis jur\u00eddico y actuaci\u00f3n a desplegar"
                        name="PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÃ‰RMINOS"
                        type="select"
                        value={registro['PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÃ‰RMINOS']}
                        onChange={handleChange}
                        options={OPCIONES_CELESTE_ANALISIS_ACTUACION}
                        required
                        showObligatoria
                      />
                    </div>
                    <Campo
                      label="22. Resumen del an\u00e1lisis jur\u00eddico del caso"
                      name="RESUMEN DEL ANÃLISIS JURÃDICO DEL PRESENTE CASO"
                      type="textarea"
                      value={registro['RESUMEN DEL ANÃLISIS JURÃDICO DEL PRESENTE CASO']}
                      onChange={handleChange}
                      required={false}
                      showObligatoria
                    />
                  </div>
                </>
              )}

              {celesteVisibleBlocks.has('bloque4Celeste') && (
                <>
                  <h3 className="block-title">{displayText('BLOQUE 4 (CELESTE) - Entrevista con el usuario')}</h3>
                  <div className="grid-2">
                    <Campo
                      label="23. Fecha de la entrevista para informar al usuario"
                      name="Fecha de entrevista"
                      type="date"
                      value={registro['Fecha de entrevista']}
                      onChange={handleChange}
                      required
                      showObligatoria
                    />
                  </div>
                </>
              )}

              {celesteVisibleBlocks.has('bloque5Celeste') && (
                <>
                  <h3 className="block-title">{displayText('BLOQUE 5 (CELESTE) - TrÃ¡mite de la solicitud')}</h3>
                  <div className="grid-2">
                    <Campo
                      label="24. Fecha de presentaciÃ³n de la solicitud de audiencia"
                      name="FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÃAS PARA SUSTENTAR REVOCATORIA"
                      type="date"
                      value={registro['FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÃAS PARA SUSTENTAR REVOCATORIA']}
                      onChange={handleChange}
                      required={false}
                    />
                    <Campo
                      label="25. Fecha de realizaciÃ³n de la audiencia"
                      name="FECHA DE REALIZACIÃ“N DE AUDIENCIA"
                      type="date"
                      value={registro['FECHA DE REALIZACIÃ“N DE AUDIENCIA']}
                      onChange={handleChange}
                      required={false}
                    />
                    <Campo
                      label="26. Sentido de la decisiÃ³n"
                      name="SENTIDO DE LA DECISIÃ“N"
                      type="select"
                      value={registro['SENTIDO DE LA DECISIÃ“N']}
                      onChange={handleChange}
                      options={OPCIONES_SENTIDO_DECISION_CELESTE}
                      required={false}
                    />
                    <Campo
                      label="27. Motivo de la decisiÃ³n negativa"
                      name="MOTIVO DE LA DECISIÃ“N NEGATIVA"
                      type="select"
                      value={registro['MOTIVO DE LA DECISIÃ“N NEGATIVA']}
                      onChange={handleChange}
                      options={OPCIONES_MOTIVO_DECISION_NEGATIVA_CELESTE}
                      required={false}
                      disabled={!habilitarCelesteMotivoNegativa}
                    />
                    <Campo
                      label="28. Se presenta recurso"
                      name="Â¿SE RECURRIÃ“ EN CASO DE DECISIÃ“N NEGATIVA?"
                      type="select"
                      value={registro['Â¿SE RECURRIÃ“ EN CASO DE DECISIÃ“N NEGATIVA?']}
                      onChange={handleChange}
                      options={OPCIONES_SI_NO}
                      required={false}
                    />
                    <Campo
                      label="29. Fecha de recurso en caso desfavorable"
                      name="Fecha de presentaciÃ³n del recurso"
                      type="date"
                      value={registro['Fecha de presentaciÃ³n del recurso']}
                      onChange={handleChange}
                      required={false}
                      disabled={!habilitarCelesteRecurso}
                    />
                    <Campo
                      label="30. Sentido de la decisiÃ³n que resuelve recurso"
                      name="SENTIDO DE LA DECISIÃ“N QUE RESUELVE RECURSO"
                      type="select"
                      value={registro['SENTIDO DE LA DECISIÃ“N QUE RESUELVE RECURSO']}
                      onChange={handleChange}
                      options={OPCIONES_SENTIDO_DECISION_RECURSO_CELESTE}
                      required={false}
                      disabled={!habilitarCelesteRecurso}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {casoCerrado && !bloqueCierre && motivoCierre && (
            <div className="form-field" style={{ marginTop: '0.35rem' }}>
              <p className="hint-text">{displayText(motivoCierre)}</p>
            </div>
          )}

          <div className="actions-center"> 
            <button className="save-button" type="button" onClick={handleGuardar}>
              GUARDAR ENTREVISTA
            </button>

            {guardadoOk && (
              <button className="save-button secondary" type="button" onClick={handleConsultarOtro}>
                CONSULTAR OTRO PPL
              </button>
            )}
          </div>
        </div>
          )}
        </>
      )}
    </>
  );
}


















