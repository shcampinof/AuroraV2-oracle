export const ESTADOS_TRAMITE_OPTIONS = [
  { value: 'ANALIZAR_CASO', label: 'Analizar el caso' },
  { value: 'ENTREVISTAR_USUARIO', label: 'Entrevistar al usuario' },
  { value: 'PRESENTAR_SOLICITUD', label: 'Presentar solicitud' },
  { value: 'PENDIENTE_AUDIENCIA', label: 'Pendiente audiencia' },
  { value: 'PENDIENTE_DECISION_AUDIENCIA', label: 'Pendiente decisi\u00f3n de audiencia' },
  { value: 'PENDIENTE_DECISION', label: 'Pendiente decisi\u00f3n' },
  { value: 'PRESENTAR_RECURSO', label: 'Presentar recurso' },
  { value: 'CASO_CERRADO', label: 'Caso cerrado' },
];

function normalizeCatalogText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const ASSIGNED_USERS_FILTER_KEYS = Object.freeze([
  'defensor',
  'defensorId',
  'nombre',
  'documento',
  'lugar',
  'centroId',
  'departamento',
  'municipio',
  'estadoCodigo',
  'accionCodigo',
]);

export function buildAssignedUsersFilters(filters) {
  const safe = filters && typeof filters === 'object' ? filters : {};
  return Object.fromEntries(
    ASSIGNED_USERS_FILTER_KEYS.map((key) => [key, String(safe[key] ?? '').trim()])
  );
}

export function normalizeFilterOptions(data) {
  const defensores = Array.isArray(data?.defensores) ? data.defensores : [];
  const defensorOptions = Array.isArray(data?.defensorOptions)
    ? data.defensorOptions
        .map((item) => ({
          id: String(item?.id ?? '').trim(),
          label: String(item?.label ?? item?.nombre ?? '').trim(),
        }))
        .filter((item) => item.label)
    : defensores.map((label) => ({ id: '', label: String(label || '').trim() })).filter((item) => item.label);
  const estados = Array.isArray(data?.estados)
    ? data.estados
        .map((item) => ({
          value: String(item?.codigo ?? item?.value ?? '').trim(),
          label: String(item?.etiqueta ?? item?.label ?? '').trim(),
        }))
        .filter((item) => item.value && item.label)
    : ESTADOS_TRAMITE_OPTIONS;
  const acciones = Array.isArray(data?.acciones)
    ? data.acciones
        .map((item) => ({
          value: String(item?.codigo ?? item?.value ?? '').trim(),
          label: String(item?.etiqueta ?? item?.label ?? '').trim(),
          estadoCodigos: Array.isArray(item?.estadoCodigos)
            ? item.estadoCodigos.map((codigo) => String(codigo || '').trim()).filter(Boolean)
            : [],
        }))
        .filter((item) => item.value && item.label)
    : [];
  const centros = Array.isArray(data?.centros)
    ? data.centros
        .map((item) => ({
          id: String(item?.id ?? '').trim(),
          label: String(item?.label ?? '').trim(),
          homologado: item?.homologado === true,
          valoresOriginales: Array.isArray(item?.valoresOriginales)
            ? item.valoresOriginales.map((value) => String(value || '').trim()).filter(Boolean)
            : [],
        }))
        .filter((item) => item.id && item.label)
    : [];

  return {
    defensores,
    defensorOptions,
    estados,
    acciones,
    centros,
    departamentos: Array.isArray(data?.departamentos) ? data.departamentos : [],
    municipios: Array.isArray(data?.municipios) ? data.municipios : [],
    lugares: Array.isArray(data?.lugares) ? data.lugares : [],
    meta: data?.meta && typeof data.meta === 'object' ? data.meta : {},
  };
}

export function resolveCentroByLabel(value, options) {
  const key = normalizeCatalogText(value);
  if (!key) return null;
  const matches = (Array.isArray(options) ? options : []).filter((item) => {
    if (normalizeCatalogText(item?.label) === key) return true;
    return (item?.valoresOriginales || []).some((rawValue) => normalizeCatalogText(rawValue) === key);
  });
  const ids = new Set(matches.map((item) => String(item?.id || '').trim()).filter(Boolean));
  return ids.size === 1 ? matches[0] : null;
}

export function resolveDefensorIdByLabel(value, options) {
  const key = normalizeCatalogText(value);
  if (!key) return '';
  const ids = Array.from(
    new Set(
      (Array.isArray(options) ? options : [])
        .filter((item) => normalizeCatalogText(item?.label) === key)
        .map((item) => String(item?.id || '').trim())
        .filter(Boolean)
    )
  );
  return ids.length === 1 ? ids[0] : '';
}
