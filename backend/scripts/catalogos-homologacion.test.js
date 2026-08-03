const assert = require('assert');
const {
  getAccionByCodigo,
  getCentroNormalizedAliases,
  listAcciones,
  resolveAccionCodigo,
  resolveAccionPendiente,
  resolveCentro,
} = require('../domain/catalogosHomologacion');

function testCentroAliasesShareCanonicalIdentity() {
  const canonical = resolveCentro('CPAMS EL BARNE');
  const variant = resolveCentro('  Cpams\u00a0 El   Barné ');
  assert.strictEqual(canonical.id, 'CENTRO_CPAMS_EL_BARNE');
  assert.strictEqual(variant.id, canonical.id);
  assert.strictEqual(variant.label, 'CPAMS EL BARNE');
  assert.strictEqual(variant.homologado, true);
  assert(getCentroNormalizedAliases(canonical.id).includes('CPAMS EL BARNE'));
}

function testUnknownCentersRemainVisibleAndStable() {
  const first = resolveCentro('Centro histórico X');
  const variant = resolveCentro('  CENTRO HISTÓRICO   X ');
  assert.strictEqual(first.id, variant.id);
  assert.strictEqual(first.homologado, false);
  assert.strictEqual(first.label, 'Centro histórico X');
  assert.match(first.id, /^LEGACY_CENTRO_[A-F0-9]{12}$/);
}

function testActionsAreSeparatedFromStateAndKeepOriginalValue() {
  const action = resolveAccionPendiente({
    estadoCodigo: 'ENTREVISTAR_USUARIO',
    valorOriginal: 'Texto histórico no catalogado',
  });
  assert.strictEqual(action.codigo, 'REALIZAR_ENTREVISTA');
  assert.strictEqual(action.etiqueta, 'Entrevistar al usuario');
  assert.strictEqual(action.homologada, false);
  assert.strictEqual(action.valorOriginal, 'Texto histórico no catalogado');
  assert.strictEqual(resolveAccionCodigo('Entrevistar al usuario'), 'REALIZAR_ENTREVISTA');
  assert.deepStrictEqual(getAccionByCodigo('REALIZAR_ENTREVISTA').estadoCodigos, ['ENTREVISTAR_USUARIO']);
  assert(listAcciones().some((item) => item.codigo === 'SIN_ACCION_PENDIENTE'));
}

testCentroAliasesShareCanonicalIdentity();
testUnknownCentersRemainVisibleAndStable();
testActionsAreSeparatedFromStateAndKeepOriginalValue();
console.log('OK catalogos-homologacion.test');
