export function normalizeDefensorNombre(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Durante la escritura se conserva un unico espacio final. Si se aplicara
// trim() en cada pulsacion, el usuario no podria separar nombre y apellido.
export function normalizeDefensorNombreInput(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^\s+/, '');
}

export function isNombreDefensorValido(value) {
  const normalized = normalizeDefensorNombre(value);
  return Boolean(normalized) && /^[\p{L}]+(?: [\p{L}]+)*$/u.test(normalized);
}

export function buildDefensorNameOptions(catalogo = [], defensorAsignadoOriginal = '') {
  const byNormalizedName = new Map();

  (Array.isArray(catalogo) ? catalogo : []).forEach((item) => {
    const nombre = String(item?.nombre ?? item?.label ?? item?.value ?? item ?? '').trim();
    const key = normalizeDefensorNombre(nombre);
    if (key && !byNormalizedName.has(key)) byNormalizedName.set(key, nombre);
  });

  const original = String(defensorAsignadoOriginal ?? '').trim();
  const originalKey = normalizeDefensorNombre(original);
  if (originalKey && !byNormalizedName.has(originalKey)) {
    byNormalizedName.set(originalKey, original);
  }

  return Array.from(byNormalizedName.values()).sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );
}

export function resolveDefensorCatalogado(value, options = []) {
  const key = normalizeDefensorNombre(value);
  if (!key) return '';

  const matches = new Map();
  (Array.isArray(options) ? options : []).forEach((option) => {
    const nombre = String(option?.nombre ?? option?.label ?? option?.value ?? option ?? '').trim();
    if (normalizeDefensorNombre(nombre) === key && !matches.has(key)) {
      matches.set(key, nombre);
    }
  });

  return matches.get(key) || '';
}

export function resolveDefensorAsignadoParaGuardar({
  value,
  originalValue,
  assignedId,
  catalogo = [],
  options = [],
} = {}) {
  const currentKey = normalizeDefensorNombre(value);
  if (!currentKey) return '';

  const originalKey = normalizeDefensorNombre(originalValue);
  const safeAssignedId = String(assignedId ?? '').replace(/\D+/g, '');

  // Una asignacion existente se identifica por cedula. Si el usuario no
  // cambio realmente el nombre, diferencias de formato no deben bloquearla.
  if (safeAssignedId && originalKey && currentKey === originalKey) {
    const byId = (Array.isArray(catalogo) ? catalogo : []).find(
      (item) => String(item?.id ?? item?.cedula ?? '').replace(/\D+/g, '') === safeAssignedId
    );
    return String(byId?.nombre ?? byId?.label ?? value ?? '').trim();
  }

  return resolveDefensorCatalogado(value, options);
}
