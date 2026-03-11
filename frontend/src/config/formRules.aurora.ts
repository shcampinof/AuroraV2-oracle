import { AURORA_FIELD_IDS } from './auroraFieldIds';

/**
 * Nota de diseño:
 * Las reglas aún aceptan labels como claves, pero se est? migrando a IDs estables.
 * Cuando la migración termine, se puede simplificar el matching tolerante de claves.
 */
export type AuroraBlockId =
  | 'bloque1'
  | 'bloque2Aurora'
  | 'bloque3'
  | 'bloque4'
  | 'bloque5UtilidadPublica'
  | 'bloque5TramiteNormal';

export type AuroraFlow = 'condenado' | 'sindicado';

export type FormRecord = Record<string, unknown>;

export interface FieldRef {
  // Stable ID placeholder to migrate rules away from text labels in the future.
  id?: string;
  key: string;
  label: string;
  optional?: boolean;
}

export interface MandatoryByBlock {
  [blockId: string]: FieldRef[];
}

export interface BlockVariantRule {
  id: string;
  description: string;
  when: (record: FormRecord) => boolean;
  show: AuroraBlockId[];
  hide: AuroraBlockId[];
}

export interface LockRule {
  id: string;
  description: string;
  when: (record: FormRecord) => boolean;
}

export interface DependencyRule {
  id: string;
  source: FieldRef;
  description: string;
  when: (record: FormRecord) => boolean;
  effects: {
    disable?: string[];
    enable?: string[];
  };
}

export type DerivedStatus =
  | 'Analizar el caso'
  | 'Entrevistar al usuario'
  | 'Presentar solicitud'
  | 'Pendiente decisión'
  | 'Caso cerrado';

export interface DerivedStatusRule {
  id: string;
  status: DerivedStatus;
  when: (record: FormRecord) => boolean;
}

const FIELD = {
  q30: 'Procedencia de libertad condicional',
  q31: 'Procedencia de prisión domiciliaria de mitad de pena',
  q32: 'Procedencia de utilidad pública (solo para mujeres)',
  q33: 'Procedencia de pena cumplida',
  q34: 'Procedencia de acumulación de penas',
  q35: 'Con qu? proceso(s) debe acumular penas (si aplica)',
  q36: 'Otras solicitudes a tramitar',
  q37: 'Resumen del análisis del caso',
  q38: 'Fecha de entrevista',
  q39: 'Decisión del usuario',
  q40: 'Actuación a adelantar',
  q43: 'Fecha de entrevista psicosocial',
  q44: 'Cumple el requisito de marginalidad',
  q45: 'Cumple el requisito de jefatura de hogar',
  q46: 'Se requiere misión de trabajo',
  q47: 'Fecha de solicitud de misión de trabajo',
  q48: 'Fecha de asignación de investigador',
  q49: 'Fecha en la que se reciben todas las pruebas',
  q50: 'Fecha de radicación de solicitud de utilidad pública',
  q51: 'Fecha de decisión de la autoridad',
  q52: 'Sentido de la decisión',
  q53: 'Motivo de la decisión negativa',
  q54: 'Se presenta recurso',
  q55: 'Fecha de recurso en caso desfavorable',
  q56: 'Sentido de la decisión que resuelve recurso',
  b5NormalRecepcionPruebas: 'Fecha de recepción de pruebas aportadas por el usuario (si aplica)',
  b5NormalSolicitudInpec: 'Fecha de solicitud de documentos al Inpec (si aplica)',
  b5NormalRadicacion: 'Fecha de presentación de la solicitud a la autoridad',
  b5NormalDecision: 'Fecha de decisión de la autoridad',
  b5NormalSentidoResuelveSolicitud: 'Sentido de la decisión que resuelve la solicitud',
} as const;

// Transitional catalog: keeps stable IDs aligned with current text keys.
// Rules still use `key` today; this map is the migration bridge for future ID-based rules.
export const AURORA_FIELD_CATALOG = FIELD;

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function decodeMojibakeValue(value: unknown): string {
  let out = toText(value);
  for (let i = 0; i < 2; i += 1) {
    if (!/[\u00C3\u00C2\u00E2]/.test(out)) break;
    const decoded = latin1ToUtf8(out);
    if (!decoded || decoded === out) break;
    out = decoded;
  }
  return out;
}

function normalize(value: unknown): string {
  return decodeMojibakeValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeKeyLoose(value: unknown): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function latin1ToUtf8(value: string): string {
  try {
    // Helps when a UTF-8 string was interpreted as latin1 (mojibake).
    return decodeURIComponent(escape(value));
  } catch {
    return value;
  }
}

function utf8ToLatin1(value: string): string {
  try {
    // Reverse variant to maximize key matching between mixed encodings.
    return unescape(encodeURIComponent(value));
  } catch {
    return value;
  }
}

function keyVariants(value: unknown): string[] {
  const raw = toText(value);
  if (!raw) return [''];
  const variants = new Set<string>([raw]);
  // Two conversion rounds cover common mojibake chains (utf8<->latin1 applied more than once).
  for (let i = 0; i < 2; i += 1) {
    const snapshot = Array.from(variants);
    for (const v of snapshot) {
      variants.add(latin1ToUtf8(v));
      variants.add(utf8ToLatin1(v));
    }
  }
  return Array.from(new Set(Array.from(variants).map((v) => normalizeKeyLoose(v))));
}

function isFilled(value: unknown): boolean {
  return toText(value) !== '';
}

function get(record: FormRecord, key: string): string {
  if (!record) return '';
  if (Object.prototype.hasOwnProperty.call(record, key)) {
    return toText(record[key]);
  }
  const lookupVariants = keyVariants(key);
  const matched = Object.keys(record).find((k) => {
    const candidateVariants = keyVariants(k);
    return candidateVariants.some((cv) => lookupVariants.includes(cv));
  });
  if (!matched) return '';
  return toText(record[matched]);
}

function includesAnyInsensitive(value: unknown, needles: string[]): boolean {
  const haystack = normalize(value);
  return needles.some((n) => haystack.includes(normalize(n)));
}

function equalsInsensitive(value: unknown, expected: string): boolean {
  return normalize(value) === normalize(expected);
}

function equalsAnyInsensitive(value: unknown, expectedValues: string[]): boolean {
  return expectedValues.some((expected) => equalsInsensitive(value, expected));
}

function isNegativeProcedencia(value: unknown): boolean {
  const v = normalize(value);
  if (!v) return false;
  if (v === 'no') return true;
  if (v.startsWith('no aplica')) return true;
  if (v.startsWith('no cumple')) return true;
  return false;
}

function areAllNegativeInProcedencias30a33(record: FormRecord): boolean {
  const values = [get(record, FIELD.q30), get(record, FIELD.q31), get(record, FIELD.q32), get(record, FIELD.q33)];
  if (!values.every((v) => isFilled(v))) return false;
  return values.every((v) => isNegativeProcedencia(v));
}

function isUtilidadPublicaFlow(record: FormRecord): boolean {
  return includesAnyInsensitive(get(record, FIELD.q40), [
    'Utilidad pública (solo para mujeres)',
    'Utilidad pública y prisión domiciliaria',
    'Utilidad pública y libertad condicional',
  ]);
}

function decisionUsuarioPermiteContinuar(value: unknown): boolean {
  return normalize(value).startsWith('si');
}

function isNoConcedeSubrogadoPenal(value: unknown): boolean {
  return equalsInsensitive(value, 'No concede subrogado penal');
}

function isFormularioBloqueado(record: FormRecord): boolean {
  return lockRules.some((r) => r.when(record));
}

function isCasoCerrado(record: FormRecord): boolean {
  const decisionUsuario = get(record, FIELD.q39);
  const actuacion = get(record, FIELD.q40);
  const q44 = get(record, FIELD.q44);
  const q45 = get(record, FIELD.q45);
  const q54 = get(record, FIELD.q54);
  const q56 = get(record, FIELD.q56);

  if (areAllNegativeInProcedencias30a33(record)) return true;
  if (decisionUsuario && !decisionUsuarioPermiteContinuar(decisionUsuario)) {
    return true;
  }
  if (includesAnyInsensitive(actuacion, ['ninguna'])) return true;
  if (equalsInsensitive(q44, 'No') || equalsInsensitive(q45, 'No')) return true;
  if (q54 && equalsInsensitive(q54, 'No')) return true;
  if (isFilled(q56)) return true;
  return false;
}

export const mandatoryByBlock: MandatoryByBlock = {
  bloque1: [],
  bloque2Aurora: [
    { key: 'Autoridad a cargo', label: '14 Autoridad a cargo' },
    { key: 'Número de proceso', label: '15 Número de proceso' },
    { key: 'Delitos', label: '16 Delitos' },
    { key: 'Fecha de captura', label: '17 Fecha de captura' },
    { key: 'Pena (años, meses y días)', label: '18 Pena (años, meses y días)' },
    { key: 'Pena total en días', label: '19 Pena total en días' },
    { key: 'Tiempo que la persona lleva privada de la libertad (en días)', label: '20 Tiempo privada de libertad' },
    { key: 'Redención total acumulada en días', label: '21 Redención total acumulada en días' },
    { key: 'Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)', label: '22 Tiempo efectivo cumplido' },
    { key: 'Porcentaje de avance de pena cumplida', label: '23 Porcentaje de avance de pena cumplida' },
    { key: 'Fase de tramiento', label: '24 Fase de tratamiento' },
    { key: '? Cuenta con requerimientos judiciales por otros procesos ?', label: '25 Requerimientos judiciales por otros procesos' },
    { key: 'Fecha ?ltima calificación ', label: '26 Fecha ?ltima calificación' },
    { key: 'Calificación de conducta', label: '27 Calificación de conducta' },
  ],
  bloque3: [
    {
      id: AURORA_FIELD_IDS.B3_DEFENSOR_ASIGNADO,
      key: 'Defensor(a) Público(a) Asignado para tramitar la solicitud',
      label: '28 Defensor(a) público(a)',
    },
    {
      id: AURORA_FIELD_IDS.B3_FECHA_ANALISIS,
      key: 'Fecha de análisis jurídico del caso',
      label: '29 Fecha de análisis jurídico del caso',
    },
    {
      id: AURORA_FIELD_IDS.B3_PROCEDENCIA_LIBERTAD_CONDICIONAL,
      key: FIELD.q30,
      label: '30 Procedencia de libertad condicional',
    },
    {
      id: AURORA_FIELD_IDS.B3_PROCEDENCIA_PRISION_DOMICILIARIA,
      key: FIELD.q31,
      label: '31 Procedencia de prisión domiciliaria de mitad de pena',
    },
    {
      id: AURORA_FIELD_IDS.B3_PROCEDENCIA_UTILIDAD_PUBLICA,
      key: FIELD.q32,
      optional: true,
      label: '32 Procedencia de utilidad pública (solo para mujeres)',
    },
    {
      id: AURORA_FIELD_IDS.B3_PROCEDENCIA_PENA_CUMPLIDA,
      key: FIELD.q33,
      label: '33 Procedencia de pena cumplida',
    },
    {
      id: AURORA_FIELD_IDS.B3_PROCEDENCIA_ACUMULACION_PENAS,
      key: FIELD.q34,
      label: '34 Procedencia de acumulación de penas',
    },
    {
      id: AURORA_FIELD_IDS.B3_ANALISIS_ACTUACION,
      key: FIELD.q36,
      label: '36 Otras solicitudes a tramitar',
    },
    {
      id: AURORA_FIELD_IDS.B3_RESUMEN_ANALISIS,
      key: FIELD.q37,
      label: '37 Resumen del análisis del caso',
    },
  ],
  bloque4: [
    { key: FIELD.q38, label: '38 Fecha de la entrevista', optional: true },
    { key: FIELD.q39, label: '39 Decisión del usuario' },
    { key: FIELD.q40, label: '40 Actuación a adelantar' },
    { key: 'Requiere pruebas', label: '41 Requiere pruebas', optional: true },
    { key: 'Poder en caso de avanzar con la solicitud', label: '42 Poder en caso de avanzar con la solicitud', optional: true },
  ],
  bloque5UtilidadPublica: [
    { key: FIELD.q43, label: '43 Fecha de entrevista psicosocial' },
    { key: FIELD.q44, label: '44 Cumple requisito de marginalidad' },
    { key: FIELD.q45, label: '45 Cumple requisito de jefatura de hogar' },
    { key: FIELD.q46, label: '46 Se requiere misión de trabajo' },
    { key: FIELD.q49, label: '49 Fecha en la que se reciben todas las pruebas' },
    { key: FIELD.q50, label: '50 Fecha de radicación de utilidad pública' },
    { key: FIELD.q51, label: '51 Fecha de decisión de la autoridad' },
    { key: FIELD.q52, label: '52 Sentido de la decisión' },
  ],
  bloque5TramiteNormal: [
    {
      key: FIELD.b5NormalRecepcionPruebas,
      label: '43 Fecha de recepción de pruebas aportadas por el usuario',
      optional: true,
    },
    {
      key: FIELD.b5NormalSolicitudInpec,
      label: '44 Fecha de solicitud de documentos al Inpec',
      optional: true,
    },
    { key: FIELD.b5NormalRadicacion, label: '45 Fecha de presentación de la solicitud a la autoridad' },
    { key: FIELD.b5NormalDecision, label: '46 Fecha de decisión de la autoridad' },
    { key: FIELD.q52, label: '47 Sentido de la decisión' },
    { key: FIELD.q53, label: '48 Motivo de la decisión negativa', optional: true },
    { key: FIELD.q54, label: '49 Se presenta recurso' },
    { key: FIELD.q55, label: '50 Fecha de recurso en caso desfavorable', optional: true },
    { key: FIELD.b5NormalSentidoResuelveSolicitud, label: '51 Sentido de la decisión que resuelve la solicitud' },
  ],
};

export const blockOrder: AuroraBlockId[] = ['bloque1', 'bloque2Aurora', 'bloque3', 'bloque4'];

export const blockVariants = {
  bloque5: {
    defaultVariant: 'bloque5TramiteNormal' as const,
    variants: ['bloque5UtilidadPublica', 'bloque5TramiteNormal'] as const,
  },
};

export const conditionalBlockVisibility: BlockVariantRule[] = [
  {
    id: 'b5_utilidad_publica_por_q40',
    description: 'Si Q40 es utilidad pública, mostrar 5A y ocultar 5 normal.',
    when: (record) => isUtilidadPublicaFlow(record),
    show: ['bloque5UtilidadPublica'],
    hide: ['bloque5TramiteNormal'],
  },
];

export const lockRules: LockRule[] = [
  {
    id: 'lock_por_actuacion_40_sindicada',
    description: 'Bloquea resto del formulario si Q40 incluye "Ninguna porque la persona est? sindicada".',
    when: (record) => includesAnyInsensitive(get(record, FIELD.q40), ['Ninguna porque la persona est? sindicada']),
  },
];

export const dependencyRules: DependencyRule[] = [
  // Regla: AURORA.B5A.DEPENDENCIA.1
  {
    id: 'dep_q46_no_deshabilita_47_48',
    source: { key: FIELD.q46, label: '46 Se requiere misión de trabajo' },
    description: 'Si Q46 = NO, deshabilita 47 y 48.',
    when: (record) => equalsInsensitive(get(record, FIELD.q46), 'No'),
    effects: {
      disable: [FIELD.q47, FIELD.q48],
    },
  },
  // Regla: AURORA.B5A.DEPENDENCIA.3
  {
    id: 'dep_q52_no_niega_utilidad_publica',
    source: { key: FIELD.q52, label: '52 Sentido de la decisión' },
    description: 'Si Q52 != Niega utilidad pública, deshabilita Q53, Q54, Q55 y Q56.',
    when: (record) =>
      isUtilidadPublicaFlow(record) && !equalsInsensitive(get(record, FIELD.q52), 'Niega utilidad pública'),
    effects: {
      disable: [FIELD.q53, FIELD.q54, FIELD.q55, FIELD.q56],
    },
  },
  // Regla: AURORA.B5A.DEPENDENCIA.2
  {
    id: 'dep_q52_niega_utilidad_publica_habilita_53_54',
    source: { key: FIELD.q52, label: '52 Sentido de la decisión' },
    description: 'Si Q52 = Niega utilidad pública, habilita Q53 y Q54.',
    when: (record) => isUtilidadPublicaFlow(record) && equalsInsensitive(get(record, FIELD.q52), 'Niega utilidad pública'),
    effects: {
      enable: [FIELD.q53, FIELD.q54],
    },
  },
  // Regla: AURORA.B5A.DEPENDENCIA.4
  {
    id: 'dep_q54_si_habilita_55_56_en_5a',
    source: { key: FIELD.q54, label: '54 Se presenta recurso' },
    description: 'En 5A, si Q54 = Sí y Q52 = Niega utilidad pública, habilita Q55 y Q56.',
    when: (record) =>
      isUtilidadPublicaFlow(record) &&
      equalsInsensitive(get(record, FIELD.q52), 'Niega utilidad pública') &&
      equalsAnyInsensitive(get(record, FIELD.q54), ['Sí', 'S?']),
    effects: {
      enable: [FIELD.q55, FIELD.q56],
    },
  },
  // Regla: AURORA.B5B.DEPENDENCIA.3
  // TODO(matriz): confirmar nomenclatura Q47/Q52 para el campo "Sentido de la decision" en 5B.
  {
    id: 'dep_q52_no_concede_subrogado_habilita_q53_q54_en_5b',
    source: { key: FIELD.q52, label: '47 Sentido de la decisión' },
    description: 'En 5B, si Q47 = No concede subrogado penal, habilita motivo y recurso.',
    when: (record) => !isUtilidadPublicaFlow(record) && isNoConcedeSubrogadoPenal(get(record, FIELD.q52)),
    effects: {
      enable: [FIELD.q53, FIELD.q54],
    },
  },
  // Regla: AURORA.B5B.DEPENDENCIA.4
  {
    id: 'dep_q52_no_concede_subrogado_deshabilita_q53_q54_q55_en_5b',
    source: { key: FIELD.q52, label: '47 Sentido de la decisión' },
    description: 'En 5B, si Q47 != No concede subrogado penal, deshabilita motivo y campos de recurso.',
    when: (record) => !isUtilidadPublicaFlow(record) && !isNoConcedeSubrogadoPenal(get(record, FIELD.q52)),
    effects: {
      disable: [FIELD.q53, FIELD.q54, FIELD.q55, FIELD.b5NormalSentidoResuelveSolicitud],
    },
  },
  // Regla: AURORA.B5B.DEPENDENCIA.1
  {
    id: 'dep_q49_no_deshabilita_q50_q51_en_5b',
    source: { key: FIELD.q54, label: '49 Se presenta recurso' },
    description: 'En 5B, si Q49 != Sí, deshabilita Q50 y Q51.',
    when: (record) =>
      !isUtilidadPublicaFlow(record) &&
      isNoConcedeSubrogadoPenal(get(record, FIELD.q52)) &&
      !equalsAnyInsensitive(get(record, FIELD.q54), ['Sí', 'S?']),
    effects: {
      disable: [FIELD.q55, FIELD.b5NormalSentidoResuelveSolicitud],
    },
  },
  // Regla: AURORA.B5B.DEPENDENCIA.2
  {
    id: 'dep_q49_si_habilita_q50_q51_en_5b',
    source: { key: FIELD.q54, label: '49 Se presenta recurso' },
    description: 'En 5B, si Q49 = Sí, habilita Q50 y Q51.',
    when: (record) =>
      !isUtilidadPublicaFlow(record) &&
      isNoConcedeSubrogadoPenal(get(record, FIELD.q52)) &&
      equalsAnyInsensitive(get(record, FIELD.q54), ['Sí', 'S?']),
    effects: {
      enable: [FIELD.q55, FIELD.b5NormalSentidoResuelveSolicitud],
    },
  },
];

export const derivedStatusRules: DerivedStatusRule[] = [
  {
    id: 'estado_caso_cerrado',
    status: 'Caso cerrado',
    when: (record) => isCasoCerrado(record),
  },
  {
    id: 'estado_analizar_el_caso',
    status: 'Analizar el caso',
    when: (record) => !isFilled(get(record, 'Fecha de análisis jurídico del caso')) || !isFilled(get(record, FIELD.q37)),
  },
  {
    id: 'estado_entrevistar_al_usuario',
    status: 'Entrevistar al usuario',
    when: (record) =>
      isFilled(get(record, 'Fecha de análisis jurídico del caso')) &&
      isFilled(get(record, FIELD.q37)) &&
      (!isFilled(get(record, FIELD.q38)) || !isFilled(get(record, FIELD.q40))),
  },
  {
    id: 'estado_presentar_solicitud',
    status: 'Presentar solicitud',
    when: (record) => {
      const baseReady =
        isFilled(get(record, 'Fecha de análisis jurídico del caso')) &&
        isFilled(get(record, FIELD.q37)) &&
        isFilled(get(record, FIELD.q38)) &&
        isFilled(get(record, FIELD.q40));
      if (!baseReady) return false;
      if (isUtilidadPublicaFlow(record)) return !isFilled(get(record, FIELD.q50));
      return !isFilled(get(record, FIELD.b5NormalRadicacion));
    },
  },
  {
    id: 'estado_pendiente_decision',
    status: 'Pendiente decisión',
    when: (record) => {
      const baseReady =
        isFilled(get(record, 'Fecha de análisis jurídico del caso')) &&
        isFilled(get(record, FIELD.q37)) &&
        isFilled(get(record, FIELD.q38)) &&
        isFilled(get(record, FIELD.q40));
      if (!baseReady) return false;
      if (isUtilidadPublicaFlow(record)) {
        return isFilled(get(record, FIELD.q50)) && !isFilled(get(record, FIELD.q51));
      }
      return isFilled(get(record, FIELD.b5NormalRadicacion)) && !isFilled(get(record, FIELD.b5NormalDecision));
    },
  },
];

function areMandatoryFieldsFilled(record: FormRecord, blockId: AuroraBlockId): boolean {
  const fields = mandatoryByBlock[blockId] || [];
  return fields.every((f) => f.optional || isFilled(get(record, f.key)));
}

function getSelectedBlock5Variant(record: FormRecord): AuroraBlockId {
  return isUtilidadPublicaFlow(record) ? 'bloque5UtilidadPublica' : 'bloque5TramiteNormal';
}

export function resolveVisibleBlocksAurora(record: FormRecord, flow: AuroraFlow = 'condenado'): AuroraBlockId[] {
  // Este archivo define reglas de Aurora (condenados). Para sindicado se retorna base mínima.
  if (flow !== 'condenado') return ['bloque1'];

  const visible: AuroraBlockId[] = ['bloque1', 'bloque2Aurora'];
  const blocked = isFormularioBloqueado(record);
  if (blocked) return visible;

  // Regla global: para mostrar el siguiente bloque, deben estar completos los obligatorios visibles hasta el momento.
  const progression: AuroraBlockId[] = ['bloque3', 'bloque4', getSelectedBlock5Variant(record)];

  for (const candidate of progression) {
    const allVisibleMandatoryDone = visible.every((b) => areMandatoryFieldsFilled(record, b));
    if (!allVisibleMandatoryDone) break;
    visible.push(candidate);
  }

  // Excepción condicional: fuerza visibilidad/ocultamiento por reglas de variante.
  conditionalBlockVisibility.forEach((rule) => {
    if (!rule.when(record)) return;
    rule.hide.forEach((b) => {
      const idx = visible.indexOf(b);
      if (idx >= 0) visible.splice(idx, 1);
    });
    rule.show.forEach((b) => {
      if (!visible.includes(b)) visible.push(b);
    });
  });

  return visible;
}

export function deriveEstadoTramiteAurora(record: FormRecord): DerivedStatus {
  const hit = derivedStatusRules.find((r) => r.when(record));
  return hit?.status || 'Analizar el caso';
}

export const auroraFormRules = {
  mandatoryByBlock,
  blockOrder,
  blockVariants,
  conditionalBlockVisibility,
  lockRules,
  dependencyRules,
  derivedStatusRules,
  helpers: {
    isUtilidadPublicaFlow,
    isFormularioBloqueado,
    isCasoCerrado,
    resolveVisibleBlocksAurora,
    deriveEstadoTramiteAurora,
  },
};

export default auroraFormRules;
