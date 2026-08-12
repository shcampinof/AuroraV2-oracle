import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDefensor,
  createPplActuacion,
  getCondenadosFilterOptions,
  getDefensoresCatalogo,
  getPplActuacionesByDocumento,
  getPplByDocumento,
  isQueuedResponse,
  updatePpl,
} from '../services/api.js';
import Toast from '../components/Toast.jsx';
import HistorialActuacionesPPL from '../components/HistorialActuacionesPPL.jsx';
import { evaluateAuroraRules } from '../utils/evaluateAuroraRules.ts';
import { evaluateCelesteRules } from '../utils/evaluateCelesteRules.ts';
import auroraFormRules from '../config/formRules.aurora.ts';
import { AURORA_FIELD_IDS } from '../config/auroraFieldIds.ts';
import { reportError } from '../utils/reportError.js';
import { getLabelAccionCaso } from '../utils/actuacionesLabels.js';
import { shouldBlockNuevaActuacion } from '../utils/actuacionesValidation.js';
import { isSituacionActiva } from '../utils/pplStatus.js';

const OPCIONES_TIPO_IDENTIFICACION = ['CC', 'CE', 'PASAPORTE', 'OTRA'];
const OPCIONES_SI_NO = ['Sí', 'No'];
const OPCIONES_PODER = ['Sí se requiere', 'Ya se cuenta con poder', 'No requiere poder'];
const KEY_Q35_LEGACY = 'Con qu? proceso(s) debe acumular penas (si aplica)';
const KEY_Q35_UTF8 = 'Con qué proceso(s) debe acumular penas (si aplica)';
const KEY_FECHA_ULTIMA_CALIFICACION = 'Fecha última calificación';
const KEY_ACTA_CALIFICACION = 'No.Acta de calificación de conducta';
const KEY_EVALUACION_DESDE = 'Evaluación de conducta desde';
const KEY_EVALUACION_HASTA = 'Evaluación de conducta hasta';
const KEY_CALIFICACION_CONDUCTA = 'Calificación de conducta';
const KEY_FECHA_RECURSO_AURORA_LEGACY = 'Fecha de recurso en caso desfavorable';
const KEY_FECHA_PRESENTACION_RECURSO = 'Fecha de presentación del recurso';
const KEY_FECHA_DECISION_RECURSO = 'Fecha de la decisión del recurso';
const KEY_FECHA_INSISTENCIA_1 = 'Fecha de insistencia 1';
const KEY_FECHA_INSISTENCIA_2 = 'Fecha de insistencia 2';
const ALIASES_SE_PRESENTA_RECURSO = [
  'Se presenta recurso',
  '¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?',
  '¿SE RECURRIO EN CASO DE DECISION NEGATIVA?',
];
const ALIASES_RADICACION_UTILIDAD = [
  'Fecha de radicación de solicitud de utilidad pública',
  'Fecha de radicacion de solicitud de utilidad publica',
  'Fecha de radicación de la solicitud de utilidad pública',
  'Fecha de radicacion de la solicitud de utilidad publica',
];
const ALIASES_CELESTE_Q21_ACTUACION = [
  'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS',
  'Actuación a adelantar',
  'Actuacion a adelantar',
];

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
  'Indígena',
  'Migrante',
  'Población LGTBI+',
  'Adulto mayor',
];
const OPCIONES_LUGAR_PRIVACION = ['CDT', 'ERON'];
const CAMPO_ESTABLECIMIENTO = 'Nombre del lugar de privación de la libertad';
const CAMPO_DEPARTAMENTO_RECLUSION = 'Departamento del lugar de privación de la libertad';
const CAMPO_MUNICIPIO_RECLUSION = 'Distrito/municipio del lugar de privación de la libertad';

function normalizeCatalogValue(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function appendCurrentCatalogValue(options, currentValue) {
  const values = Array.isArray(options) ? options.map((value) => String(value || '').trim()).filter(Boolean) : [];
  const current = String(currentValue || '').trim();
  const keys = new Set(values.map(normalizeCatalogValue));
  if (current && !keys.has(normalizeCatalogValue(current))) values.push(current);
  return values.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

function resolveCentroCatalogLabel(value, centros) {
  const key = normalizeCatalogValue(value);
  if (!key) return '';
  const matches = (Array.isArray(centros) ? centros : []).filter((centro) => {
    const candidates = [centro?.label, ...(Array.isArray(centro?.valoresOriginales) ? centro.valoresOriginales : [])];
    return candidates.some((candidate) => normalizeCatalogValue(candidate) === key);
  });
  const ids = new Set(matches.map((centro) => String(centro?.id || '').trim()).filter(Boolean));
  return ids.size === 1 ? String(matches[0]?.label || '').trim() : '';
}

function resolveControlledCatalogValue(value, options) {
  const key = normalizeCatalogValue(value);
  if (!key) return '';
  const matches = (Array.isArray(options) ? options : [])
    .map((option) => (typeof option === 'string' ? option : String(option?.label ?? option?.value ?? '')))
    .map((option) => String(option || '').trim())
    .filter((option) => normalizeCatalogValue(option) === key);
  return matches.length === 1 ? matches[0] : '';
}

function normalizeDefensorNombre(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}
const OPCIONES_FASE_TRATAMIENTO = [
  { value: 'OBS', label: 'Observación' },
  { value: 'ALT', label: 'Alta' },
  { value: 'MED', label: 'Mediana' },
  { value: 'MIN', label: 'Mínima' },
  { value: 'CON', label: 'Confianza' },
  { value: 'SIN', label: 'No reporta' },
];
const OPCIONES_REQUERIMIENTOS_JUDICIALES = [
  { value: 'S', label: 'Sí' },
  { value: 'N', label: 'No' },
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

  'Sí procede solicitud de libertad condicional',
  'Sí procederá proximamente libertad condicional (90 días o menos para cumplir tiempo)',
  'No aplica porque ya hay solicitud de libertad o subrogado penal en trámite',
  'No aplica porque ya está en libertad por pena cumplida',
  'No aplica porque ya se concedió libertad condicional',
  'No aplica porque ya se concedió prisión domiciliaria',
  'No aplica porque ya se concedió utilidad pública',
  'No aplica porque el proceso no ha sido asignado a JEPMS',
  'No aplica porque el proceso está en otro circuito judicial (falta trasladar el proceso al actual)',
  'No aplica porque la condena está por delito excluido del subrogado',
  'No aplica porque recientemente se le revocó subrogado penal',
  'No aplica porque recientemente se le negó subrogado penal',
  'No aplica porque la evaluación de conducta es negativa',
  'No aplica porque se determinó que no ha cumplido requisito temporal para acceder',
  'No aplica porque tiene acumulación de penas',
  'No aplica porque la persona fue trasladada a otro ERON',
  'No aplica porque la persona está sindicada',
  'No aplica porque la cartilla biográfica no está actualizada',
  'Revisión suspendida porque se requiere primero trámite de acumulación de penas',
  'No aplica porque el usuario no puede demostrar arraigo',
  'No aplica porque est\u00E1 en tr\u00E1mite solicitud de acumulaci\u00F3n de penas',
];
const OPCIONES_PROCEDENCIA_LIBERTAD_CONDICIONAL_NUMERADAS =
  OPCIONES_PROCEDENCIA_LIBERTAD_CONDICIONAL.map((option, index) => ({
    value: option,
    label: `${index + 1}. ${option}`,
  }));

const OPCIONES_PROCEDENCIA_PRISION_DOMICILIARIA = [

  'Sí procede solicitud de prisión domiciliaria de mitad de pena',
  'Sí procederá proximamente prisión domiciliaria (90 días o menos para cumplir tiempo)',
  'No aplica porque ya hay solicitud de libertad o subrogado penal en trámite',
  'No aplica porque ya está en libertad por pena cumplida',
  'No aplica porque ya se concedió libertad condicional',
  'No aplica porque ya se concedió prisión domiciliaria',
  'No aplica porque ya se concedió utilidad pública',
  'No aplica porque el proceso no ha sido asignado a jepms',
  'No aplica porque el proceso está en otro circuito judicial (falta trasladar el proceso al actual)',
  'No aplica porque la condena está por delito excluido del subrogado',
  'No aplica porque recientemente se le revocó un subrogado penal',
  'No aplica porque recientemente se le negó subrogado penal',
  'No aplica porque la evaluación de conducta es negativa',
  'No aplica porque se determinó que no ha cumplido requisito temporal para acceder',
  'No aplica porque tiene acumulación de penas',
  'No aplica porque la persona fue trasladada a otro ERON',
  'No aplica porque la persona está sindicada',
  'No aplica porque la cartilla biográfica no está actualizada',
  'Revisión suspendida porque se requiere primero trámite de acumulación de penas',
  'No aplica porque el usuario no puede demostrar arraigo',
  'No aplica porque est\u00E1 en tr\u00E1mite solicitud de acumulaci\u00F3n de penas',
];
const OPCIONES_PROCEDENCIA_PRISION_DOMICILIARIA_NUMERADAS =
  OPCIONES_PROCEDENCIA_PRISION_DOMICILIARIA.map((option, index) => ({
    value: option,
    label: `${index + 1}. ${option}`,
  }));

const OPCIONES_PROCEDENCIA_UTILIDAD_PUBLICA = [

  'Sí cumple requisitos objetivos',
  'No cumple por tipo de delito',
  'No cumple monto de pena',
  'No cumple por reincidencia',
  'No cumple por delito excluido',
  'No aplica porque est\u00E1 en tr\u00E1mite solicitud de acumulaci\u00F3n de penas',
];
const OPCIONES_PROCEDENCIA_UTILIDAD_PUBLICA_NUMERADAS = OPCIONES_PROCEDENCIA_UTILIDAD_PUBLICA.map(
  (option, index) => ({
    value: option,
    label: `${index + 1}. ${option}`,
  })
);

const OPCIONES_PROCEDENCIA_ACUMULACION_PENAS = [
  ...OPCIONES_SI_NO,
  'No aplica porque est\u00E1 en tr\u00E1mite solicitud de acumulaci\u00F3n de penas',
];

const OPCION_ACCION_TUTELA = 'Acción de tutela';
const OPCIONES_OTRAS_SOLICITUDES = [
  'Ninguna',
  'Solicitud de actualización de conducta',
  'Solicitud de asignación de JEPMS',
  'Solicitud de traslado del proceso al distrito judicial correspondiente',
  'Solicitud de actualización de cartilla biográfica',
  'Solicitud de redención de pena 2x3 trabajo',
  'Solicitud de redención de pena 2x3 analógica en actividades distintas a trabajo',
  'Permiso de 72 horas',
  OPCION_ACCION_TUTELA,
  'Otra',
];
const OPCION_MULTIPLE_P36 = 'MAS DE UNA OPCION';
const OPCION_MULTIPLE_P36_LEGACY = 'MAS DE UNA OPCION (VER RESUMEN ANALISIS DEL CASO)';

const OPCIONES_AURORA_DECISION_USUARIO = [
  'Sí, desea que el defensor(a) público(a) avance con la solicitud',
  'Sí desea que el defensor presente solicitud, pero suscrita por la persona privada de la Libertad.',
  'No, porque desea tramitar la solicitud a través de su defensor de confianza',
  'No desea tramitar la solicitud',
  'No avanzará porque no puede demostar arraigo fuera de prisión',
  'El usuario es renuente a la atención',
];

const OPCIONES_AURORA_ACTUACION_A_ADELANTAR = [
  'Libertad condicional',
  'Prisión domiciliaria',
  'Utilidad pública (solo mujeres)',
  'Utilidad pública (solo mujeres) y prisión domiciliaria',
  'Utilidad pública (solo mujeres) y libertad condicional',
  'Redención de pena y libertad condicional',
  'Redención de pena y prisión domiciliaria',
  'Libertad condicional y en subsidio prisión domiciliaria',
  'Acumulación de penas',
  'Libertad por pena cumplida',
  'Redención de pena y libertad por pena cumplida',
  'Redención de pena',
  'Permiso de 72 horas',
  'Solicitud de actualización de conducta',
  'Solicitud de asginación de JEPMS',
  'Solicitud de traslado del proceso al distrito judicial correspondiente',
  'Reiterar solicitud de subrogado penal ya radicada',
  'Solicitud de actualización de cartilla biográfica',
  OPCION_ACCION_TUTELA,
  'Otra',
  'Ninguna porque la persona está sindicada',
  'Ninguna porque está en trámite una solicitud de subrogado penal o pena cumplida',
  'Ninguna porque no procede subrogado penal en este momento por falta de cumplimiento de requisitos',
  'Ninguna porque no procede subrogado penal por exclusión de delito',
  'Ninguna porque ya no está en prisión',
];

const ACTUACIONES_UTILIDAD_PUBLICA = new Set([
  'Utilidad pública (solo mujeres)',
  'Utilidad pública (solo para mujeres)',
  'Utilidad pública (solo mujeres) y prisión domiciliaria',
  'Utilidad pública (solo mujeres) y libertad condicional',
]);
const ACTUACIONES_UTILIDAD_PUBLICA_NORMALIZADAS = new Set(
  Array.from(ACTUACIONES_UTILIDAD_PUBLICA).map((v) => norm(maybeDecodeUtf8Mojibake(v)))
);

const OPCIONES_BLOQUE_5A_SENTIDO_DECISION = ['Otorga utilidad pública', 'Niega utilidad pública'];
const OPCIONES_BLOQUE_5A_MOTIVO_DECISION_NEGATIVA = [
  'No concede por requisito objetivo',
  'No concede por requisito subjetivo',
  'No concede por requisitos objetivos y subjetivos',
  'Niega por falta de pruebas',
  'Concede otro beneficio',
  'Pena cumplida',
];
const OPCIONES_BLOQUE_5A_SENTIDO_DECISION_RESUELVE_RECURSO = [
  'Otorga utilidad pública',
  'Niega utilidad pública',
];

const OPCIONES_BLOQUE_5B_SENTIDO_DECISION = ['Concede la solicitud', 'No concede la solicitud'];
const OPCIONES_BLOQUE_5B_MOTIVO_DECISION_NEGATIVA = [
  'Porque no cumple aún con el tiempo para aplicar al subrogado',
  'Porque falta documentación a remitir por parte del Inpec',
  'Porque la autoridad judicial no tuvo en cuenta todo el tiempo de privación de libertad de la persona en otros ERON o centro de detención transitoria',
  'Por la valoración de la conducta punible contenida en la sentencia',
  'Porque el juez encuentra que el avance en el tratamiento penitenciario de la persona aún no es suficiente',
  'Porque tiene calificaciones de conducta negativa de periodos anteriores',
  'Porque no se demostró el arraigo familiar o social de la persona privada de la libertad',
  'Porque no se ha reparado a la víctima o asegurado el pago de la indemnización a esta a través de garantía personal, real, bancaria o acuerdo de pago y tampoco se ha demostrado la insolvencia del condenado',
  'Porque determinó que hay un delito excluido que impide concesión',
  'Porque la persona privada de la libertad pertenece al grupo familiar de la víctima',
  'Porque no se demostró el arraigo familiar o social de la persona privada de la libertad',
  'Porque la persona no tiene un lugar al que ir por fuera de prisión (no tiene arraigo)',
  'Porque no cumple requisito de jefatura de hogar para utilidad pública',
  'Porque no cumple requisito de marginalidad para utilidad pública',
  'Se consideró que no cumple algún requisito para su procedencia',
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

  'Se avanzará con solicitud de revocatoria o sustitución de la medida',
  'No se avanzará con la revocatoria porque la persona ya fue condenada',
  'No se avanzará con la revocatoria porque aún no reúne el tiempo exigido por la norma para solicitar el levantamiento de la detención preventiva',
  'No se avanzará con la revocatoria porque la persona está procesada por delitos en los que procede prórroga de la detención preventiva y aún no cumple ese tiempo',
  'No se avanzará con la revocatoria porque son tres o más los acusados y aún no se cumple el tiempo para solicitar el levantamiento de la detención preventiva en este supuesto',
  'No se avanzará con la revocatoria porque la persona está procesada por delitos atribuibles a Grupos Delictivos Organizados (GDO) o Grupos Armados Organizados (GAO) y aún no cumple el tiempo permitido',
  'No se avanzará con la revocatoria porque ya hay una solicitud en trámite',
  'No se avanzará porque no tiene defensor público asignado',
  'No se avanzar\u00E1 porque ya no soy el defensor en este caso',
];
const OPCIONES_SENTIDO_DECISION_CELESTE = [
  'Revoca medida de aseguramiento privativa de la libertad',
  'Sustituye medida de aseguramiento privativa de la libertad',
  'Niega la solicitud',
];
const OPCIONES_MOTIVO_DECISION_NEGATIVA_CELESTE = [
  'Porque no cumple aún con los términos exigidos',
  'Porque está procesado por causales en las que procede la prórroga de la medida',
  'Otra',
];
const OPCIONES_SENTIDO_DECISION_RECURSO_CELESTE = [
  'Concede levantamiento de medida de aseguramiento',
  'No concede levantamiento de medida de aseguramiento',
];

const EXPORT_FIELDS_BLOQUE_1 = [
  { label: '1. Nombre', key: 'Nombre' },
  { label: '2. Tipo de identificación', key: 'Tipo de indentificación' },
  { label: '3. Número de identificación', key: 'Número de identificación', aliases: ['Numero de identificacion'] },
  { label: '4. Situación Jurídica', key: 'Situación Jurídica' },
  { label: '5. Género', key: 'Género' },
  { label: '6. Enfoque diferencial', key: 'Enfoque Étnico/Racial/Cultural' },
  { label: '7. Nacionalidad', key: 'Nacionalidad' },
  { label: '8. Fecha de nacimiento', key: 'Fecha de nacimiento', isDate: true },
  { label: '9. Edad', key: 'Edad' },
  { label: '10. Lugar de privación de la libertad', key: 'Lugar de privación de la libertad' },
  { label: '11. Nombre del lugar de privación de la libertad', key: 'Nombre del lugar de privación de la libertad' },
  { label: '12. Departamento del lugar de privación de la libertad', key: 'Departamento del lugar de privación de la libertad' },
  { label: '13. Distrito/municipio del lugar de privación de la libertad', key: 'Distrito/municipio del lugar de privación de la libertad' },
];

const EXPORT_FIELDS_AURORA_BLOQUE_2 = [
  { label: '14. Autoridad a cargo', key: 'Autoridad a cargo' },
  { label: '15. Número de proceso', key: 'Número de proceso' },
  { label: '16. Delitos', key: 'Delitos' },
  { label: '17. Fecha de captura', key: 'Fecha de captura', isDate: true },
  { label: '18. Pena (años, meses y días)', key: 'Pena (años, meses y días)' },
  { label: '19. Pena total en días', key: 'Pena total en días' },
  { label: '20. Tiempo que la persona lleva privada de la libertad (en días)', key: 'Tiempo que la persona lleva privada de la libertad (en días)' },
  { label: '21. Redención total acumulada en días', key: 'Redención total acumulada en días' },
  { label: '22. Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)', key: 'Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)' },
  { label: '23. Porcentaje de avance de pena cumplida', key: 'Porcentaje de avance de pena cumplida', isPercentage: true },
  { label: '24. Fase de tratamiento', key: 'Fase de tramiento', aliases: ['Fase de tratamiento'] },
  {
    label: '25. ¿Cuenta con requerimientos judiciales por otros procesos?',
    key: '¿ Cuenta con requerimientos judiciales por otros procesos ?',
    aliases: ['¿Cuenta con requerimientos judiciales por otros procesos?'],
  },
];

const EXPORT_FIELDS_AURORA_BLOQUE_3 = [
  { label: '28. Defensor(a) público(a) asignado para tramitar la solicitud', key: 'Defensor(a) Público(a) Asignado para tramitar la solicitud' },
  { label: '29. Fecha de análisis jurídico del caso', key: 'Fecha de análisis jurídico del caso', isDate: true },
  { label: '30. Procedencia de libertad condicional', key: 'Procedencia de libertad condicional' },
  { label: '31. Procedencia de prisión domiciliaria de mitad de pena', key: 'Procedencia de prisión domiciliaria de mitad de pena' },
  { label: '32. Procedencia de utilidad pública (solo para mujeres)', key: 'Procedencia de utilidad pública (solo para mujeres)' },
  { label: '33. Procedencia de pena cumplida', key: 'Procedencia de pena cumplida' },
  { label: '34. Procedencia de acumulación de penas', key: 'Procedencia de acumulación de penas' },
  { label: '35. Con qué proceso(s) debe acumular penas (si aplica)', key: KEY_Q35_UTF8, aliases: [KEY_Q35_LEGACY] },
  { label: '36. Otras solicitudes a tramitar', key: 'Otras solicitudes a tramitar' },
  { label: '37. Resumen del análisis del caso', key: 'Resumen del análisis del caso' },
];

const EXPORT_FIELDS_AURORA_BLOQUE_4 = [
  { label: '38. Fecha de la entrevista', key: 'Fecha de entrevista', isDate: true },
  { label: '39. Decisión del usuario', key: 'Decisión del usuario' },
  { label: '40. Actuación a adelantar', key: 'Actuación a adelantar' },
  { label: '41. Requiere pruebas', key: 'Requiere pruebas' },
  { label: '42. Poder en caso de avanzar con la solicitud', key: 'Poder en caso de avanzar con la solicitud' },
];

const EXPORT_FIELDS_AURORA_BLOQUE_5_UTILIDAD = [
  { label: '43. Fecha de entrevista psicosocial', key: 'Fecha de entrevista psicosocial', isDate: true },
  { label: '44. Cumple el requisito de marginalidad', key: 'Cumple el requisito de marginalidad' },
  { label: '45. Cumple el requisito de jefatura de hogar', key: 'Cumple el requisito de jefatura de hogar' },
  { label: '46. Se requiere misión de trabajo', key: 'Se requiere misión de trabajo' },
  { label: '47. Fecha de solicitud de misión de trabajo', key: 'Fecha de solicitud de misión de trabajo', isDate: true },
  { label: '48. Fecha de asignación de investigador', key: 'Fecha de asignación de investigador', isDate: true },
  { label: '49. Fecha en la que se reciben todas las pruebas', key: 'Fecha en la que se reciben todas las pruebas', isDate: true },
  { label: '50. Fecha de radicación de solicitud de utilidad pública', key: 'Fecha de radicación de solicitud de utilidad pública', isDate: true },
  { label: '51. Fecha de decisión de la autoridad', key: 'Fecha de decisión de la autoridad', isDate: true },
  { label: '52. Sentido de la decisión', key: 'Sentido de la decisión' },
  { label: '53. Motivo de la decisión negativa', key: 'Motivo de la decisión negativa' },
  { label: '54. Se presenta recurso', key: 'Se presenta recurso' },
  {
    label: '55. Fecha de presentación del recurso',
    key: KEY_FECHA_PRESENTACION_RECURSO,
    aliases: [KEY_FECHA_RECURSO_AURORA_LEGACY],
    isDate: true,
  },
  { label: '56. Fecha de la decisión del recurso', key: KEY_FECHA_DECISION_RECURSO, isDate: true },
  { label: '57. Sentido de la decisión que resuelve recurso', key: 'Sentido de la decisión que resuelve recurso' },
  { label: '58. Cierre del caso por imposibilidad de avanzar (si aplica)', key: 'Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad pública' },
];

const EXPORT_FIELDS_AURORA_BLOQUE_5_TRAMITE = [
  {
    label: '43. Fecha de recepción de pruebas aportadas por el usuario (si aplica)',
    key: 'Fecha de recepción de pruebas aportadas por el usuario (si aplica)',
    isDate: true,
  },
  { label: '44. Fecha de solicitud de documentos al Inpec (si aplica)', key: 'Fecha de solicitud de documentos al Inpec (si aplica)', isDate: true },
  { label: '45. Fecha de presentación de la solicitud a la autoridad', key: 'Fecha de presentación de la solicitud a la autoridad', isDate: true },
  { label: '46. Fecha de decisión de la autoridad', key: 'Fecha de decisión de la autoridad', isDate: true },
  { label: '47. Sentido de la decisión', key: 'Sentido de la decisión' },
  { label: '48. Fecha de insistencia 1', key: KEY_FECHA_INSISTENCIA_1, isDate: true },
  { label: '49. Fecha de insistencia 2', key: KEY_FECHA_INSISTENCIA_2, isDate: true },
  { label: '50. Motivo de la decisión negativa', key: 'Motivo de la decisión negativa' },
  { label: '51. Se presenta recurso', key: 'Se presenta recurso' },
  {
    label: '52. Fecha de presentación del recurso',
    key: KEY_FECHA_PRESENTACION_RECURSO,
    aliases: [KEY_FECHA_RECURSO_AURORA_LEGACY],
    isDate: true,
  },
  { label: '53. Fecha de la decisión del recurso', key: KEY_FECHA_DECISION_RECURSO, isDate: true },
  { label: '54. Sentido de la decisión que resuelve recurso', key: 'Sentido de la decisión que resuelve la solicitud' },
  { label: '55. Cierre del caso por imposibilidad de avanzar (si aplica)', key: 'Cierre del caso por imposibilidad de avanzar (si aplica)' },
];

const EXPORT_FIELDS_CELESTE_BLOQUE_2 = [
  { label: '14. Autoridad a cargo', key: 'Autoridad a cargo' },
  { label: '15. Número de proceso', key: 'Número de proceso' },
  { label: '16. Delitos', key: 'Delitos' },
  { label: '17. Fecha de captura', key: 'Fecha de captura', isDate: true },
  { label: '18. Tiempo que la persona lleva privada de la libertad (en meses)', key: 'TIEMPO QUE LA PERSONA LLEVA PRIVADA DE LA LIBERTAD (EN MESES)' },
];

const EXPORT_FIELDS_CELESTE_BLOQUE_3 = [
  { label: '19. Defensor(a) público(a) asignado para tramitar la solicitud', key: 'Defensor(a) Público(a) Asignado para tramitar la solicitud' },
  { label: '20. Fecha de análisis jurídico del caso', key: 'Fecha de análisis jurídico del caso', isDate: true },
  { label: '21. Análisis jurídico y actuación a desplegar', key: 'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS' },
  { label: '22. Resumen del análisis jurídico del presente caso', key: 'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO' },
];

const EXPORT_FIELDS_CELESTE_BLOQUE_4 = [{ label: '23. Fecha de la entrevista para informar al usuario', key: 'Fecha de entrevista', isDate: true }];

const EXPORT_FIELDS_CELESTE_BLOQUE_5 = [
  {
    label: '24. Fecha de presentación de la solicitud de audiencia',
    key: 'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA',
    isDate: true,
  },
  { label: '25. Fecha de realización de la audiencia', key: 'FECHA DE REALIZACIÓN DE AUDIENCIA', isDate: true },
  { label: '26. Sentido de la decisión', key: 'SENTIDO DE LA DECISIÓN' },
  { label: '27. Motivo de la decisión negativa', key: 'MOTIVO DE LA DECISIÓN NEGATIVA' },
  { label: '28. Se presenta recurso', key: '¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?' },
  { label: '29. Fecha de presentación del recurso', key: 'Fecha de presentación del recurso', isDate: true },
  { label: '30. Fecha de la decisión del recurso', key: 'Fecha de la decisión del recurso', isDate: true },
  { label: '31. Sentido de la decisión que resuelve recurso', key: 'SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO' },
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
  const text = String(value ?? '').trim();
  if (!text) return false;
  const normalized = normalizeFieldName(text);
  return normalized !== '-' && normalized !== '--' && normalized !== 'null' && normalized !== 'undefined' && normalized !== 'seleccione' && normalized !== 'todos';
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
  // Regla principal: flujo por "Situación Jurídica"; fallback por tipo informado por API.
  const fromSituacion = resolveTipoFromText(formData?.['Situación Jurídica']);
  if (fromSituacion) return fromSituacion;

  const fromSituacionActualizada = resolveTipoFromText(
    formData?.['Situación Jurídica actualizada (de conformidad con la rama judicial)']
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

function parseP36Selections(rawValue) {
  const text = String(rawValue ?? '').trim();
  if (!text) return [];

  const parts = text
    .split(/\r?\n|\s*\|\s*|\s*;\s*/g)
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);

  const seen = new Set();
  const selected = [];
  const isP36MultipleMarker = (normalizedValue) =>
    (normalizedValue.includes('mas de una') && normalizedValue.includes('opci')) || (normalizedValue.includes('resumen') && normalizedValue.includes('opci'));
  for (const part of parts) {
    const normalized = normalizeFieldName(part);
    if (!normalized) continue;
    if (
      isP36MultipleMarker(normalized) ||
      normalized === normalizeFieldName(OPCION_MULTIPLE_P36) ||
      normalized === normalizeFieldName(OPCION_MULTIPLE_P36_LEGACY)
    ) {
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    selected.push(part);
  }
  return selected;
}

function serializeP36Selections(values) {
  const input = Array.isArray(values) ? values : [];
  const selected = [];
  const seen = new Set();
  const isP36MultipleMarker = (normalizedValue) =>
    (normalizedValue.includes('mas de una') && normalizedValue.includes('opci')) || (normalizedValue.includes('resumen') && normalizedValue.includes('opci'));
  for (const value of input) {
    const text = String(value ?? '').trim();
    const normalized = normalizeFieldName(text);
    if (!normalized) continue;
    if (
      isP36MultipleMarker(normalized) ||
      normalized === normalizeFieldName(OPCION_MULTIPLE_P36) ||
      normalized === normalizeFieldName(OPCION_MULTIPLE_P36_LEGACY)
    ) {
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    selected.push(text);
  }

  if (selected.length > 1) selected.push(OPCION_MULTIPLE_P36);
  return selected.join('\n');
}

function hasValidP36Selection(rawValue) {
  return parseP36Selections(rawValue).length > 0;
}

function isEquivalenteSi(valor) {
  const decoded = maybeDecodeUtf8Mojibake(decodeUnicodeEscapes(String(valor ?? '')));
  const v = norm(decoded);
  return v === 'si' || v === 's?';
}

function isEquivalenteNo(valor) {
  const decoded = maybeDecodeUtf8Mojibake(decodeUnicodeEscapes(String(valor ?? '')));
  return norm(decoded) === 'no';
}

function isProcedenciaAfirmativa(valor) {
  const decoded = maybeDecodeUtf8Mojibake(decodeUnicodeEscapes(String(valor ?? '')));
  const v = norm(decoded);
  if (!v || v === '-') return false;
  return v.startsWith('si');
}

function isNoConcedeSubrogadoPenal(valor) {
  const v = norm(valor);
  return v === norm('No concede la solicitud') || v === norm('No concede subrogado penal');
}

function normalizeSentidoDecisionTramite(valor) {
  const raw = String(valor ?? '').trim();
  const v = norm(raw);
  if (!v) return raw;
  if (v === norm('Concede subrogado penal')) return 'Concede la solicitud';
  if (v === norm('No concede subrogado penal')) return 'No concede la solicitud';
  return raw;
}

function decisionUsuarioPermiteAvance(valor) {
  const v = norm(valor);
  if (!v) return false;
  if (v.startsWith('si')) return true;
  if (v.includes('desea que el defensor') && v.includes('avance con la solicitud')) return true;
  if (v.includes('desea que el defensor') && v.includes('presente solicitud')) return true;
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

function setFieldValueAcrossAliases(base, name, value) {
  const normalizedName = normalizeFieldName(name);
  const matchingKeys = Object.keys(base).filter((key) => normalizeFieldName(key) === normalizedName);

  if (!matchingKeys.length) {
    base[name] = value;
    return;
  }

  matchingKeys.forEach((key) => {
    base[key] = value;
  });
  if (!matchingKeys.includes(name)) base[name] = value;
}

function isMeaningfullyFilled(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  const normalized = normalizeFieldName(text);
  return normalized !== '-' && normalized !== '--' && normalized !== 'null' && normalized !== 'undefined' && normalized !== 'seleccione';
}

const DEFENSOR_DIRECT_KEYS = [
  'Defensor(a) Público(a) Asignado para tramitar la solicitud',
  'Defensor(a) P?blico(a) Asignado para tramitar la solicitud',
  'Defensor(a) Publico(a) Asignado para tramitar la solicitud',
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
    .replace(/\u00C2(?=[¿¡])/g, '')
    .replace(/\best\?/gi, 'est\u00e1')
    .replace(/\bavanzar\?/gi, 'avanzar\u00e1')
    .replace(/\bdemostar\b/gi, 'demostrar')
    .replace(/\?ltima/gi, '\u00faltima')
    .replace(/Calificaci[\uFFFD?]n/g, 'Calificaci\u00f3n')
    .replace(/calificaci[\uFFFD?]n/g, 'calificaci\u00f3n')
    .replace(/Decisi[\uFFFD?]n/g, 'Decisi\u00f3n')
    .replace(/decisi[\uFFFD?]n/g, 'decisi\u00f3n')
    .replace(/Actuaci[\uFFFD?]n/g, 'Actuaci\u00f3n')
    .replace(/actuaci[\uFFFD?]n/g, 'actuaci\u00f3n')
    .replace(/Evaluaci[\uFFFD?]n/g, 'Evaluaci\u00f3n')
    .replace(/evaluaci[\uFFFD?]n/g, 'evaluaci\u00f3n');
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

function normalizeCalificacionesConductaRows(value) {
  const rows = Array.isArray(value) ? value : [];
  return rows.slice(0, 4).map((row) => {
    const source = row && typeof row === 'object' ? row : {};
    return {
      fechaUltimaCalificacion: String(source.fechaUltimaCalificacion ?? ''),
      numeroActa: String(source.numeroActa ?? ''),
      evaluacionDesde: String(source.evaluacionDesde ?? ''),
      evaluacionHasta: String(source.evaluacionHasta ?? ''),
      calificacionConducta: String(source.calificacionConducta ?? ''),
    };
  });
}

function applyCalificacionSnapshotToRecord(record, snapshot) {
  const target = record && typeof record === 'object' ? record : {};
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  setFieldValueAcrossAliases(target, KEY_FECHA_ULTIMA_CALIFICACION, source.fechaUltimaCalificacion ?? '');
  setFieldValueAcrossAliases(target, KEY_ACTA_CALIFICACION, source.numeroActa ?? '');
  setFieldValueAcrossAliases(target, KEY_EVALUACION_DESDE, source.evaluacionDesde ?? '');
  setFieldValueAcrossAliases(target, KEY_EVALUACION_HASTA, source.evaluacionHasta ?? '');
  setFieldValueAcrossAliases(target, KEY_CALIFICACION_CONDUCTA, source.calificacionConducta ?? '');
  return target;
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
      // Algunas fuentes tipo Excel traen M/D/YYYY con hora; formularios manuales suelen venir D/M/YYYY.
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

function formatDateForExport(rawValue) {
  const parts = parseDateParts(rawValue);
  if (!parts) return String(rawValue ?? '').trim();
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${day}/${month}/${parts.year}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFileNamePart(value) {
  const cleaned = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'caso';
}

function buildConsolidadoPdfFileName(documento) {
  const date = new Date();
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `consolidado_${sanitizeFileNamePart(documento)}_${yyyy}${mm}${dd}.pdf`;
}

async function downloadConsolidadoPdf({ metadata, sections, fileName }) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (height = 18) => {
    if (y + height <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
  };

  const writeText = (text, options = {}) => {
    const size = Number(options.size || 10);
    const style = options.style || 'normal';
    const x = Number(options.x || margin);
    const width = Number(options.width || contentWidth - (x - margin));
    const lineHeight = Number(options.lineHeight || size + 4);
    const paragraphs = String(text ?? '').split(/\r?\n/);

    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const lines = pdf.splitTextToSize(paragraph || ' ', width);
      lines.forEach((line) => {
        ensureSpace(lineHeight);
        pdf.text(line, x, y);
        y += lineHeight;
      });
      if (paragraphIndex < paragraphs.length - 1) y += 2;
    });
  };

  pdf.setProperties({ title: 'Reporte del caso actual' });
  writeText('Reporte del caso actual (Bloques 1 a 5)', { size: 16, style: 'bold', lineHeight: 20 });
  y += 8;

  metadata.forEach((row) => {
    writeText(`${row.label}: ${row.value}`, { size: 10, lineHeight: 14 });
  });

  sections.forEach((section) => {
    y += 12;
    writeText(section.title, { size: 13, style: 'bold', lineHeight: 17 });
    y += 4;
    section.fields.forEach((field) => {
      writeText(field.label, { size: 10, style: 'bold', lineHeight: 14 });
      writeText(field.value, { size: 10, x: margin + 12, width: contentWidth - 12, lineHeight: 14 });
      y += 4;
    });
  });

  pdf.save(fileName);
}

function toIsoDateString(rawValue) {
  return toDateInputValue(rawValue);
}

function buildTodayPlusDaysIso(days) {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  base.setDate(base.getDate() + Number(days || 0));
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${base.getFullYear()}-${month}-${day}`;
}

function isIsoDateAfter(left, right) {
  const a = String(left ?? '').trim();
  const b = String(right ?? '').trim();
  if (!a || !b) return false;
  return a > b;
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

function parseDayCount(rawValue) {
  const text = String(rawValue ?? '').trim();
  if (!text) return null;
  const normalized = text.replace(',', '.');
  const match = normalized.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function getRemainingDaysStatus(remainingDays) {
  if (!Number.isFinite(remainingDays)) return '';
  const rounded = Math.ceil(Number(remainingDays));
  if (rounded <= 0) return 'Ya cumple el tiempo';
  if (rounded > 90) return 'Más de 90 días';
  return `${rounded} días`;
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

const CAMPOS_AURORA_DESDE_P29 = [
  'Fecha de análisis jurídico del caso',
  'Fecha de analisis juridico del caso',
  'Procedencia de libertad condicional',
  'Procedencia de prisión domiciliaria de mitad de pena',
  'Procedencia de prision domiciliaria de mitad de pena',
  'Procedencia de utilidad pública (solo para mujeres)',
  'Procedencia de utilidad publica (solo para mujeres)',
  'Procedencia de pena cumplida',
  'Procedencia de acumulación de penas',
  'Procedencia de acumulacion de penas',
  KEY_Q35_LEGACY,
  KEY_Q35_UTF8,
  'Otras solicitudes a tramitar',
  'Resumen del análisis del caso',
  'Resumen del analisis del caso',
];

const RESUMEN_ANALISIS_KEYS = [
  'Resumen del análisis del caso',
  'Resumen del analisis del caso',
  'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO',
  'RESUMEN DEL ANALISIS JURIDICO DEL PRESENTE CASO',
];

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

  // Toda actuación nace con una acción persistible, incluso antes de que se
  // diligencien los hitos que permiten avanzar a la siguiente etapa.
  next['Acción a impulsar'] = 'Analizar el caso';

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
    KEY_FECHA_INSISTENCIA_1,
    KEY_FECHA_INSISTENCIA_2,
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
    'Fecha de la decisión del recurso',
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
  allowUnknownValue = false,
  readOnly = false,
  disabled = false,
  required = true,
  showObligatoria = false,
  minDate = '',
  maxDate = '',
}) {
  const isDisabled = Boolean(readOnly || disabled);
  const canClear = isCampoLimpiableDesdeBloque3(name) && !isDefensorFieldName(name);
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
    const rawValue = value === '-' ? '' : String(value ?? '');
    const normalizedOptions = (options || OPCIONES_SI_NO).map((opt) => {
      const optionValue = typeof opt === 'string' ? opt : String(opt?.value ?? '');
      const optionLabel = typeof opt === 'string' ? opt : String(opt?.label ?? opt?.value ?? '');
      return { value: optionValue, label: optionLabel };
    });
    const normalizedRawValue = normalizeFieldKey(rawValue);
    const matchedOption = normalizedOptions.find((opt) => {
      const normalizedOptionValue = normalizeFieldKey(opt.value);
      const normalizedOptionLabel = normalizeFieldKey(opt.label);
      return (
        opt.value === rawValue ||
        normalizedOptionValue === normalizedRawValue ||
        normalizedOptionLabel === normalizedRawValue ||
        (normalizedRawValue === 's' && normalizedOptionLabel === 'si') ||
        (normalizedRawValue === 'n' && normalizedOptionLabel === 'no')
      );
    });
    const unknownOption = allowUnknownValue && rawValue && !matchedOption
      ? { value: rawValue, label: rawValue }
      : null;
    const visibleOptions = unknownOption ? [unknownOption, ...normalizedOptions] : normalizedOptions;
    const normalizedValue = matchedOption ? matchedOption.value : unknownOption?.value || '';
    const hasDashOption = normalizedOptions.some((opt) => String(opt?.value ?? '').trim() === '-');
    const selectedLabel = visibleOptions.find((opt) => opt.value === normalizedValue)?.label ?? '';
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
          {visibleOptions.map((opt, idx) => {
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

  if (type === 'catalog-datalist') {
    const normalizedOptions = (options || [])
      .map((opt) => (typeof opt === 'string' ? opt : String(opt?.label ?? opt?.value ?? '')))
      .map((opt) => String(opt ?? '').trim())
      .filter(Boolean);
    const safeName = String(name ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-');
    const listId = `catalog-${safeName || 'campo'}`;
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
            e.target.setCustomValidity('');
            if (!isDisabled) onChange(name, e.target.value);
          }}
          onBlur={(e) => {
            if (isDisabled || !String(e.target.value || '').trim()) return;
            const canonicalValue = resolveControlledCatalogValue(e.target.value, normalizedOptions);
            if (canonicalValue) {
              e.target.setCustomValidity('');
              if (canonicalValue !== e.target.value) onChange(name, canonicalValue);
              return;
            }
            e.target.setCustomValidity('Seleccione una opción válida del catálogo.');
          }}
          readOnly={isDisabled}
          disabled={isDisabled}
          required={required}
          autoComplete="off"
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
    const normalizedMin = toDateInputValue(minDate);
    const normalizedMax = toDateInputValue(maxDate);
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
          min={normalizedMin || undefined}
          max={normalizedMax || undefined}
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

function CampoCheckboxMultiple({
  label,
  name,
  value,
  onChange,
  options,
  readOnly = false,
  disabled = false,
  showObligatoria = false,
  exclusiveOption = '',
}) {
  const isDisabled = Boolean(readOnly || disabled);
  const selected = Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : [];
  const selectedSet = new Set(selected.map((item) => normalizeFieldName(item)));
  const normalizedExclusive = normalizeFieldName(exclusiveOption);

  const toggleOption = (option, checked) => {
    const text = String(option ?? '').trim();
    const normalized = normalizeFieldName(text);
    let next = [...selected];

    if (checked) {
      if (normalizedExclusive && normalized === normalizedExclusive) {
        next = [text];
      } else {
        next = next.filter((item) => normalizeFieldName(item) !== normalizedExclusive);
        if (!selectedSet.has(normalized)) next.push(text);
      }
    } else {
      next = next.filter((item) => normalizeFieldName(item) !== normalized);
    }

    onChange(name, next);
  };

  return (
    <div className={`form-field${isDisabled ? ' is-disabled' : ''}`} style={{ gridColumn: '1 / -1' }}>
      <label>
        {displayText(label)}
        {showObligatoria && <span className="required-note"> *Obligatoria*</span>}
      </label>
      <div className="checkbox-multiple-options">
        {(options || []).map((opt, idx) => {
          const optionText = String(opt ?? '').trim();
          const normalizedOption = normalizeFieldName(optionText);
          const isExclusive = Boolean(normalizedExclusive && normalizedOption === normalizedExclusive);
          const isSelected = selectedSet.has(normalizedOption);
          return (
            <label
              key={`${idx}-${optionText}`}
              className={`checkbox-multiple-option${isExclusive ? ' is-exclusive' : ''}${isSelected ? ' is-selected' : ''}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr)',
                alignItems: 'start',
                justifyContent: 'flex-start',
                columnGap: '0.45rem',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled}
                onChange={(e) => toggleOption(optionText, e.target.checked)}
                style={{ marginTop: '0.12rem' }}
              />
              <span style={{ textAlign: 'left' }}>
                {displayText(optionText)}
                {isExclusive && <small className="checkbox-exclusive-note">No combinar con otras opciones</small>}
              </span>
            </label>
          );
        })}
      </div>
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
  const [mostrarCrearDefensor, setMostrarCrearDefensor] = useState(false);
  const [crearDefensorCedula, setCrearDefensorCedula] = useState('');
  const [crearDefensorNombre, setCrearDefensorNombre] = useState('');
  const [crearDefensorEstado, setCrearDefensorEstado] = useState('');
  const [guardandoDefensor, setGuardandoDefensor] = useState(false);
  const [ubicacionCatalogo, setUbicacionCatalogo] = useState({
    departamentos: [],
    municipios: [],
    centros: [],
  });
  const [ubicacionCatalogoDependiente, setUbicacionCatalogoDependiente] = useState({
    municipios: [],
    centros: [],
  });
  const [actuacionesCalificacion, setActuacionesCalificacion] = useState([]);
  const [calificacionesDraft, setCalificacionesDraft] = useState({});
  const bloque2AuroraRef = useRef(null);
  const formularioDetalleRef = useRef(null);
  const defensoresRefreshAtRef = useRef(0);

  const triggerFormularioAutoScroll = useCallback(() => {
    if (typeof window === 'undefined') return;

    const scrollAttempt = (attempt = 0) => {
      const target = formularioDetalleRef.current;
      if (!target) {
        if (attempt < 5) {
          window.setTimeout(() => scrollAttempt(attempt + 1), 70);
        }
        return;
      }

      const targetTop = window.scrollY + target.getBoundingClientRect().top + 68;
      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth',
      });
    };

    window.requestAnimationFrame(() => scrollAttempt(0));
  }, []);

  useEffect(() => {
    if (numeroInicial) buscarRegistro(numeroInicial);
  }, [numeroInicial]);

  const cargarDefensoresFormulario = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now - defensoresRefreshAtRef.current < 5000) return;
    defensoresRefreshAtRef.current = now;

    try {
      const catalogo = await getDefensoresCatalogo();
      setDefensoresCatalogo(Array.isArray(catalogo) ? catalogo : []);
    } catch (e) {
      reportError(e, 'formulario-entrevista:defensores-catalogo');
    }
  }, []);

  useEffect(() => {
    cargarDefensoresFormulario({ force: true });
  }, [cargarDefensoresFormulario]);

  useEffect(() => {
    let active = true;
    getCondenadosFilterOptions({ tipo: 'all' })
      .then((data) => {
        if (!active) return;
        setUbicacionCatalogo({
          departamentos: Array.isArray(data?.departamentos) ? data.departamentos : [],
          municipios: Array.isArray(data?.municipios) ? data.municipios : [],
          centros: Array.isArray(data?.centros) ? data.centros : [],
        });
      })
      .catch((e) => reportError(e, 'formulario-entrevista:catalogo-ubicacion'));
    return () => {
      active = false;
    };
  }, []);

  const departamentoReclusionActual = String(registro?.[CAMPO_DEPARTAMENTO_RECLUSION] ?? '').trim();
  const municipioReclusionActual = String(registro?.[CAMPO_MUNICIPIO_RECLUSION] ?? '').trim();

  useEffect(() => {
    let active = true;
    setUbicacionCatalogoDependiente({ municipios: [], centros: [] });
    const timeoutId = window.setTimeout(() => {
      if (!departamentoReclusionActual && !municipioReclusionActual) {
        return;
      }
      getCondenadosFilterOptions({
        tipo: 'all',
        filters: {
          departamento: departamentoReclusionActual,
          municipio: municipioReclusionActual,
        },
      })
        .then((data) => {
          if (!active) return;
          setUbicacionCatalogoDependiente({
            municipios: Array.isArray(data?.municipios) ? data.municipios : [],
            centros: Array.isArray(data?.centros) ? data.centros : [],
          });
        })
        .catch((e) => reportError(e, 'formulario-entrevista:catalogo-ubicacion-dependiente'));
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [departamentoReclusionActual, municipioReclusionActual]);

  useEffect(() => {
    const refrescarDefensores = () => cargarDefensoresFormulario({ force: true });
    const refrescarSiVisible = () => {
      if (document.visibilityState === 'visible') refrescarDefensores();
    };

    window.addEventListener('focus', refrescarDefensores);
    window.addEventListener('aurora:defensores-updated', refrescarDefensores);
    document.addEventListener('visibilitychange', refrescarSiVisible);
    return () => {
      window.removeEventListener('focus', refrescarDefensores);
      window.removeEventListener('aurora:defensores-updated', refrescarDefensores);
      document.removeEventListener('visibilitychange', refrescarSiVisible);
    };
  }, [cargarDefensoresFormulario]);

  const opcionesDefensores = useMemo(() => {
    const dedup = new Set();
    defensoresCatalogo.forEach((item) => {
      const nombre = String(item?.nombre ?? '').trim();
      if (nombre) dedup.add(nombre);
    });
    return Array.from(dedup).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [defensoresCatalogo]);

  async function guardarDefensorDesdeFormulario() {
    const cedula = String(crearDefensorCedula || '').replace(/\D+/g, '');
    const nombre = normalizeDefensorNombre(crearDefensorNombre);
    setCrearDefensorEstado('');

    if (!cedula) {
      setCrearDefensorEstado('La cédula del defensor es obligatoria.');
      return;
    }
    if (!nombre) {
      setCrearDefensorEstado('El nombre del defensor es obligatorio.');
      return;
    }
    if (!/^[A-Z\s]+$/.test(nombre)) {
      setCrearDefensorEstado('El nombre solo puede contener letras y espacios.');
      return;
    }
    if (opcionesDefensores.some((item) => normalizeDefensorNombre(item) === nombre)) {
      setCrearDefensorEstado('El defensor ya existe en el catálogo.');
      return;
    }

    setGuardandoDefensor(true);
    try {
      const data = await createDefensor({ cedula, nombre });
      const creado = normalizeDefensorNombre(data?.opcion?.nombre || data?.defensor || nombre);
      const opcion = {
        id: String(data?.opcion?.id || cedula),
        nombre: creado,
      };
      setDefensoresCatalogo((prev) => {
        const restantes = (Array.isArray(prev) ? prev : []).filter(
          (item) => normalizeDefensorNombre(item?.nombre) !== creado
        );
        return [...restantes, opcion];
      });
      handleChange('Defensor(a) Público(a) Asignado para tramitar la solicitud', creado);
      setCrearDefensorCedula('');
      setCrearDefensorNombre('');
      setCrearDefensorEstado('Defensor creado y seleccionado.');
      setMostrarCrearDefensor(false);
      await cargarDefensoresFormulario({ force: true });
      window.dispatchEvent(new CustomEvent('aurora:defensores-updated'));
    } catch (e) {
      reportError(e, 'formulario-entrevista:crear-defensor');
      setCrearDefensorEstado(String(e?.message || 'No fue posible crear el defensor.'));
    } finally {
      setGuardandoDefensor(false);
    }
  }

  function renderCrearDefensorCompacto() {
    return (
      <div className="defensor-create-inline">
        <div className="defensor-create-inline__actions">
          <button
            className="secondary-button defensor-create-inline__toggle"
            type="button"
            onClick={() => {
              setMostrarCrearDefensor((value) => !value);
              setCrearDefensorEstado('');
            }}
          >
            {mostrarCrearDefensor ? 'Cancelar' : 'Crear defensor'}
          </button>
          <button
            className="secondary-button defensor-create-inline__toggle"
            type="button"
            onClick={handleLimpiarDefensor}
            disabled={!getDefensorAsignadoValue(registro)}
          >
            Limpiar defensor
          </button>
        </div>
        {mostrarCrearDefensor && (
          <div className="defensor-create-inline__form">
            <div className="form-field">
              <label>Cédula</label>
              <input
                type="text"
                inputMode="numeric"
                value={crearDefensorCedula}
                onChange={(event) => setCrearDefensorCedula(String(event.target.value || '').replace(/\D+/g, ''))}
                placeholder="Número de cédula"
              />
            </div>
            <div className="form-field">
              <label>Nombre completo</label>
              <input
                type="text"
                value={crearDefensorNombre}
                onChange={(event) => setCrearDefensorNombre(normalizeDefensorNombre(event.target.value))}
                placeholder="NOMBRE EN MAYÚSCULA"
              />
            </div>
            <button
              className="primary-button defensor-create-inline__save"
              type="button"
              onClick={guardarDefensorDesdeFormulario}
              disabled={guardandoDefensor}
            >
              {guardandoDefensor ? 'Guardando…' : 'Guardar defensor'}
            </button>
          </div>
        )}
        {crearDefensorEstado && <p className="hint-text">{crearDefensorEstado}</p>}
      </div>
    );
  }

  const centroReclusionActual = String(registro?.[CAMPO_ESTABLECIMIENTO] ?? '').trim();
  const opcionesDepartamentosReclusion = useMemo(
    () => appendCurrentCatalogValue(ubicacionCatalogo.departamentos, departamentoReclusionActual),
    [ubicacionCatalogo.departamentos, departamentoReclusionActual]
  );
  const opcionesMunicipiosReclusion = useMemo(() => {
    const source = departamentoReclusionActual
      ? ubicacionCatalogoDependiente.municipios
      : ubicacionCatalogo.municipios;
    return appendCurrentCatalogValue(source, municipioReclusionActual);
  }, [departamentoReclusionActual, municipioReclusionActual, ubicacionCatalogo.municipios, ubicacionCatalogoDependiente.municipios]);
  const centroReclusionCanonico = useMemo(() => {
    const allCentros = [...ubicacionCatalogo.centros, ...ubicacionCatalogoDependiente.centros];
    return resolveCentroCatalogLabel(centroReclusionActual, allCentros) || centroReclusionActual;
  }, [centroReclusionActual, ubicacionCatalogo.centros, ubicacionCatalogoDependiente.centros]);
  const opcionesCentrosReclusion = useMemo(() => {
    const source = departamentoReclusionActual || municipioReclusionActual
      ? ubicacionCatalogoDependiente.centros
      : ubicacionCatalogo.centros;
    return appendCurrentCatalogValue(source.map((centro) => centro?.label), centroReclusionCanonico);
  }, [departamentoReclusionActual, municipioReclusionActual, centroReclusionCanonico, ubicacionCatalogo.centros, ubicacionCatalogoDependiente.centros]);

  const flow = useMemo(() => (registro ? computeFlow(registro, tipoRegistro) : null), [registro, tipoRegistro]);
  const personaFueraPrision = useMemo(() => Boolean(registro) && !isSituacionActiva(registro), [registro]);
  const cambioSituacionRegistrado = Boolean(
    registro?.__historialActivoInactivo ?? registro?.tieneHistorialActivoInactivo
  );
  const fechaCambioSituacion = formatDateForExport(
    registro?.['Fecha de corte'] ?? registro?.fechaCorte ?? ''
  );
  const tieneInfoDesdePregunta29 = useCallback((source) => {
    if (!source || typeof source !== 'object') return false;
    return CAMPOS_AURORA_DESDE_P29.some((alias) =>
      isMeaningfullyFilled(readRegistroTextByAliases(source, [alias]))
    );
  }, []);
  const tiempoPrivacionMeses = useMemo(() => {
    if (!registro) return '';

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
      const explicit = source.numeroIdentificacion ?? source['Número de identificación'] ?? source['Numero de identificacion'];
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
    if (personaFueraPrision) return;
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
        if (nextValue.trim()) delete base.__desasignarDefensor;
        return wrapRegistroForLookup(base);
      }

      const normalizedName = normalizeFieldName(name);
      if (normalizedName === normalizeFieldName(CAMPO_DEPARTAMENTO_RECLUSION)) {
        setFieldValueAcrossAliases(base, CAMPO_DEPARTAMENTO_RECLUSION, value);
        setFieldValueAcrossAliases(base, CAMPO_MUNICIPIO_RECLUSION, '');
        setFieldValueAcrossAliases(base, CAMPO_ESTABLECIMIENTO, '');
        return wrapRegistroForLookup(base);
      }
      if (normalizedName === normalizeFieldName(CAMPO_MUNICIPIO_RECLUSION)) {
        setFieldValueAcrossAliases(base, CAMPO_MUNICIPIO_RECLUSION, value);
        setFieldValueAcrossAliases(base, CAMPO_ESTABLECIMIENTO, '');
        return wrapRegistroForLookup(base);
      }
      if (normalizedName === normalizeFieldName(CAMPO_ESTABLECIMIENTO)) {
        setFieldValueAcrossAliases(base, CAMPO_ESTABLECIMIENTO, value);
        return wrapRegistroForLookup(base);
      }
      const isResumenAnalisis = RESUMEN_ANALISIS_KEYS.some((alias) => normalizeFieldName(alias) === normalizedName);
      if (isResumenAnalisis) {
        RESUMEN_ANALISIS_KEYS.forEach((key) => {
          setFieldValueAcrossAliases(base, key, value);
        });
        return wrapRegistroForLookup(base);
      }

      const isP36 = normalizedName === normalizeFieldName('Otras solicitudes a tramitar');
      if (isP36) {
        const rawSelections = Array.isArray(value) ? value : parseP36Selections(value);
        const sanitizedSelections = rawSelections
          .map((item) => String(item ?? '').trim())
          .filter(Boolean)
          .filter((item, idx, arr) => {
            const normalizedItem = normalizeFieldName(item);
            return arr.findIndex((candidate) => normalizeFieldName(candidate) === normalizedItem) === idx;
          });
        const hasNinguna = sanitizedSelections.some((item) => normalizeFieldName(item) === normalizeFieldName('Ninguna'));
        const nextSelections =
          hasNinguna && sanitizedSelections.length > 1
            ? sanitizedSelections.filter((item) => normalizeFieldName(item) !== normalizeFieldName('Ninguna'))
            : sanitizedSelections;
        const serialized = serializeP36Selections(nextSelections);
        setFieldValueAcrossAliases(base, name, serialized);
        return wrapRegistroForLookup(base);
      }

      const isSePresentaRecurso = ALIASES_SE_PRESENTA_RECURSO.some(
        (alias) => normalizeFieldName(alias) === normalizedName
      );
      if (isSePresentaRecurso) {
        ALIASES_SE_PRESENTA_RECURSO.forEach((key) => {
          setFieldValueAcrossAliases(base, key, value);
        });
        return wrapRegistroForLookup(base);
      }

      const isRadicacionUtilidad = ALIASES_RADICACION_UTILIDAD.some(
        (alias) => normalizeFieldName(alias) === normalizedName
      );
      if (isRadicacionUtilidad) {
        ALIASES_RADICACION_UTILIDAD.forEach((key) => {
          setFieldValueAcrossAliases(base, key, value);
        });
        return wrapRegistroForLookup(base);
      }

      const isCelesteQ21Actuacion =
        flow === 'sindicado' &&
        ALIASES_CELESTE_Q21_ACTUACION.some((alias) => normalizeFieldName(alias) === normalizedName);
      if (isCelesteQ21Actuacion) {
        ALIASES_CELESTE_Q21_ACTUACION.forEach((key) => {
          setFieldValueAcrossAliases(base, key, value);
        });
        return wrapRegistroForLookup(base);
      }

      setFieldValueAcrossAliases(base, name, value);
      return wrapRegistroForLookup(base);
    });
  }

  function handleLimpiarDefensor() {
    if (personaFueraPrision) return;
    setRegistro((prev) => {
      const base = { ...unwrapRegistro(prev) };
      Object.keys(base).forEach((key) => {
        if (isDefensorFieldName(key)) base[key] = '';
      });
      DEFENSOR_DIRECT_KEYS.forEach((key) => {
        base[key] = '';
      });
      base.__desasignarDefensor = true;
      return wrapRegistroForLookup(base);
    });
    setCrearDefensorEstado('Defensor eliminado del formulario. Guarde los cambios para desasignar el caso.');
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
    triggerFormularioAutoScroll();
  }

  function handleIniciarPrimeraActuacion(options = {}) {
    if (personaFueraPrision && !options?.soloConsulta) {
      setError('La persona figura fuera de prisión. El registro está disponible solo para consulta.');
      return;
    }
    if (!registro || !getDocumentoActual(registro)) {
      setError('Debe cargar un usuario antes de actualizar la actuacion.');
      return;
    }

    setError('');
    setGuardadoOk(false);
    setToastOpen(false);
    setActuacionActivaId('');
    setMostrarFormularioDetalle(true);
    triggerFormularioAutoScroll();
  }

  async function handleCrearNuevaActuacion(options = {}) {
    if (personaFueraPrision) {
      setError('La persona figura fuera de prisión. No se pueden crear nuevas actuaciones.');
      return;
    }
    if (!registro) {
      setError('Debe cargar un usuario antes de crear una nueva actuacion.');
      return;
    }

    const doc = getDocumentoActual(registro);
    if (!doc) {
      setError('Debe cargar un usuario antes de crear una nueva actuacion.');
      return;
    }
    if (
      shouldBlockNuevaActuacion({
        flow,
        actuaciones: actuacionesCalificacion,
        hasInfoDesdePregunta29: tieneInfoDesdePregunta29,
      })
    ) {
      const mensajeBloqueo =
        'No se puede crear una nueva actuacion porque la ultima actuacion disponible para actualizacion aun no tiene datos desde la pregunta 29. Por favor actualice o diligencie primero ese formulario y luego cree una nueva actuacion.';
      setError(mensajeBloqueo);
      setToastMessage(mensajeBloqueo);
      setToastOpen(true);
      return;
    }

    setCreandoActuacion(true);
    try {
      const nextDraft = buildNuevaActuacionDraft(registro);
      const response = await createPplActuacion(doc, { data: nextDraft });
      if (isQueuedResponse(response)) {
        setError('');
        setToastMessage('Nueva actuacion guardada en cola. Se creara automaticamente cuando vuelva la conexion.');
        setToastOpen(true);
        return;
      }
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
      if (options?.abrirFormulario) triggerFormularioAutoScroll();
      setHistorialRefreshToken((prev) => prev + 1);
    } catch (e) {
      reportError(e, 'formulario-entrevista:crear-actuacion');
      setError('No fue posible iniciar una nueva actuacion para este PPL.');
    } finally {
      setCreandoActuacion(false);
    }
  }

  const habilitarPregunta35 = useMemo(() => {
    return isEquivalenteSi(registro?.['Procedencia de acumulación de penas']);
  }, [registro]);

  const cierreRegla1Bloque3 = useMemo(() => {
    if (!registro) return false;
    const solicitudesP36 = parseP36Selections(
      readRegistroTextByAliases(registro, ['Otras solicitudes a tramitar']) || registro?.['Otras solicitudes a tramitar']
    );
    const tieneNingunaExplicita =
      solicitudesP36.length === 1 &&
      normalizeFieldName(solicitudesP36[0]) === normalizeFieldName('Ninguna');
    if (!tieneNingunaExplicita) return false;

    const fechaAnalisis = readRegistroTextByAliases(registro, [
      'Fecha de análisis jurídico del caso',
      'Fecha de analisis juridico del caso',
    ]);
    if (!isMeaningfullyFilled(fechaAnalisis)) return false;

    const respuestasConProcedencia = [
      registro['Procedencia de libertad condicional'],
      registro['Procedencia de prisión domiciliaria de mitad de pena'],
      registro['Procedencia de utilidad pública (solo para mujeres)'],
      registro['Procedencia de pena cumplida'],
      registro['Procedencia de acumulación de penas'],
    ];
    const preguntasClaveRespondidas = [
      registro['Procedencia de libertad condicional'],
      registro['Procedencia de prisión domiciliaria de mitad de pena'],
      registro['Procedencia de pena cumplida'],
      registro['Procedencia de acumulación de penas'],
    ];

    const todasRespondidas = preguntasClaveRespondidas.every((v) => isMeaningfullyFilled(v));
    if (!todasRespondidas) return false;

    return !respuestasConProcedencia.some((v) => isProcedenciaAfirmativa(v));
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
    () => {
      const actuacion = norm(actuacionAdelantar);
      if (!actuacion) return false;
      return actuacion.includes('ninguna') || actuacion.includes('no procede nada');
    },
    [actuacionAdelantar]
  );
  const actuacionIncluyeUtilidadPublica = useMemo(
    () => ACTUACIONES_UTILIDAD_PUBLICA_NORMALIZADAS.has(norm(maybeDecodeUtf8Mojibake(actuacionAdelantar))),
    [actuacionAdelantar]
  );
  const otrasSolicitudesSeleccionadas = useMemo(
    () =>
      parseP36Selections(
        readRegistroTextByAliases(registro, ['Otras solicitudes a tramitar']) || registro?.['Otras solicitudes a tramitar']
      ),
    [registro]
  );
  const requierePruebasBloque4 = useMemo(() => readRegistroTextByAliases(registro, ['Requiere pruebas']), [registro]);
  const habilitarRecepcionPruebasTramite = useMemo(
    () => isEquivalenteSi(requierePruebasBloque4),
    [requierePruebasBloque4]
  );
  const sePresentaRecursoBloque5 = useMemo(
    () => readRegistroTextByAliases(registro, ALIASES_SE_PRESENTA_RECURSO),
    [registro]
  );
  const fechaPresentacionRecursoBloque5 = useMemo(
    () =>
      readRegistroTextByAliases(registro, [
        KEY_FECHA_PRESENTACION_RECURSO,
        KEY_FECHA_RECURSO_AURORA_LEGACY,
        'Fecha de presentacion del recurso',
      ]),
    [registro]
  );
  const fechaDecisionRecursoBloque5 = useMemo(
    () =>
      readRegistroTextByAliases(registro, [
        KEY_FECHA_DECISION_RECURSO,
        'Fecha de la decision del recurso',
      ]),
    [registro]
  );
  const recursoNoPresentadoBloque5 = useMemo(() => isEquivalenteNo(sePresentaRecursoBloque5), [sePresentaRecursoBloque5]);
  const sentidoResuelveRecursoBloque5 = useMemo(
    () => readRegistroTextByAliases(registro, ['Sentido de la decisión que resuelve recurso', 'Sentido de la decision que resuelve recurso']),
    [registro]
  );
  const sentidoResuelveSolicitudBloque5 = useMemo(
    () =>
      readRegistroTextByAliases(registro, [
        'Sentido de la decisión que resuelve la solicitud',
        'Sentido de la decision que resuelve la solicitud',
      ]),
    [registro]
  );
  const motivoDecisionNegativaBloque5 = useMemo(
    () => readRegistroTextByAliases(registro, ['Motivo de la decisión negativa', 'Motivo de la decision negativa']),
    [registro]
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
  const saltoAuroraDesdeCeleste = false;
  const auroraActivo = useMemo(() => flow === 'condenado' || saltoAuroraDesdeCeleste, [flow, saltoAuroraDesdeCeleste]);
  const maxAllowedFutureDateIso = useMemo(() => buildTodayPlusDaysIso(30), []);
  const fechaRecepcionPruebasTramite = useMemo(
    () =>
      readRegistroTextByAliases(registro, [
        'Fecha de recepción de pruebas aportadas por el usuario (si aplica)',
        'Fecha de recepcion de pruebas aportadas por el usuario (si aplica)',
      ]),
    [registro]
  );
  const fechaPresentacionSolicitudTramite = useMemo(
    () =>
      readRegistroTextByAliases(registro, [
        'Fecha de presentación de la solicitud a la autoridad',
        'Fecha de presentacion de la solicitud a la autoridad',
        'Fecha de presentación de solicitud a la autoridad',
        'Fecha de presentacion de solicitud a la autoridad',
      ]),
    [registro]
  );
  const fechaDecisionAutoridadBloque5 = useMemo(
    () => readRegistroTextByAliases(registro, ['Fecha de decisión de la autoridad', 'Fecha de decision de la autoridad']),
    [registro]
  );
  const fechaRecepcionPruebasUtilidad = useMemo(
    () => readRegistroTextByAliases(registro, ['Fecha en la que se reciben todas las pruebas']),
    [registro]
  );
  const fechaPresentacionSolicitudUtilidad = useMemo(
    () => readRegistroTextByAliases(registro, ALIASES_RADICACION_UTILIDAD),
    [registro]
  );
  const minFechaPresentacionTramiteIso = useMemo(
    () => toIsoDateString(fechaRecepcionPruebasTramite),
    [fechaRecepcionPruebasTramite]
  );
  const minFechaDecisionTramiteIso = useMemo(
    () => toIsoDateString(fechaPresentacionSolicitudTramite),
    [fechaPresentacionSolicitudTramite]
  );
  const minFechaPresentacionUtilidadIso = useMemo(
    () => toIsoDateString(fechaRecepcionPruebasUtilidad),
    [fechaRecepcionPruebasUtilidad]
  );
  const minFechaDecisionUtilidadIso = useMemo(
    () => toIsoDateString(fechaPresentacionSolicitudUtilidad),
    [fechaPresentacionSolicitudUtilidad]
  );
  const getDateValidationError = useCallback(() => {
    if (!auroraActivo) return '';

    const secuenciaTramite = [
      {
        label: '43. Fecha de recepción de pruebas aportadas por el usuario (si aplica)',
        iso: toIsoDateString(fechaRecepcionPruebasTramite),
      },
      {
        label: '45. Fecha de presentación de la solicitud a la autoridad',
        iso: toIsoDateString(fechaPresentacionSolicitudTramite),
      },
      {
        label: '46. Fecha de decisión de la autoridad',
        iso: toIsoDateString(fechaDecisionAutoridadBloque5),
      },
    ];

    const secuenciaUtilidad = [
      { label: '49. Fecha en la que se reciben todas las pruebas', iso: toIsoDateString(fechaRecepcionPruebasUtilidad) },
      { label: '50. Fecha de radicación de solicitud de utilidad pública', iso: toIsoDateString(fechaPresentacionSolicitudUtilidad) },
      { label: '51. Fecha de decisión de la autoridad', iso: toIsoDateString(fechaDecisionAutoridadBloque5) },
    ];

    const fechas = [...secuenciaTramite, ...secuenciaUtilidad].filter((item) => item.iso);
    const futura = fechas.find((item) => isIsoDateAfter(item.iso, maxAllowedFutureDateIso));
    if (futura) {
      return `${futura.label} no puede superar ${maxAllowedFutureDateIso} (hoy + 30 días).`;
    }

    for (let i = 1; i < secuenciaTramite.length; i += 1) {
      const prev = secuenciaTramite[i - 1];
      const curr = secuenciaTramite[i];
      if (!prev.iso || !curr.iso) continue;
      if (isIsoDateAfter(prev.iso, curr.iso)) {
        return `${curr.label} debe ser igual o posterior a ${prev.label}.`;
      }
    }

    for (let i = 1; i < secuenciaUtilidad.length; i += 1) {
      const prev = secuenciaUtilidad[i - 1];
      const curr = secuenciaUtilidad[i];
      if (!prev.iso || !curr.iso) continue;
      if (isIsoDateAfter(prev.iso, curr.iso)) {
        return `${curr.label} debe ser igual o posterior a ${prev.label}.`;
      }
    }

    return '';
  }, [
    auroraActivo,
    fechaRecepcionPruebasTramite,
    fechaPresentacionSolicitudTramite,
    fechaDecisionAutoridadBloque5,
    fechaRecepcionPruebasUtilidad,
    fechaPresentacionSolicitudUtilidad,
    maxAllowedFutureDateIso,
  ]);

  const calificacionActual = useMemo(() => buildCalificacionSnapshot(registro), [registro]);
  const calificacionesDesdeBase = useMemo(() => {
    const rows = normalizeCalificacionesConductaRows(registro?.__calificacionesConducta);
    return rows.some((item) => hasCalificacionSnapshotData(item)) ? rows : [];
  }, [registro]);
  const calificacionesAnteriores = useMemo(() => {
    if (calificacionesDesdeBase.length) return calificacionesDesdeBase.slice(1);
    const rows = Array.isArray(actuacionesCalificacion) ? actuacionesCalificacion : [];
    if (!rows.length) return [];

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

    const anteriores = [];
    for (let idx = activeIndex - 1; idx >= 0; idx -= 1) {
      const snapshot = buildCalificacionSnapshot(sortedRows[idx]?.registro);
      if (!hasCalificacionSnapshotData(snapshot)) continue;
      const rowIndex = Number.isFinite(Number(sortedRows[idx]?.rowIndex)) ? Number(sortedRows[idx].rowIndex) : idx;
      const fechaDate = parseDateValue(snapshot.fechaUltimaCalificacion);
      const fechaMs = fechaDate ? fechaDate.getTime() : Number.NEGATIVE_INFINITY;
      const sourceActuacionId = String(sortedRows[idx]?.id ?? '').trim();
      anteriores.push({
        snapshot,
        rowIndex,
        fechaMs,
        sourceActuacionId,
      });
    }

    anteriores.sort((a, b) => {
      if (a.fechaMs !== b.fechaMs) return b.fechaMs - a.fechaMs;
      return b.rowIndex - a.rowIndex;
    });

    return anteriores.slice(0, 3).map((item) => ({
      ...item.snapshot,
      sourceActuacionId: item.sourceActuacionId,
    }));
  }, [actuacionesCalificacion, actuacionActivaId, calificacionesDesdeBase]);

  const calificacionesCompactas = useMemo(() => {
    if (calificacionesDesdeBase.length) {
      return [0, 1, 2, 3].map((idx) => ({
        id: `calificacion-${idx + 1}`,
        label: idx === 0 ? '26. Calificación actual (más reciente)' : `Calificación ${idx + 1}`,
        sourceActuacionId: idx === 0 ? String(actuacionActivaId ?? '').trim() : '',
        ...(calificacionesDesdeBase[idx] || buildCalificacionSnapshot(null)),
      }));
    }

    const items = [
      {
        id: 'calificacion-1',
        label: '26. Calificación actual (más reciente)',
        sourceActuacionId: String(actuacionActivaId ?? '').trim(),
        ...calificacionActual,
      },
    ];

    for (let index = 0; index < 3; index += 1) {
      const snapshot = calificacionesAnteriores[index] || { ...buildCalificacionSnapshot(null), sourceActuacionId: '' };
      items.push({
        id: `calificacion-${index + 2}`,
        label: `Calificación ${index + 2}`,
        ...snapshot,
      });
    }

    return items;
  }, [calificacionActual, calificacionesAnteriores, actuacionActivaId, calificacionesDesdeBase]);

  useEffect(() => {
    const nextDraft = {};
    calificacionesCompactas.forEach((item) => {
      nextDraft[item.id] = {
        sourceActuacionId: String(item.sourceActuacionId ?? '').trim(),
        fechaUltimaCalificacion: String(item.fechaUltimaCalificacion ?? ''),
        numeroActa: String(item.numeroActa ?? ''),
        evaluacionDesde: String(item.evaluacionDesde ?? ''),
        evaluacionHasta: String(item.evaluacionHasta ?? ''),
        calificacionConducta: String(item.calificacionConducta ?? ''),
      };
    });
    setCalificacionesDraft(nextDraft);
  }, [calificacionesCompactas]);

  const getCalificacionDraftValue = useCallback(
    (item, key) => {
      const rowId = String(item?.id ?? '');
      if (!rowId) return String(item?.[key] ?? '');
      const draft = calificacionesDraft?.[rowId];
      if (draft && Object.prototype.hasOwnProperty.call(draft, key)) return String(draft?.[key] ?? '');
      return String(item?.[key] ?? '');
    },
    [calificacionesDraft]
  );

  const handleCalificacionDraftChange = useCallback((rowId, key, value) => {
    const safeRowId = String(rowId ?? '').trim();
    const safeKey = String(key ?? '').trim();
    if (!safeRowId || !safeKey) return;
    setCalificacionesDraft((prev) => {
      const currentRow = prev?.[safeRowId] && typeof prev[safeRowId] === 'object' ? prev[safeRowId] : {};
      return {
        ...(prev || {}),
        [safeRowId]: {
          ...currentRow,
          [safeKey]: value,
        },
      };
    });
  }, []);

  const cierrePorDecisionFinalBloque5 = useMemo(() => {
    if (!auroraActivo) return false;
    const cierrePorQ57 =
      isCierreImposibilidadSeleccionado(cierreImposibilidadTramite) ||
      isCierreImposibilidadSeleccionado(cierreImposibilidadUtilidad);
    const cierrePorQ52Utilidad =
      actuacionIncluyeUtilidadPublica &&
      isFilled(sentidoDecisionBloque5) &&
      norm(sentidoDecisionBloque5) !== norm('Niega utilidad pública');
    const cierrePorQ47Tramite =
      !actuacionIncluyeUtilidadPublica &&
      isFilled(sentidoDecisionBloque5) &&
      !isNoConcedeSubrogadoPenal(sentidoDecisionBloque5);
    return cierrePorQ57 || cierrePorQ52Utilidad || cierrePorQ47Tramite;
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
  const auroraDisabledFieldsNormalized = useMemo(
    () => new Set(Array.from(auroraDisabledFields).map((field) => normalizeFieldName(field))),
    [auroraDisabledFields]
  );
  const isAuroraFieldDisabled = useCallback(
    (name, base = false) => Boolean(base || auroraDisabledFieldsNormalized.has(normalizeFieldName(name))),
    [auroraDisabledFieldsNormalized]
  );
  const celesteRuleState = useMemo(
    () => evaluateCelesteRules({ answers: registro || {} }),
    [registro]
  );
  const celesteVisibleBlocks = useMemo(
    () => new Set(celesteRuleState?.visibleBlocks || []),
    [celesteRuleState]
  );
  const getMissingRequiredAuroraByBlock = useCallback(
    (blockId) => {
      if (!registro) return [];
      const fields = auroraFormRules?.mandatoryByBlock?.[blockId] || [];
      const normalizedQ36 = normalizeFieldName('Otras solicitudes a tramitar');
      return fields
        .filter((field) => !field.optional)
        .filter((field) => !isAuroraFieldDisabled(field.key))
        .filter((field) => {
          const value = readRegistroTextByAliases(registro, [field.key]);
          if (normalizeFieldName(field.key) === normalizedQ36) return !hasValidP36Selection(value);
          return !isMeaningfullyFilled(value);
        })
        .map((field) => String(field?.label || field?.key || '').trim())
        .filter(Boolean);
    },
    [registro, isAuroraFieldDisabled]
  );
  const hasAnyAuroraDataInBlock = useCallback(
    (blockId) => {
      if (!registro) return false;
      const fields = auroraFormRules?.mandatoryByBlock?.[blockId] || [];
      const normalizedQ36 = normalizeFieldName('Otras solicitudes a tramitar');
      return fields.some((field) => {
        const value = readRegistroTextByAliases(registro, [field.key]);
        if (normalizeFieldName(field.key) === normalizedQ36) return hasValidP36Selection(value);
        return isMeaningfullyFilled(value);
      });
    },
    [registro]
  );
  const missingRequiredAuroraOnSave = useMemo(() => {
    if (!auroraActivo) return [];

    const blocksToValidate = [];
    if (hasAnyAuroraDataInBlock('bloque3')) blocksToValidate.push('bloque3');
    if (auroraVisibleBlocks.has('bloque4') && hasAnyAuroraDataInBlock('bloque4')) blocksToValidate.push('bloque4');
    if (
      auroraVisibleBlocks.has('bloque5UtilidadPublica') &&
      hasAnyAuroraDataInBlock('bloque5UtilidadPublica')
    ) {
      blocksToValidate.push('bloque5UtilidadPublica');
    }
    if (
      auroraVisibleBlocks.has('bloque5TramiteNormal') &&
      hasAnyAuroraDataInBlock('bloque5TramiteNormal')
    ) {
      blocksToValidate.push('bloque5TramiteNormal');
    }

    const missing = blocksToValidate.flatMap((blockId) => getMissingRequiredAuroraByBlock(blockId));
    return Array.from(new Set(missing));
  }, [auroraActivo, auroraVisibleBlocks, hasAnyAuroraDataInBlock, getMissingRequiredAuroraByBlock]);

  const defensorAsignadoBloque3 = useMemo(() => getDefensorAsignadoValue(registro), [registro]);

  const mensajeBloqueoAvanceBloque3 = useMemo(() => {
    if (!registro || !auroraActivo) return '';
    if (!auroraVisibleBlocks.has('bloque3') || auroraVisibleBlocks.has('bloque4')) return '';
    if (auroraRuleState?.locked) return '';
    if (cierreRegla1Bloque3) return '';
    const missingBloque3 = getMissingRequiredAuroraByBlock('bloque3');
    if (!missingBloque3.length) {
      return 'No se puede avanzar al Bloque 4 porque no hay una procedencia positiva o solicitud a tramitar en el Bloque 3.';
    }
    if (!defensorAsignadoBloque3) {
      return 'No se puede avanzar al Bloque 4. Falta completar la pregunta 28 (Defensor(a) publico(a) asignado para tramitar la solicitud).';
    }
    return 'No se puede avanzar al Bloque 4. Completa los campos obligatorios del Bloque 3.';
  }, [
    registro,
    auroraActivo,
    auroraVisibleBlocks,
    auroraRuleState,
    cierreRegla1Bloque3,
    defensorAsignadoBloque3,
    getMissingRequiredAuroraByBlock,
  ]);

  const casoCerrado = useMemo(() => {
    const bloque5Visible =
      auroraVisibleBlocks.has('bloque5UtilidadPublica') ||
      auroraVisibleBlocks.has('bloque5TramiteNormal');
    if (auroraActivo && bloque5Visible && cierrePorDecisionFinalBloque5) return true;

    // BLOQUE 4
    if (auroraActivo && decisionUsuarioBloquea) return true;
    if (auroraActivo && actuacionBloqueaPorNinguna) return true;

    // BLOQUE 3 (Caso cerrado - Regla 1)
    if (auroraActivo && cierreRegla1Bloque3) return true;

    // BLOQUE 5A
    const cumpleMarginalidad = String(registro?.['Cumple el requisito de marginalidad'] ?? '').trim();
    const cumpleJefatura = String(registro?.['Cumple el requisito de jefatura de hogar'] ?? '').trim();
    if (auroraActivo && bloque5Visible && actuacionIncluyeUtilidadPublica) {
      if (cumpleMarginalidad === 'No' || cumpleJefatura === 'No') return true;
      if (recursoNoPresentadoBloque5) return true;
      if (sentidoResuelveRecursoBloque5) return true;
    }

    // BLOQUE 5B
    if (auroraActivo && bloque5Visible && !actuacionIncluyeUtilidadPublica) {
      if (isFilled(sentidoDecisionBloque5) && !isNoConcedeSubrogadoPenal(sentidoDecisionBloque5)) return true;
      if (recursoNoPresentadoBloque5) return true;
      if (sentidoResuelveSolicitudBloque5) return true;
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
    sentidoDecisionBloque5,
    recursoNoPresentadoBloque5,
    sentidoResuelveRecursoBloque5,
    sentidoResuelveSolicitudBloque5,
    auroraVisibleBlocks,
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
      if (
        !actuacionIncluyeUtilidadPublica &&
        isFilled(sentidoDecisionBloque5) &&
        !isNoConcedeSubrogadoPenal(sentidoDecisionBloque5)
      ) {
        return `Caso cerrado por decisión de la autoridad (pregunta 47): ${sentidoDecisionBloque5}.`;
      }
      return 'Caso cerrado por resultado final del bloque 5.';
    }
    if (auroraActivo && cierreRegla1Bloque3) {
      return 'Caso cerrado: en las preguntas 30 a 34 no se marcó procedencia para la solicitud.';
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
      if (recursoNoPresentadoBloque5) return 'Caso cerrado: no se presenta recurso.';
      if (sentidoResuelveRecursoBloque5) {
        return `Caso cerrado: decisión que resuelve recurso = ${sentidoResuelveRecursoBloque5}.`;
      }
    }

    if (auroraActivo && !actuacionIncluyeUtilidadPublica) {
      if (isFilled(sentidoDecisionBloque5) && !isNoConcedeSubrogadoPenal(sentidoDecisionBloque5)) {
        return `Caso cerrado por decisión de la autoridad (pregunta 47): ${sentidoDecisionBloque5}.`;
      }
      if (recursoNoPresentadoBloque5) return 'Caso cerrado: no se presenta recurso.';
      if (sentidoResuelveSolicitudBloque5) {
        return `Caso cerrado: decisión que resuelve la solicitud = ${sentidoResuelveSolicitudBloque5}.`;
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
    recursoNoPresentadoBloque5,
    sentidoResuelveRecursoBloque5,
    sentidoResuelveSolicitudBloque5,
  ]);

  const bloqueCierre = useMemo(() => {
    if (!registro) return '';
    const bloque5Visible =
      auroraVisibleBlocks.has('bloque5UtilidadPublica') ||
      auroraVisibleBlocks.has('bloque5TramiteNormal');
    if (auroraActivo && bloque5Visible && cierrePorDecisionFinalBloque5) return 'bloque5';
    if (auroraActivo && decisionUsuarioBloquea) return 'bloque4';
    if (auroraActivo && actuacionBloqueaPorNinguna) return 'bloque4';
    if (auroraActivo && cierreRegla1Bloque3) return 'bloque3';

    const cumpleMarginalidad = String(registro?.['Cumple el requisito de marginalidad'] ?? '').trim();
    const cumpleJefatura = String(registro?.['Cumple el requisito de jefatura de hogar'] ?? '').trim();
    if (auroraActivo && bloque5Visible && actuacionIncluyeUtilidadPublica) {
      if (cumpleMarginalidad === 'No' || cumpleJefatura === 'No') return 'bloque5';
      if (recursoNoPresentadoBloque5) return 'bloque5';
      if (sentidoResuelveRecursoBloque5) return 'bloque5';
    }

    if (auroraActivo && bloque5Visible && !actuacionIncluyeUtilidadPublica) {
      if (isFilled(sentidoDecisionBloque5) && !isNoConcedeSubrogadoPenal(sentidoDecisionBloque5)) return 'bloque5';
      if (recursoNoPresentadoBloque5) return 'bloque5';
      if (sentidoResuelveSolicitudBloque5) return 'bloque5';
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
    sentidoDecisionBloque5,
    recursoNoPresentadoBloque5,
    sentidoResuelveRecursoBloque5,
    sentidoResuelveSolicitudBloque5,
    auroraVisibleBlocks,
  ]);

  useEffect(() => {
    if (!registro || !auroraActivo) return;
    const next = casoCerrado ? 'Cerrado' : 'Activo';
    const current = String(registro['Estado del caso'] ?? '').trim();
    if (current === next) return;
    setRegistro((prev) => {
      if (!prev) return prev;
      const cur = String(prev['Estado del caso'] ?? '').trim();
      if (cur === next) return prev;
      return wrapRegistroForLookup({ ...unwrapRegistro(prev), 'Estado del caso': next });
    });
  }, [registro, auroraActivo, casoCerrado]);

  useEffect(() => {
    if (!registro || !auroraActivo || !cierrePorDecisionFinalBloque5) return;
    const bloque5Visible =
      auroraVisibleBlocks.has('bloque5UtilidadPublica') ||
      auroraVisibleBlocks.has('bloque5TramiteNormal');
    if (!bloque5Visible) return;
    const doc = getDocumentoActual(registro);
    if (!doc) return;
    const estadoActual = String(registro['Estado del caso'] ?? '').trim();
    if (estadoActual === 'Cerrado') return;

    const persistirCierreAutomatico = async () => {
      try {
        const nextRecord = {
          ...unwrapRegistro(registro),
          'Estado del caso': 'Cerrado',
          'Acción a impulsar': 'Caso cerrado',
        };
        if (!String(nextRecord['Cierre del caso por imposibilidad de avanzar (si aplica)'] ?? '').trim()) {
          nextRecord['Cierre del caso por imposibilidad de avanzar (si aplica)'] = motivoCierre || 'Caso cerrado';
        }
        const updated = await updatePpl(doc, buildUpdatePayload(nextRecord));
        setRegistro(wrapRegistroForLookup(nextRecord));
        setToastMessage(
          isQueuedResponse(updated)
            ? 'Caso cerrado guardado en cola. Se sincronizara cuando vuelva la conexion.'
            : 'Caso cerrado y avances guardados autom\u00E1ticamente'
        );
        setToastOpen(true);
        setGuardadoOk(true);
        setHistorialRefreshToken((prev) => prev + 1);
      } catch (e) {
        reportError(e, 'formulario-entrevista:cierre-automatico');
        setError('Se intent\u00F3 guardar el cierre autom\u00E1tico, pero ocurri\u00F3 un error.');
      }
    };

    persistirCierreAutomatico();
  }, [registro, auroraActivo, cierrePorDecisionFinalBloque5, auroraVisibleBlocks, getDocumentoActual, buildUpdatePayload, motivoCierre]);

  useEffect(() => {
    if (!registro || !auroraActivo) return;
    const next = String(auroraRuleState?.derivedStatus || '').trim();
    if (!next) return;
    const current = String(registro['Estado del trámite'] ?? '').trim();
    const currentAction = String(registro['Acción a impulsar'] ?? '').trim();
    if (current === next && currentAction === next) return;
    setRegistro((prev) => {
      if (!prev) return prev;
      const cur = String(prev['Estado del trámite'] ?? '').trim();
      const curAction = String(prev['Acción a impulsar'] ?? '').trim();
      if (cur === next && curAction === next) return prev;
      return wrapRegistroForLookup({
        ...unwrapRegistro(prev),
        'Estado del trámite': next,
        'Acción a impulsar': next,
      });
    });
  }, [registro, auroraActivo, auroraRuleState]);

  useEffect(() => {
    if (!registro || !auroraActivo) return;
    if (!auroraRuleState?.locked) return;
    const reason = String(auroraRuleState.lockReason || 'El formulario está bloqueado por reglas de negocio.');
    setError(reason);
  }, [registro, auroraActivo, auroraRuleState]);

  useEffect(() => {
    if (!registro || flow !== 'sindicado') return;
    if (!celesteRuleState?.locked) return;
    const reason = String(celesteRuleState.lockReason || 'Se cierra el caso');
    setError(reason);
  }, [registro, flow, celesteRuleState]);

  useEffect(() => {
    if (!registro || flow !== 'sindicado') return;
    const estadoTramiteSindicado = String(celesteRuleState?.derivedStatus || '').trim();
    if (!estadoTramiteSindicado) return;

    setRegistro((prev) => {
      if (!prev) return prev;
      const currentTramite = String(prev['Estado del trámite'] ?? '').trim();
      const currentAccion = String(prev['Acción a impulsar'] ?? prev['Acción a realizar'] ?? '').trim();
      const nextCaso = estadoTramiteSindicado === 'Caso cerrado' ? 'Cerrado' : 'Activo';
      const currentCaso = String(prev['Estado del caso'] ?? '').trim();
      if (
        currentTramite === estadoTramiteSindicado &&
        currentAccion === estadoTramiteSindicado &&
        currentCaso === nextCaso
      ) {
        return prev;
      }

      return wrapRegistroForLookup({
        ...unwrapRegistro(prev),
        'Estado del trámite': estadoTramiteSindicado,
        'Acción a impulsar': estadoTramiteSindicado,
        'Estado del caso': nextCaso,
      });
    });
  }, [registro, flow, celesteRuleState]);

  useEffect(() => {
    // REGLA: P35 solo se habilita si P34 = "Sí". Si no, queda deshabilitada y vacía.
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
    const sentido = String(sentidoDecisionBloque5 ?? '').trim();
    const sentidoResuelve = String(sentidoResuelveRecursoBloque5 ?? '').trim();
    return sentido === 'Niega utilidad pública' || sentidoResuelve === 'Niega utilidad pública';
  }, [sentidoDecisionBloque5, sentidoResuelveRecursoBloque5]);

  const habilitarNegativaTramiteNormal = useMemo(() => {
    if (!auroraActivo) return false;
    if (actuacionIncluyeUtilidadPublica) return false;
    const sentido = String(sentidoDecisionBloque5 ?? '').trim();
    return isNoConcedeSubrogadoPenal(sentido);
  }, [auroraActivo, actuacionIncluyeUtilidadPublica, sentidoDecisionBloque5]);

  useEffect(() => {
    // Regla: AURORA.B5B.DEPENDENCIA.5
    // En trámite normal, si Q41 != "Sí", limpiar Q43 (recepción de pruebas aportadas).
    if (!registro || !auroraActivo || actuacionIncluyeUtilidadPublica) return;
    if (habilitarRecepcionPruebasTramite) return;

    const key = 'Fecha de recepción de pruebas aportadas por el usuario (si aplica)';
    setRegistro((prev) => {
      if (!prev) return prev;
      const current = readRegistroTextByAliases(prev, [key, 'Fecha de recepcion de pruebas aportadas por el usuario (si aplica)']);
      if (!current) return prev;
      const next = { ...unwrapRegistro(prev) };
      setFieldValueAcrossAliases(next, key, '');
      return wrapRegistroForLookup(next);
    });
  }, [registro, auroraActivo, actuacionIncluyeUtilidadPublica, habilitarRecepcionPruebasTramite]);

  useEffect(() => {
    // Regla: AURORA.B5A.LIMPIEZA.1
    // Si no aplica negativa de utilidad publica, limpiar campos de motivo/recurso en 5A.
    if (!registro || !auroraActivo || !actuacionIncluyeUtilidadPublica) return;
    if (habilitarNegativaUtilidadPublica) return;

    const keys = [
      'Motivo de la decisión negativa',
      'Se presenta recurso',
      KEY_FECHA_RECURSO_AURORA_LEGACY,
      KEY_FECHA_PRESENTACION_RECURSO,
      KEY_FECHA_DECISION_RECURSO,
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
  }, [registro, auroraActivo, actuacionIncluyeUtilidadPublica, habilitarNegativaUtilidadPublica]);

  useEffect(() => {
    // Compatibilidad retroactiva: migra etiquetas históricas de Q47 a las nuevas.
    if (!registro || !auroraActivo || actuacionIncluyeUtilidadPublica) return;
    const current = readRegistroTextByAliases(registro, ['Sentido de la decisión', 'Sentido de la decision']);
    const normalized = normalizeSentidoDecisionTramite(current);
    if (!normalized || normalized === String(current ?? '').trim()) return;
    setRegistro((prev) => {
      if (!prev) return prev;
      const now = readRegistroTextByAliases(prev, ['Sentido de la decisión', 'Sentido de la decision']);
      if (normalized === String(now ?? '').trim()) return prev;
      const next = { ...unwrapRegistro(prev) };
      setFieldValueAcrossAliases(next, 'Sentido de la decisión', normalized);
      return wrapRegistroForLookup(next);
    });
  }, [registro, auroraActivo, actuacionIncluyeUtilidadPublica]);

  useEffect(() => {
    // Regla: AURORA.B5B.DEPENDENCIA.4
    // Si en tramite normal Q47 != "No concede la solicitud", limpiar motivo y campos de recurso.
    if (!registro || !auroraActivo || actuacionIncluyeUtilidadPublica) return;
    if (habilitarNegativaTramiteNormal) return;

    const keys = [
      'Motivo de la decisión negativa',
      'Se presenta recurso',
      KEY_FECHA_RECURSO_AURORA_LEGACY,
      KEY_FECHA_PRESENTACION_RECURSO,
      KEY_FECHA_DECISION_RECURSO,
      'Sentido de la decisión que resuelve la solicitud',
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
    if (isEquivalenteSi(sePresentaRecursoBloque5)) return;

    const keys = [
      KEY_FECHA_RECURSO_AURORA_LEGACY,
      KEY_FECHA_PRESENTACION_RECURSO,
      KEY_FECHA_DECISION_RECURSO,
      'Sentido de la decisión que resuelve la solicitud',
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
  }, [registro, auroraActivo, actuacionIncluyeUtilidadPublica, habilitarNegativaTramiteNormal, sePresentaRecursoBloque5]);

  const habilitarCelesteMotivoNegativa = useMemo(() => {
    const sentido = String(registro?.['SENTIDO DE LA DECISIÓN'] ?? '').trim();
    return norm(sentido) === norm('Niega la solicitud');
  }, [registro]);

  const habilitarCelesteRecurso = useMemo(() => {
    const v = String(registro?.['¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?'] ?? '').trim();
    return isEquivalenteSi(v);
  }, [registro]);

  useEffect(() => {
    // Regla: CELESTE.B5.DEPENDENCIA.3
    // Si C_Q26 != "Niega la solicitud", limpiar motivo de decision negativa.
    if (!registro || flow !== 'sindicado') return;
    if (habilitarCelesteMotivoNegativa) return;

    const key = 'MOTIVO DE LA DECISIÓN NEGATIVA';
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
    if (!registro || flow !== 'sindicado') return;
    if (habilitarCelesteRecurso) return;
    setRegistro((prev) => {
      if (!prev) return prev;
      const keys = [
        'Fecha de presentación del recurso',
        'Fecha de la decisión del recurso',
        'SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO',
      ];
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
  }, [registro, flow, habilitarCelesteRecurso]);

  function handleGenerarPdfCasoActual() {
    if (!registro) {
      setError('Debe cargar un caso antes de generar el PDF.');
      return;
    }

    const getRawValue = (field) => {
      if (Object.prototype.hasOwnProperty.call(field, 'value')) return field.value;
      const aliases = [field.key, ...(Array.isArray(field.aliases) ? field.aliases : [])].filter(Boolean);
      if (!aliases.length) return '';
      if (isDefensorFieldName(field.key)) return getDefensorAsignadoValue(registro);
      return readRegistroTextByAliases(registro, aliases);
    };

    const formatExportValue = (rawValue, field = {}) => {
      const fallback = 'Sin dato';
      if (Array.isArray(rawValue)) {
        const joined = rawValue.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
        if (!joined) return fallback;
        return displayText(joined);
      }
      let text = String(rawValue ?? '').trim();
      if (!text) return fallback;

      if (field.isPercentage) {
        text = formatPercentageDisplayValue(text);
      } else if (field.isDate) {
        text = formatDateForExport(text);
      }

      const normalizedKey = normalizeFieldName(field.key || field.label || '');
      if (normalizedKey === normalizeFieldName('Otras solicitudes a tramitar')) {
        const parsed = parseP36Selections(text);
        if (parsed.length) text = parsed.join(', ');
      }

      return displayText(text);
    };

    const mapFields = (fields) =>
      fields.map((field) => ({
        label: displayText(field.label),
        value: formatExportValue(getRawValue(field), field),
      }));

    const calificacionesResumen = calificacionesCompactas
      .map((item) => {
        const fecha = formatExportValue(getCalificacionDraftValue(item, 'fechaUltimaCalificacion'), { isDate: true });
        const acta = formatExportValue(getCalificacionDraftValue(item, 'numeroActa'));
        const desde = formatExportValue(getCalificacionDraftValue(item, 'evaluacionDesde'), { isDate: true });
        const hasta = formatExportValue(getCalificacionDraftValue(item, 'evaluacionHasta'), { isDate: true });
        const conducta = formatExportValue(getCalificacionDraftValue(item, 'calificacionConducta'));
        return `${displayText(item.label)} | Fecha última: ${fecha} | Acta: ${acta} | Desde: ${desde} | Hasta: ${hasta} | Conducta: ${conducta}`;
      })
      .join('\n');

    const sections = [
      {
        title: 'BLOQUE 1. Información de la persona privada de la libertad',
        fields: mapFields(EXPORT_FIELDS_BLOQUE_1),
      },
    ];

    if (flow === 'condenado') {
      if (auroraVisibleBlocks.has('bloque2Aurora')) {
        const fieldsBloque2 = [
          ...EXPORT_FIELDS_AURORA_BLOQUE_2.slice(0, 4),
          {
            label: 'Fuente de información',
            value: registro?.['Fuente de información'] ?? registro?.fuenteInformacion ?? '',
          },
          {
            label: 'Fecha de actualización de los datos (corte)',
            value: registro?.['Fecha de corte'] ?? registro?.fechaCorte ?? '',
            isDate: true,
          },
          ...EXPORT_FIELDS_AURORA_BLOQUE_2.slice(4),
          {
            label: 'Días restantes para cumplir requisito temporal de prisión domiciliaria',
            value: diasRestantesPrisionDomiciliaria,
          },
          {
            label: 'Días restantes para cumplir requisito temporal de libertad condicional',
            value: diasRestantesLibertadCondicional,
          },
          {
            label: '26-27. Resumen de calificaciones de conducta (últimas 4)',
            value: calificacionesResumen,
          },
        ];
        sections.push({
          title: 'BLOQUE 2 (AURORA) - Información del proceso SISIPEC',
          fields: mapFields(fieldsBloque2),
        });
      }

      if (auroraVisibleBlocks.has('bloque3')) {
        sections.push({
          title: 'BLOQUE 3 - Análisis jurídico',
          fields: mapFields(EXPORT_FIELDS_AURORA_BLOQUE_3),
        });
      }

      if (auroraVisibleBlocks.has('bloque4')) {
        sections.push({
          title: 'BLOQUE 4 - Entrevista con el usuario',
          fields: mapFields(EXPORT_FIELDS_AURORA_BLOQUE_4),
        });
      }

      if (auroraVisibleBlocks.has('bloque5UtilidadPublica')) {
        const fieldsBloque5Utilidad = EXPORT_FIELDS_AURORA_BLOQUE_5_UTILIDAD.map((field) => {
          if (field.key === 'Fecha en la que se reciben todas las pruebas') {
            return { ...field, value: fechaRecepcionPruebasUtilidad };
          }
          if (field.key === 'Fecha de radicación de solicitud de utilidad pública') {
            return { ...field, value: fechaPresentacionSolicitudUtilidad };
          }
          return field;
        });
        sections.push({
          title: 'BLOQUE 5. Utilidad pública',
          fields: mapFields(fieldsBloque5Utilidad),
        });
      }

      if (auroraVisibleBlocks.has('bloque5TramiteNormal')) {
        const fieldsBloque5Tramite = EXPORT_FIELDS_AURORA_BLOQUE_5_TRAMITE.map((field) => {
          if (field.key === 'Fecha de recepción de pruebas aportadas por el usuario (si aplica)') {
            return { ...field, value: fechaRecepcionPruebasTramite };
          }
          if (field.key === 'Fecha de presentación de la solicitud a la autoridad') {
            return { ...field, value: fechaPresentacionSolicitudTramite };
          }
          return field;
        });
        sections.push({
          title: 'BLOQUE 5. Trámite de la solicitud',
          fields: mapFields(fieldsBloque5Tramite),
        });
      }
    }

    if (flow === 'sindicado') {
      if (celesteVisibleBlocks.has('bloque2Celeste')) {
        const fieldsBloque2Celeste = [
          ...EXPORT_FIELDS_CELESTE_BLOQUE_2.slice(0, 4),
          {
            label: '18. Tiempo que la persona lleva privada de la libertad (en meses)',
            value: tiempoPrivacionMeses || readRegistroTextByAliases(registro, ['TIEMPO QUE LA PERSONA LLEVA PRIVADA DE LA LIBERTAD (EN MESES)']),
          },
        ];
        sections.push({
          title: 'BLOQUE 2 (SINDICADOS) - Información del proceso SISIPEC',
          fields: mapFields(fieldsBloque2Celeste),
        });
      }
      if (celesteVisibleBlocks.has('bloque3Celeste')) {
        sections.push({
          title: 'BLOQUE 3 (SINDICADOS) - Análisis jurídico',
          fields: mapFields(EXPORT_FIELDS_CELESTE_BLOQUE_3),
        });
      }
      if (celesteVisibleBlocks.has('bloque4Celeste')) {
        sections.push({
          title: 'BLOQUE 4 (SINDICADOS) - Entrevista con el usuario',
          fields: mapFields(EXPORT_FIELDS_CELESTE_BLOQUE_4),
        });
      }
      if (celesteVisibleBlocks.has('bloque5Celeste')) {
        sections.push({
          title: 'BLOQUE 5 (SINDICADOS) - Trámite de la solicitud',
          fields: mapFields(EXPORT_FIELDS_CELESTE_BLOQUE_5),
        });
      }
    }

    const metadata = [
      { label: 'Documento', value: getDocumentoActual(registro) || 'Sin dato' },
      { label: 'Nombre', value: displayText(String(registro?.['Nombre'] ?? '').trim()) || 'Sin dato' },
      { label: 'Flujo', value: flow === 'condenado' ? 'AURORA (Condenado)' : flow === 'sindicado' ? 'CELESTE (Sindicado)' : 'No definido' },
      {
        label: 'Acción a impulsar',
        value: displayText(
          registro?.['Acción a impulsar'] ??
          registro?.['Acción a realizar'] ??
          registro?.['Estado del trámite'] ??
          ''
        ) || 'Sin dato',
      },
      { label: 'Actuación activa', value: actuacionActivaId || 'Sin dato' },
      {
        label: 'Fecha de generación',
        value: new Date().toLocaleString('es-CO', {
          dateStyle: 'long',
          timeStyle: 'short',
        }),
      },
    ];

    const metadataHtml = metadata
      .map((row) => `<li><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.value)}</li>`)
      .join('');

    const sectionsHtml = sections
      .map((section) => {
        const rows = section.fields
          .map((field) => {
            const safeValue = escapeHtml(field.value).replace(/\n/g, '<br />');
            return `<tr><th>${escapeHtml(field.label)}</th><td>${safeValue}</td></tr>`;
          })
          .join('');

        return `
          <section class="pdf-section">
            <h2>${escapeHtml(section.title)}</h2>
            <table>
              <tbody>${rows}</tbody>
            </table>
          </section>
        `;
      })
      .join('');

    const html = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Reporte Caso Actual</title>
          <style>
            :root { color-scheme: light; }
            body { font-family: Arial, sans-serif; margin: 24px; color: #1d1d1d; line-height: 1.35; }
            h1 { font-size: 20px; margin: 0 0 10px; }
            h2 { font-size: 16px; margin: 22px 0 8px; border-bottom: 1px solid #d9d9d9; padding-bottom: 4px; }
            ul { margin: 0 0 18px 18px; padding: 0; }
            li { margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #d9d9d9; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 12px; word-break: break-word; }
            th { background: #f5f5f5; width: 38%; }
            .pdf-section { break-inside: avoid; }
            @media print {
              body { margin: 10mm; }
              h2 { break-after: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>Reporte del caso actual (Bloques 1 a 5)</h1>
          <ul>${metadataHtml}</ul>
          ${sectionsHtml}
          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const popup = window.open('', '_blank');
    if (!popup) {
      setError('No se pudo abrir la vista de impresión. Habilite ventanas emergentes e intente de nuevo.');
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    downloadConsolidadoPdf({
      metadata,
      sections,
      fileName: buildConsolidadoPdfFileName(getDocumentoActual(registro)),
    }).catch((err) => {
      reportError(err, 'formulario-entrevista:descargar-consolidado-pdf');
      setToastMessage('El consolidado se abrió para impresión, pero no fue posible descargar el PDF automáticamente.');
      setToastOpen(true);
    });
  }

  async function handleGuardar() {
    if (personaFueraPrision) {
      setError('La persona figura fuera de prisión. El registro histórico no se puede editar.');
      return;
    }
    const doc = getDocumentoActual(registro);
    if (!doc) {
      setError('Debe cargar un usuario antes de guardar.');
      return;
    }
    const ubicacionesControladas = [
      {
        label: 'nombre del lugar de privación de la libertad',
        value: centroReclusionCanonico,
        options: opcionesCentrosReclusion,
      },
      {
        label: 'departamento del lugar de privación de la libertad',
        value: departamentoReclusionActual,
        options: opcionesDepartamentosReclusion,
      },
      {
        label: 'distrito/municipio del lugar de privación de la libertad',
        value: municipioReclusionActual,
        options: opcionesMunicipiosReclusion,
      },
    ];
    const ubicacionInvalida = ubicacionesControladas.find(
      ({ value, options }) => String(value || '').trim() && !resolveControlledCatalogValue(value, options)
    );
    if (ubicacionInvalida) {
      const message = `Seleccione un ${ubicacionInvalida.label} válido del catálogo.`;
      setError(message);
      setToastMessage(message);
      setToastOpen(true);
      return;
    }
    const defensorIngresado = getDefensorAsignadoValue(registro);
    const defensorCatalogado = resolveControlledCatalogValue(defensorIngresado, opcionesDefensores);
    if (String(defensorIngresado || '').trim() && !defensorCatalogado) {
      const message = 'Seleccione un defensor válido del catálogo o créelo antes de guardar.';
      setError(message);
      setToastMessage(message);
      setToastOpen(true);
      return;
    }
    const dateValidationError = getDateValidationError();
    if (dateValidationError) {
      setError(dateValidationError);
      setToastMessage(dateValidationError);
      setToastOpen(true);
      return;
    }
    const allowPartialAuroraSave = auroraActivo && missingRequiredAuroraOnSave.length > 0;
    const partialSaveMessage = allowPartialAuroraSave
      ? `Guardado parcial: el bloque iniciado no está completo. Falta diligenciar: ${missingRequiredAuroraOnSave.join(
          ', '
        )}.`
      : '';

    try {
      setError('');
      setToastOpen(false);
      const payloadBase = { ...unwrapRegistro(registro) };
      setFieldValueAcrossAliases(
        payloadBase,
        CAMPO_ESTABLECIMIENTO,
        resolveControlledCatalogValue(centroReclusionCanonico, opcionesCentrosReclusion)
      );
      setFieldValueAcrossAliases(
        payloadBase,
        CAMPO_DEPARTAMENTO_RECLUSION,
        resolveControlledCatalogValue(departamentoReclusionActual, opcionesDepartamentosReclusion)
      );
      setFieldValueAcrossAliases(
        payloadBase,
        CAMPO_MUNICIPIO_RECLUSION,
        resolveControlledCatalogValue(municipioReclusionActual, opcionesMunicipiosReclusion)
      );
      if (defensorCatalogado) {
        DEFENSOR_DIRECT_KEYS.forEach((key) => {
          payloadBase[key] = defensorCatalogado;
        });
      }
      const calificacionesPersistibles = calificacionesCompactas.map((item) => {
        const draft = calificacionesDraft?.[item.id] || {};
        const originalSnapshot = {
          fechaUltimaCalificacion: String(item.fechaUltimaCalificacion ?? ''),
          numeroActa: String(item.numeroActa ?? ''),
          evaluacionDesde: String(item.evaluacionDesde ?? ''),
          evaluacionHasta: String(item.evaluacionHasta ?? ''),
          calificacionConducta: String(item.calificacionConducta ?? ''),
        };
        const nextSnapshot = {
          fechaUltimaCalificacion: String(draft.fechaUltimaCalificacion ?? originalSnapshot.fechaUltimaCalificacion ?? ''),
          numeroActa: String(draft.numeroActa ?? originalSnapshot.numeroActa ?? ''),
          evaluacionDesde: String(draft.evaluacionDesde ?? originalSnapshot.evaluacionDesde ?? ''),
          evaluacionHasta: String(draft.evaluacionHasta ?? originalSnapshot.evaluacionHasta ?? ''),
          calificacionConducta: String(draft.calificacionConducta ?? originalSnapshot.calificacionConducta ?? ''),
        };
        const hasChanges =
          String(nextSnapshot.fechaUltimaCalificacion).trim() !== String(originalSnapshot.fechaUltimaCalificacion).trim() ||
          String(nextSnapshot.numeroActa).trim() !== String(originalSnapshot.numeroActa).trim() ||
          String(nextSnapshot.evaluacionDesde).trim() !== String(originalSnapshot.evaluacionDesde).trim() ||
          String(nextSnapshot.evaluacionHasta).trim() !== String(originalSnapshot.evaluacionHasta).trim() ||
          String(nextSnapshot.calificacionConducta).trim() !== String(originalSnapshot.calificacionConducta).trim();
        return {
          id: String(item.id ?? ''),
          sourceActuacionId: String(draft.sourceActuacionId ?? item.sourceActuacionId ?? '').trim(),
          hasChanges,
          snapshot: nextSnapshot,
        };
      });

      const filaActualCalificacion = calificacionesPersistibles.find((item) => item.id === 'calificacion-1');
      if (filaActualCalificacion) {
        applyCalificacionSnapshotToRecord(payloadBase, filaActualCalificacion.snapshot);
      }
      payloadBase.__calificacionesConducta = calificacionesPersistibles
        .slice(0, 4)
        .map((item) => ({ ...(item.snapshot || buildCalificacionSnapshot(null)) }));
      if (auroraActivo) {
        const recursoActual = readRegistroTextByAliases(payloadBase, ALIASES_SE_PRESENTA_RECURSO);
        if (recursoActual) {
          ALIASES_SE_PRESENTA_RECURSO.forEach((key) => {
            setFieldValueAcrossAliases(payloadBase, key, recursoActual);
          });
        }
        const radicacionUtilidadActual = readRegistroTextByAliases(payloadBase, ALIASES_RADICACION_UTILIDAD);
        if (radicacionUtilidadActual) {
          ALIASES_RADICACION_UTILIDAD.forEach((key) => {
            setFieldValueAcrossAliases(payloadBase, key, radicacionUtilidadActual);
          });
        }
        const estadoTramiteActual = String(auroraRuleState?.derivedStatus || '').trim();
        if (estadoTramiteActual) {
          payloadBase['Estado del trámite'] = estadoTramiteActual;
          payloadBase['Acción a impulsar'] = estadoTramiteActual;
        }
        payloadBase['Estado del caso'] = estadoTramiteActual === 'Caso cerrado' || casoCerrado ? 'Cerrado' : 'Activo';
        if (payloadBase['Estado del caso'] === 'Cerrado' && !String(payloadBase['Cierre del caso por imposibilidad de avanzar (si aplica)'] ?? '').trim()) {
          payloadBase['Cierre del caso por imposibilidad de avanzar (si aplica)'] = motivoCierre || estadoTramiteActual || 'Caso cerrado';
        }
      }
      if (flow === 'sindicado') {
        const actuacionSindicadoActual = readRegistroTextByAliases(payloadBase, ALIASES_CELESTE_Q21_ACTUACION);
        if (actuacionSindicadoActual) {
          ALIASES_CELESTE_Q21_ACTUACION.forEach((key) => {
            setFieldValueAcrossAliases(payloadBase, key, actuacionSindicadoActual);
          });
        }
        const estadoTramiteSindicado = String(celesteRuleState?.derivedStatus || '').trim();
        if (estadoTramiteSindicado) {
          payloadBase['Estado del trámite'] = estadoTramiteSindicado;
          payloadBase['Acción a impulsar'] = estadoTramiteSindicado;
        }
        payloadBase['Estado del caso'] = estadoTramiteSindicado === 'Caso cerrado' ? 'Cerrado' : 'Activo';
      }
      const updated = await updatePpl(doc, buildUpdatePayload(payloadBase));

      const calificacionesHistoricasToUpdate = calificacionesPersistibles.filter(
        (item) => item.id !== 'calificacion-1' && item.hasChanges && item.sourceActuacionId
      );
      for (const row of calificacionesHistoricasToUpdate) {
        const rowPayload = {};
        applyCalificacionSnapshotToRecord(rowPayload, row.snapshot);
        await updatePpl(doc, {
          actuacionId: row.sourceActuacionId,
          data: rowPayload,
        });
      }

      const calificacionesSinDestino = calificacionesPersistibles.filter(
        (item) => item.id !== 'calificacion-1' && item.hasChanges && !item.sourceActuacionId
      );
      const nextTipo = String(updated?.tipo ?? tipoRegistro ?? '').trim();
      if (nextTipo) setTipoRegistro(nextTipo);
      if (updated?.registro && typeof updated.registro === 'object') {
        setRegistro(wrapRegistroForLookup({ ...updated.registro, __tipoApi: nextTipo || tipoRegistro }));
      }

      if (isQueuedResponse(updated)) {
        setToastMessage('Cambios guardados en cola. Se sincronizaran automaticamente cuando vuelva la conexion.');
      } else if (allowPartialAuroraSave) {
        setError(`${partialSaveMessage} Por favor complete el resto del bloque.`);
        setToastMessage(partialSaveMessage);
      } else if (calificacionesSinDestino.length > 0) {
        setToastMessage(
          'Se guardó la calificación actual y antecedentes existentes. Las filas sin actuación previa asociada no se pudieron persistir.'
        );
      } else {
        setToastMessage('Aurora - Cambios guardados correctamente');
      }
      setToastOpen(true);
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
        'Situación Jurídica actualizada (de conformidad con la rama judicial)': nextSituacionActualizada,
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
      // Evita bucle de redirección: no vuelve a guardar/redirigir. Solo navega a AURORA (BLOQUE 2).
      setTipoRegistro('condenado');
      setRegistro((prev) => ({
        ...(prev || {}),
        __tipoApi: 'condenado',
        redirectedToAurora: true,
        'Situación Jurídica': 'Condenado',
        'Situación Jurídica actualizada (de conformidad con la rama judicial)': 'CONDENADO',
      }));
      setAuroraAbrirBloque2(celesteEval.jumpPayload?.startBlock === 2);
      return;
    }

    if (saltoCelesteGuardando) return;

    const next = {
      ...(registro || {}),
      'Situación Jurídica actualizada (de conformidad con la rama judicial)': 'CONDENADO',
      'Acción a impulsar': String(celesteEval?.derivedStatus || 'Analizar el caso'),
      redirectedToAurora: true,
    };

    setSaltoCelesteGuardando(true);
    setError('');
    setToastOpen(false);

    try {
      const updated = await updatePpl(doc, buildUpdatePayload(next));
      setToastMessage(
        isQueuedResponse(updated)
          ? 'Formulario guardado en cola. Se sincronizara cuando vuelva la conexion.'
          : 'Formulario guardado'
      );
      setToastOpen(true);

      // Redirigir/navegar a AURORA del mismo usuario y abrir Bloque 2 como siguiente paso.
      const refreshed = isQueuedResponse(updated) ? null : await getPplByDocumento(doc);
      const r = refreshed?.registro || next;
      const refreshedTipo = String(refreshed?.tipo ?? 'condenado').trim() || 'condenado';
      setTipoRegistro('condenado');

      setRegistro({
        ...(r || next),
        __tipoApi: refreshedTipo,
        // Fuerza el flujo AURORA por regla de salto (sin reiniciar caso).
        redirectedToAurora: true,
        'Situación Jurídica': 'Condenado',
        'Situación Jurídica actualizada (de conformidad con la rama judicial)': 'CONDENADO',
      });
      setAuroraAbrirBloque2(celesteEval.jumpPayload?.startBlock === 2);
    } catch (e) {
      reportError(e, 'formulario-entrevista:salto-celeste-aurora');
      setError('Error al guardar el formulario. No se redirigió a AURORA.');
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
      registro?.['Situación Jurídica actualizada (de conformidad con la rama judicial)'] ??
      '';
    handleSaltoCelesteAAurora(String(value));
  }, [registro, flow, celesteRuleState?.jumpToAurora, handleSaltoCelesteAAurora]);

  const porcentajeAvancePena = parsePercentageValue(registro?.['Porcentaje de avance de pena cumplida']);
  const porcentajeAvancePenaBarra =
    porcentajeAvancePena == null ? null : Math.max(0, Math.min(100, porcentajeAvancePena));
  const penaTotalDias = parseDayCount(registro?.['Pena total en días']);
  const tiempoEfectivoDias = parseDayCount(
    registro?.['Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)']
  );
  const diasRestantesPrisionDomiciliaria = useMemo(() => {
    const desdeBase = String(registro?.Dias_Prision ?? registro?.['Días restantes para cumplir requisito temporal de prisión domiciliaria'] ?? '').trim();
    if (desdeBase !== '') return desdeBase;
    if (!Number.isFinite(penaTotalDias) || !Number.isFinite(tiempoEfectivoDias)) return '';
    const objetivo = Number(penaTotalDias) * 0.5;
    return getRemainingDaysStatus(objetivo - Number(tiempoEfectivoDias));
  }, [penaTotalDias, tiempoEfectivoDias, registro]);
  const diasRestantesLibertadCondicional = useMemo(() => {
    const desdeBase = String(registro?.Dias_libertad ?? registro?.['Días restantes para cumplir requisito temporal de libertad condicional'] ?? '').trim();
    if (desdeBase !== '') return desdeBase;
    if (!Number.isFinite(penaTotalDias) || !Number.isFinite(tiempoEfectivoDias)) return '';
    const objetivo = Number(penaTotalDias) * 0.6;
    return getRemainingDaysStatus(objetivo - Number(tiempoEfectivoDias));
  }, [penaTotalDias, tiempoEfectivoDias, registro]);

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

        {cargando && <p>{displayText('Cargando información...')}</p>}
        {error && <p className="hint-text">{displayText(error)}</p>}
      </div>

      {!cargando && registro && (
        <>
          {cambioSituacionRegistrado && (
            <div className="ppl-situation-change-alert" role="status">
              <span>Cambio de situación registrado</span>
              {fechaCambioSituacion && (
                <small>Fecha de corte: {fechaCambioSituacion}</small>
              )}
            </div>
          )}
          {personaFueraPrision && (
            <div className="ppl-inactive-alert" role="alert" style={{ marginTop: '1rem' }}>
              FUERA DE PRISIÓN — registro histórico disponible solo para consulta. No se permiten modificaciones ni nuevas actuaciones.
            </div>
          )}
          <div className="card" style={{ marginTop: '1rem' }}>
            <HistorialActuacionesPPL
              registro={registro}
              numeroDocumento={getDocumentoActual(registro)}
              onSelectActuacion={handleSeleccionarActuacion}
              onCrearNuevaActuacion={handleCrearNuevaActuacion}
              onIniciarActuacion={handleIniciarPrimeraActuacion}
              refreshToken={historialRefreshToken}
              actuacionActivaId={actuacionActivaId}
              creandoActuacion={creandoActuacion}
              soloLectura={personaFueraPrision}
              onActionLabelChange={handleActionLabelChange}
            />
          </div>

          {!mostrarFormularioDetalle && (
            <p className="hint-text" style={{ marginTop: '0.75rem' }}>
              {displayText(`Vista previa activa. Seleccione "${textoAccionCaso}" para abrir el formulario precargado.`)}
            </p>
          )}

          {mostrarFormularioDetalle && (
          <div ref={formularioDetalleRef} className="card" style={{ marginTop: '1rem' }}>
            {personaFueraPrision && (
              <div className="ppl-inactive-alert" role="status">
                Caso cerrado. La persona figura fuera de prisión y este registro histórico no se puede editar.
              </div>
            )}
            <fieldset className="readonly-form-fieldset" disabled={personaFueraPrision}>
            <h3 className="block-title">{displayText('BLOQUE 1. Información de la persona privada de la libertad')}</h3>

          <div className="grid-2">
            <Campo label="1. Nombre" name="Nombre" value={registro['Nombre']} onChange={handleChange} />

            <Campo
              label="2. Tipo de indentificación"
              name="Tipo de indentificación"
              type="select"
              value={registro['Tipo de indentificación']}
              onChange={handleChange}
              options={OPCIONES_TIPO_IDENTIFICACION}
            />

            <Campo
              label="3. Número de identificación"
              name="Número de identificación"
              value={registro['Número de identificación']}
              onChange={handleChange}
              readOnly={Boolean(String(registro['Número de identificación'] ?? '').trim())}
            />

            <Campo
              label="4. Situación Jurídica"
              name="Situación Jurídica"
              type="select"
              value={registro['Situación Jurídica']}
              onChange={handleChange}
              options={OPCIONES_SITUACION_JURIDICA}
              disabled
            />

            <Campo
              label="5. Género"
              name="Género"
              type="select"
              value={registro['Género']}
              onChange={handleChange}
              options={OPCIONES_GENERO_AURORA}
            />

            <Campo
              label="6. Enfoque diferencial"
              name="Enfoque Étnico/Racial/Cultural"
              type="select"
              value={registro['Enfoque Étnico/Racial/Cultural']}
              onChange={handleChange}
              options={OPCIONES_ENFOQUE_ETNICO}
              allowUnknownValue
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
              label="10. Lugar de privación de la libertad"
              name="Lugar de privación de la libertad"
              type="select"
              value={registro['Lugar de privación de la libertad']}
              onChange={handleChange}
              options={OPCIONES_LUGAR_PRIVACION}
            />

            <Campo
              label="11. Nombre del lugar de privación de la libertad"
              name="Nombre del lugar de privación de la libertad"
              type="catalog-datalist"
              value={centroReclusionCanonico}
              onChange={handleChange}
              options={opcionesCentrosReclusion}
            />

            <Campo
              label="12. Departamento del lugar de privación de la libertad"
              name="Departamento del lugar de privación de la libertad"
              type="catalog-datalist"
              value={registro['Departamento del lugar de privación de la libertad']}
              onChange={handleChange}
              options={opcionesDepartamentosReclusion}
            />

            <Campo
              label="13. Distrito/municipio del lugar de privación de la libertad"
              name="Distrito/municipio del lugar de privación de la libertad"
              type="catalog-datalist"
              value={registro['Distrito/municipio del lugar de privación de la libertad']}
              onChange={handleChange}
              options={opcionesMunicipiosReclusion}
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
                  {displayText('BLOQUE 2 (AURORA) - Información del proceso SISIPEC')}
                </h3>
                <div className="grid-2">
                <Campo
                  label="14. Autoridad a cargo"
                  name="Autoridad a cargo"
                  value={registro['Autoridad a cargo']}
                  onChange={handleChange}
                />
                <Campo
                  label="15. Número de proceso"
                  name="Número de proceso"
                  value={registro['Número de proceso']}
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
                <div className="question-40-highlight">
                  <Campo
                    label="Fuente de información"
                    name="Fuente de información"
                    value={registro['Fuente de información'] ?? registro.fuenteInformacion ?? ''}
                    onChange={handleChange}
                    readOnly
                    required={false}
                  />
                  <Campo
                    label="Fecha de actualización de los datos (corte)"
                    name="Fecha de actualización de los datos (corte)"
                    value={registro['Fecha de corte'] ?? registro.fechaCorte ?? ''}
                    onChange={handleChange}
                    readOnly
                    required={false}
                  />
                </div>
                <Campo
                  label="18. Pena (años, meses y días)"
                  name="Pena (años, meses y días)"
                  value={registro['Pena (años, meses y días)']}
                  onChange={handleChange}
                />
                <Campo
                  label="19. Pena total en días"
                  name="Pena total en días"
                  type="number"
                  value={registro['Pena total en días']}
                  onChange={handleChange}
                />
                <Campo
                  label="20. Tiempo que la persona lleva privada de la libertad (en días)"
                  name="Tiempo que la persona lleva privada de la libertad (en días)"
                  type="number"
                  value={registro['Tiempo que la persona lleva privada de la libertad (en días)']}
                  onChange={handleChange}
                />
                <Campo
                  label="21. Redención total acumulada en días"
                  name="Redención total acumulada en días"
                  type="number"
                  value={registro['Redención total acumulada en días']}
                  onChange={handleChange}
                />
                <Campo
                  label="22. Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)"
                  name="Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)"
                  type="number"
                  value={registro['Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)']}
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
                <div className="remaining-days-field">
                  <Campo
                    label="Días restantes para cumplir requisito temporal de prisión domiciliaria"
                    name="Días restantes para cumplir requisito temporal de prisión domiciliaria"
                    value={diasRestantesPrisionDomiciliaria}
                    onChange={handleChange}
                    readOnly
                    required={false}
                  />
                </div>
                <div className="remaining-days-field">
                  <Campo
                    label="Días restantes para cumplir requisito temporal de libertad condicional"
                    name="Días restantes para cumplir requisito temporal de libertad condicional"
                    value={diasRestantesLibertadCondicional}
                    onChange={handleChange}
                    readOnly
                    required={false}
                  />
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
                  label="25. ¿Cuenta con requerimientos judiciales por otros procesos?"
                  name="¿ Cuenta con requerimientos judiciales por otros procesos ?"
                  type="select"
                  value={registro['¿ Cuenta con requerimientos judiciales por otros procesos ?']}
                  onChange={handleChange}
                  options={OPCIONES_REQUERIMIENTOS_JUDICIALES}
                />
                <div className="form-field calificacion-resumen-field">
                  <label>{displayText('Resumen de calificaciones de conducta (últimas 4)')}</label>
                  <div className="calificacion-resumen-table-wrap">
                    <table className="calificacion-resumen-table">
                      <thead>
                        <tr>
                          <th>{displayText('Registro')}</th>
                          <th>{displayText('Fecha última calificación')}</th>
                          <th>{displayText('Número de acta')}</th>
                          <th>{displayText('Evaluación desde')}</th>
                          <th>{displayText('Evaluación hasta')}</th>
                          <th>{displayText('Calificación de conducta')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calificacionesCompactas.map((item) => (
                          <Fragment key={item.id}>
                            {item.id === 'calificacion-2' && (
                              <tr className="calificacion-resumen-group-row">
                                <td className="calificacion-resumen-group-cell" colSpan={6}>
                                  {displayText('27. Otras calificaciones anteriores:')}
                                </td>
                              </tr>
                            )}
                            <tr>
                              <td className="calificacion-resumen-row-label">{displayText(item.label)}</td>
                              <td>
                                <input
                                  type="date"
                                  name={`${KEY_FECHA_ULTIMA_CALIFICACION}-${item.id}`}
                                  value={toDateInputValue(getCalificacionDraftValue(item, 'fechaUltimaCalificacion'))}
                                  onChange={(e) => handleCalificacionDraftChange(item.id, 'fechaUltimaCalificacion', e.target.value)}
                                  required
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  name={`${KEY_ACTA_CALIFICACION}-${item.id}`}
                                  value={getCalificacionDraftValue(item, 'numeroActa')}
                                  onChange={(e) => handleCalificacionDraftChange(item.id, 'numeroActa', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  name={`${KEY_EVALUACION_DESDE}-${item.id}`}
                                  value={toDateInputValue(getCalificacionDraftValue(item, 'evaluacionDesde'))}
                                  onChange={(e) => handleCalificacionDraftChange(item.id, 'evaluacionDesde', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  name={`${KEY_EVALUACION_HASTA}-${item.id}`}
                                  value={toDateInputValue(getCalificacionDraftValue(item, 'evaluacionHasta'))}
                                  onChange={(e) => handleCalificacionDraftChange(item.id, 'evaluacionHasta', e.target.value)}
                                />
                              </td>
                              <td>
                                <select
                                  name={`${KEY_CALIFICACION_CONDUCTA}-${item.id}`}
                                  value={getCalificacionDraftValue(item, 'calificacionConducta')}
                                  onChange={(e) => handleCalificacionDraftChange(item.id, 'calificacionConducta', e.target.value)}
                                  required
                                >
                                  <option value="" disabled hidden />
                                  {OPCIONES_CALIFICACION_CONDUCTA.map((option) => (
                                    <option key={option} value={option}>
                                      {displayText(option)}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          </Fragment>
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
                <h3 className="block-title">{displayText('BLOQUE 3 - Análisis jurídico')}</h3>
                <div className="grid-2">
                <div>
                  <Campo
                    label="28. Defensor(a) público(a) asignado para tramitar la solicitud"
                    name="Defensor(a) Público(a) Asignado para tramitar la solicitud"
                    type="catalog-datalist"
                    value={getDefensorAsignadoValue(registro)}
                    onChange={handleChange}
                    options={opcionesDefensores}
                    showObligatoria
                  />
                  {renderCrearDefensorCompacto()}
                </div>

                <Campo
                  label="29. Fecha de análisis jurídico del caso"
                  name="Fecha de análisis jurídico del caso"
                  type="date"
                  value={registro['Fecha de análisis jurídico del caso']}
                  onChange={handleChange}
                  showObligatoria
                />

                <Campo
                  label="30. Procedencia de libertad condicional"
                  name="Procedencia de libertad condicional"
                  type="select"
                  value={registro['Procedencia de libertad condicional']}
                  onChange={handleChange}
                  options={OPCIONES_PROCEDENCIA_LIBERTAD_CONDICIONAL_NUMERADAS}
                  showObligatoria
                />

                <Campo
                  label="31. Procedencia de prisión domiciliaria de mitad de pena"
                  name="Procedencia de prisión domiciliaria de mitad de pena"
                  type="select"
                  value={registro['Procedencia de prisión domiciliaria de mitad de pena']}
                  onChange={handleChange}
                  options={OPCIONES_PROCEDENCIA_PRISION_DOMICILIARIA_NUMERADAS}
                  showObligatoria
                />

                <Campo
                  label="32. Procedencia de utilidad pública (solo para mujeres)"
                  name="Procedencia de utilidad pública (solo para mujeres)"
                  type="select"
                  value={registro['Procedencia de utilidad pública (solo para mujeres)']}
                  onChange={handleChange}
                  options={OPCIONES_PROCEDENCIA_UTILIDAD_PUBLICA_NUMERADAS}
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
                  label="34. Procedencia de acumulación de penas"
                  name="Procedencia de acumulación de penas"
                  type="select"
                  value={registro['Procedencia de acumulación de penas']}
                  onChange={handleChange}
                  options={OPCIONES_PROCEDENCIA_ACUMULACION_PENAS}
                  showObligatoria
                />

                <Campo
                  label="35. Con qué proceso(s) debe acumular penas (si aplica)"
                  name={KEY_Q35_LEGACY}
                  value={registro[KEY_Q35_LEGACY] ?? registro[KEY_Q35_UTF8] ?? ''}
                  onChange={handleChange}
                  required={false}
                  disabled={!habilitarPregunta35}
                  showObligatoria={habilitarPregunta35}
                />

                <CampoCheckboxMultiple
                  label="36. Otras solicitudes a tramitar"
                  name="Otras solicitudes a tramitar"
                  value={otrasSolicitudesSeleccionadas}
                  onChange={handleChange}
                  options={OPCIONES_OTRAS_SOLICITUDES}
                  showObligatoria
                  exclusiveOption="Ninguna"
                />
                {otrasSolicitudesSeleccionadas.length > 1 && (
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <p className="hint-text">{displayText(OPCION_MULTIPLE_P36)}</p>
                  </div>
                )}

                <Campo
                  label="37. Resumen del análisis del caso"
                  name="Resumen del análisis del caso"
                  type="textarea"
                  value={registro['Resumen del análisis del caso']}
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
                  label="39. Decisión del usuario"
                  name="Decisión del usuario"
                  type="select"
                  value={registro['Decisión del usuario']}
                  onChange={handleChange}
                  options={OPCIONES_AURORA_DECISION_USUARIO}
                  disabled={cierreRegla1Bloque3}
                  showObligatoria
                />

                <div className="question-40-highlight">
                <Campo
                  label="40. Actuación a adelantar"
                  name="Actuación a adelantar"
                  type="select"
                  value={registro['Actuación a adelantar']}
                  onChange={handleChange}
                  options={OPCIONES_AURORA_ACTUACION_A_ADELANTAR}
                  disabled={cierreRegla1Bloque3 || decisionUsuarioBloquea}
                  showObligatoria
                />
                {cierreRegla1Bloque3 && (
                  <p className="hint-text">
                    La pregunta 40 esta bloqueada porque el caso se cerro en Bloque 3 (preguntas 30 a 34 sin procedencia).
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
                      {displayText('El resto del formulario está bloqueado por la selección en "Decisión del usuario".')}
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

                const requiereMisionTrabajo = String(registro?.['Se requiere misión de trabajo'] ?? '').trim();
                const deshabilitarMision = requiereMisionTrabajo === 'No';

                return (
                  <>
                    {show5A && (
                      <>
                        <h3 className="block-title">{displayText('BLOQUE 5. Utilidad pública')}</h3>
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
                            label="46. Se requiere misión de trabajo"
                            name="Se requiere misión de trabajo"
                            type="select"
                            value={registro['Se requiere misión de trabajo']}
                            onChange={handleChange}
                            options={OPCIONES_SI_NO}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="47. Fecha de solicitud de misión de trabajo"
                            name="Fecha de solicitud de misión de trabajo"
                            type="date"
                            value={registro['Fecha de solicitud de misión de trabajo']}
                            onChange={handleChange}
                            required={false}
                            disabled={isAuroraFieldDisabled('Fecha de solicitud de misión de trabajo', bloquearBloque5 || deshabilitarMision)}
                          />
                          <Campo
                            label="48. Fecha de asignación de investigador"
                            name="Fecha de asignación de investigador"
                            type="date"
                            value={registro['Fecha de asignación de investigador']}
                            onChange={handleChange}
                            required={false}
                            disabled={isAuroraFieldDisabled('Fecha de asignación de investigador', bloquearBloque5 || deshabilitarMision)}
                          />
                          <Campo
                            label="49. Fecha en la que se reciben todas las pruebas"
                            name="Fecha en la que se reciben todas las pruebas"
                            type="date"
                            value={fechaRecepcionPruebasUtilidad}
                            onChange={handleChange}
                            required={false}
                            maxDate={maxAllowedFutureDateIso}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="50. Fecha de radicación de solicitud de utilidad pública"
                            name="Fecha de radicación de solicitud de utilidad pública"
                            type="date"
                            value={fechaPresentacionSolicitudUtilidad}
                            onChange={handleChange}
                            required={false}
                            minDate={minFechaPresentacionUtilidadIso}
                            maxDate={maxAllowedFutureDateIso}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="51. Fecha de decisión de la autoridad"
                            name="Fecha de decisión de la autoridad"
                            type="date"
                            value={fechaDecisionAutoridadBloque5}
                            onChange={handleChange}
                            minDate={minFechaDecisionUtilidadIso}
                            maxDate={maxAllowedFutureDateIso}
                            disabled={bloquearBloque5}
                            showObligatoria
                          />
                          <Campo
                            label="52. Sentido de la decisión"
                            name="Sentido de la decisión"
                            type="select"
                            value={sentidoDecisionBloque5}
                            onChange={handleChange}
                            options={OPCIONES_BLOQUE_5A_SENTIDO_DECISION}
                            disabled={bloquearBloque5}
                            showObligatoria
                          />
                          <Campo
                            label="53. Motivo de la decisión negativa"
                            name="Motivo de la decisión negativa"
                            type="select"
                            value={motivoDecisionNegativaBloque5}
                            onChange={handleChange}
                            options={OPCIONES_BLOQUE_5A_MOTIVO_DECISION_NEGATIVA}
                            required={false}
                            disabled={bloquearBloque5 || !habilitarNegativaUtilidadPublica}
                          />
                          <Campo
                            label="54. Se presenta recurso"
                            name="Se presenta recurso"
                            type="select"
                            value={sePresentaRecursoBloque5}
                            onChange={handleChange}
                            options={OPCIONES_SI_NO}
                            required={false}
                            disabled={bloquearBloque5 || !habilitarNegativaUtilidadPublica}
                          />
                          <Campo
                            label="55. Fecha de presentación del recurso"
                            name={KEY_FECHA_PRESENTACION_RECURSO}
                            type="date"
                            value={fechaPresentacionRecursoBloque5}
                            onChange={handleChange}
                            required={false}
                            disabled={
                              bloquearBloque5 ||
                              !habilitarNegativaUtilidadPublica ||
                              !isEquivalenteSi(sePresentaRecursoBloque5)
                            }
                          />
                          <Campo
                            label="56. Fecha de la decisión del recurso"
                            name={KEY_FECHA_DECISION_RECURSO}
                            type="date"
                            value={fechaDecisionRecursoBloque5}
                            onChange={handleChange}
                            required={false}
                            disabled={
                              bloquearBloque5 ||
                              !habilitarNegativaUtilidadPublica ||
                              !isEquivalenteSi(sePresentaRecursoBloque5)
                            }
                          />
                          <Campo
                            label="57. Sentido de la decisión que resuelve recurso"
                            name="Sentido de la decisión que resuelve recurso"
                            type="select"
                            value={sentidoResuelveRecursoBloque5}
                            onChange={handleChange}
                            options={OPCIONES_BLOQUE_5A_SENTIDO_DECISION_RESUELVE_RECURSO}
                            required={false}
                            disabled={
                              bloquearBloque5 ||
                              !habilitarNegativaUtilidadPublica ||
                              !isEquivalenteSi(sePresentaRecursoBloque5)
                            }
                          />
                          <Campo
                            label="58. Cierre del caso por imposibilidad de avanzar (si aplica)"
                            name="Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad pública"
                            type="select"
                            value={registro['Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad pública']}
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
                        <h3 className="block-title">{displayText('BLOQUE 5. Trámite de la solicitud')}</h3>
                        <div className="grid-2">
                          <Campo
                            label="43. Fecha de recepción de pruebas aportadas por el usuario (si aplica)"
                            name="Fecha de recepción de pruebas aportadas por el usuario (si aplica)"
                            type="date"
                            value={fechaRecepcionPruebasTramite}
                            onChange={handleChange}
                            required={false}
                            maxDate={maxAllowedFutureDateIso}
                            disabled={bloquearBloque5 || !habilitarRecepcionPruebasTramite}
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
                            label="45. Fecha de presentación de la solicitud a la autoridad"
                            name="Fecha de presentación de la solicitud a la autoridad"
                            type="date"
                            value={fechaPresentacionSolicitudTramite}
                            onChange={handleChange}
                            required={false}
                            minDate={minFechaPresentacionTramiteIso}
                            maxDate={maxAllowedFutureDateIso}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="46. Fecha de decisión de la autoridad"
                            name="Fecha de decisión de la autoridad"
                            type="date"
                            value={fechaDecisionAutoridadBloque5}
                            onChange={handleChange}
                            minDate={minFechaDecisionTramiteIso}
                            maxDate={maxAllowedFutureDateIso}
                            disabled={bloquearBloque5}
                            showObligatoria
                          />
                          <Campo
                            label="47. Sentido de la decisión"
                            name="Sentido de la decisión"
                            type="select"
                            value={sentidoDecisionBloque5}
                            onChange={handleChange}
                            options={OPCIONES_BLOQUE_5B_SENTIDO_DECISION}
                            disabled={bloquearBloque5}
                            showObligatoria
                          />
                          <Campo
                            label="48. Fecha de insistencia 1"
                            name={KEY_FECHA_INSISTENCIA_1}
                            type="date"
                            value={registro[KEY_FECHA_INSISTENCIA_1]}
                            onChange={handleChange}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="49. Fecha de insistencia 2"
                            name={KEY_FECHA_INSISTENCIA_2}
                            type="date"
                            value={registro[KEY_FECHA_INSISTENCIA_2]}
                            onChange={handleChange}
                            required={false}
                            disabled={bloquearBloque5}
                          />
                          <Campo
                            label="50. Motivo de la decisión negativa"
                            name="Motivo de la decisión negativa"
                            type="select"
                            value={motivoDecisionNegativaBloque5}
                            onChange={handleChange}
                            options={OPCIONES_BLOQUE_5B_MOTIVO_DECISION_NEGATIVA}
                            required={false}
                            disabled={bloquearBloque5 || !habilitarNegativaTramiteNormal}
                          />
                          <Campo
                            label="51. Se presenta recurso"
                            name="Se presenta recurso"
                            type="select"
                            value={sePresentaRecursoBloque5}
                            onChange={handleChange}
                            options={OPCIONES_SI_NO}
                            required={false}
                            disabled={bloquearBloque5 || !habilitarNegativaTramiteNormal}
                          />
                          <Campo
                            label="52. Fecha de presentación del recurso"
                            name={KEY_FECHA_PRESENTACION_RECURSO}
                            type="date"
                            value={fechaPresentacionRecursoBloque5}
                            onChange={handleChange}
                            required={false}
                            disabled={
                              bloquearBloque5 ||
                              !habilitarNegativaTramiteNormal ||
                              !isEquivalenteSi(sePresentaRecursoBloque5)
                            }
                          />
                          <Campo
                            label="53. Fecha de la decisión del recurso"
                            name={KEY_FECHA_DECISION_RECURSO}
                            type="date"
                            value={fechaDecisionRecursoBloque5}
                            onChange={handleChange}
                            required={false}
                            disabled={
                              bloquearBloque5 ||
                              !habilitarNegativaTramiteNormal ||
                              !isEquivalenteSi(sePresentaRecursoBloque5)
                            }
                          />
                          <Campo
                            label="54. Sentido de la decisión que resuelve recurso"
                            name="Sentido de la decisión que resuelve la solicitud"
                            type="select"
                            value={sentidoResuelveSolicitudBloque5}
                            onChange={handleChange}
                            options={OPCIONES_BLOQUE_5B_SENTIDO_DECISION_RESUELVE_SOLICITUD}
                            required={false}
                            disabled={
                              bloquearBloque5 ||
                              !habilitarNegativaTramiteNormal ||
                              !isEquivalenteSi(sePresentaRecursoBloque5)
                            }
                          />
                          <Campo
                            label="55. Cierre del caso por imposibilidad de avanzar (si aplica)"
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
                  <h3 className="block-title">{displayText('BLOQUE 2 (SINDICADOS) - Información del proceso SISIPEC')}</h3>
                  <div className="grid-2">
                    <Campo
                      label="14. Autoridad a cargo"
                      name="Autoridad a cargo"
                      value={registro['Autoridad a cargo']}
                      onChange={handleChange}
                      required
                    />
                    <Campo
                      label="15. Número de proceso"
                      name="Número de proceso"
                      value={registro['Número de proceso']}
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
                  <h3 className="block-title">{displayText('BLOQUE 3 (SINDICADOS) - Análisis jurídico')}</h3>
                  <div className="grid-2">
                    <div>
                      <Campo
                        label="19. Defensor(a) p\u00fablico(a) asignado para tramitar la solicitud"
                        name="Defensor(a) Público(a) Asignado para tramitar la solicitud"
                        type="catalog-datalist"
                        value={getDefensorAsignadoValue(registro)}
                        onChange={handleChange}
                        options={opcionesDefensores}
                        required
                        showObligatoria
                      />
                      {renderCrearDefensorCompacto()}
                    </div>
                    <Campo
                      label="20. Fecha de an\u00e1lisis jur\u00eddico del caso"
                      name="Fecha de análisis jurídico del caso"
                      type="date"
                      value={registro['Fecha de análisis jurídico del caso']}
                      onChange={handleChange}
                      required
                      showObligatoria
                    />
                    <div className="question-40-highlight">
                      <Campo
                        label="21. An\u00e1lisis jur\u00eddico y actuaci\u00f3n a desplegar"
                        name="PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS"
                        type="select"
                        value={registro['PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS']}
                        onChange={handleChange}
                        options={OPCIONES_CELESTE_ANALISIS_ACTUACION}
                        required
                        showObligatoria
                      />
                    </div>
                    <Campo
                      label="22. Resumen del an\u00e1lisis jur\u00eddico del caso"
                      name="RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO"
                      type="textarea"
                      value={registro['RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO']}
                      onChange={handleChange}
                      required={false}
                      showObligatoria
                    />
                  </div>
                </>
              )}

              {celesteVisibleBlocks.has('bloque4Celeste') && (
                <>
                  <h3 className="block-title">{displayText('BLOQUE 4 (SINDICADOS) - Entrevista con el usuario')}</h3>
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
                  <h3 className="block-title">{displayText('BLOQUE 5 (SINDICADOS) - Trámite de la solicitud')}</h3>
                  <div className="grid-2">
                    <Campo
                      label="24. Fecha de presentación de la solicitud de audiencia"
                      name="FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA"
                      type="date"
                      value={registro['FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA']}
                      onChange={handleChange}
                      required={false}
                    />
                    <Campo
                      label="25. Fecha de realización de la audiencia"
                      name="FECHA DE REALIZACIÓN DE AUDIENCIA"
                      type="date"
                      value={registro['FECHA DE REALIZACIÓN DE AUDIENCIA']}
                      onChange={handleChange}
                      required={false}
                    />
                    <Campo
                      label="26. Sentido de la decisión"
                      name="SENTIDO DE LA DECISIÓN"
                      type="select"
                      value={registro['SENTIDO DE LA DECISIÓN']}
                      onChange={handleChange}
                      options={OPCIONES_SENTIDO_DECISION_CELESTE}
                      required={false}
                    />
                    <Campo
                      label="27. Motivo de la decisión negativa"
                      name="MOTIVO DE LA DECISIÓN NEGATIVA"
                      type="select"
                      value={registro['MOTIVO DE LA DECISIÓN NEGATIVA']}
                      onChange={handleChange}
                      options={OPCIONES_MOTIVO_DECISION_NEGATIVA_CELESTE}
                      required={false}
                      disabled={!habilitarCelesteMotivoNegativa}
                    />
                    <Campo
                      label="28. Se presenta recurso"
                      name="¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?"
                      type="select"
                      value={registro['¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?']}
                      onChange={handleChange}
                      options={OPCIONES_SI_NO}
                      required={false}
                    />
                    <Campo
                      label="29. Fecha de presentación del recurso"
                      name="Fecha de presentación del recurso"
                      type="date"
                      value={registro['Fecha de presentación del recurso']}
                      onChange={handleChange}
                      required={false}
                      disabled={!habilitarCelesteRecurso}
                    />
                    <Campo
                      label="30. Fecha de la decisión del recurso"
                      name="Fecha de la decisión del recurso"
                      type="date"
                      value={registro['Fecha de la decisión del recurso']}
                      onChange={handleChange}
                      required={false}
                      disabled={!habilitarCelesteRecurso}
                    />
                    <Campo
                      label="31. Sentido de la decisión que resuelve recurso"
                      name="SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO"
                      type="select"
                      value={registro['SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO']}
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

          </fieldset>

          <div className="actions-center"> 
            <button className="save-button" type="button" onClick={handleGuardar} disabled={personaFueraPrision}>
              {personaFueraPrision ? 'SOLO LECTURA' : 'GUARDAR ENTREVISTA'}
            </button>

            {(guardadoOk || personaFueraPrision) && (
              <button className="save-button" type="button" onClick={handleConsultarOtro}>
                CONSULTAR OTRO PPL
              </button>
            )}

            <button className="save-button" type="button" onClick={handleGenerarPdfCasoActual}>
              GENERAR CONSOLIDADO (PDF)
            </button>
          </div>
        </div>
          )}
        </>
      )}
    </>
  );
}
