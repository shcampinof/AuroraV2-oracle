const { normalizeSearchText } = require('../utils/textNormalization');

const ESTADOS_CASO = Object.freeze([
  { codigo: 'ANALIZAR_CASO', etiqueta: 'Analizar el caso' },
  { codigo: 'ENTREVISTAR_USUARIO', etiqueta: 'Entrevistar al usuario' },
  { codigo: 'PRESENTAR_SOLICITUD', etiqueta: 'Presentar solicitud' },
  { codigo: 'PENDIENTE_AUDIENCIA', etiqueta: 'Pendiente audiencia' },
  { codigo: 'PENDIENTE_DECISION_AUDIENCIA', etiqueta: 'Pendiente decisión de audiencia' },
  { codigo: 'PENDIENTE_DECISION', etiqueta: 'Pendiente decisión' },
  { codigo: 'PRESENTAR_RECURSO', etiqueta: 'Presentar recurso' },
  { codigo: 'CASO_CERRADO', etiqueta: 'Caso cerrado' },
]);

const BY_CODE = new Map(ESTADOS_CASO.map((item) => [item.codigo, item]));
const BY_LABEL = new Map(ESTADOS_CASO.map((item) => [normalizeSearchText(item.etiqueta), item]));
BY_LABEL.set('CERRADO', BY_CODE.get('CASO_CERRADO'));

function resolveEstadoCodigo(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const normalizedCode = raw.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (BY_CODE.has(normalizedCode)) return normalizedCode;
  return BY_LABEL.get(normalizeSearchText(raw))?.codigo || '';
}

function getEstadoByCodigo(value) {
  const codigo = resolveEstadoCodigo(value);
  return codigo ? BY_CODE.get(codigo) || null : null;
}

function getEstadoEtiqueta(value) {
  return getEstadoByCodigo(value)?.etiqueta || '';
}

module.exports = {
  ESTADOS_CASO,
  getEstadoByCodigo,
  getEstadoEtiqueta,
  resolveEstadoCodigo,
};
