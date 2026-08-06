const assert = require('assert');
const {
  getAccionByCodigo,
  getCentroNormalizedAliases,
  listCentros,
  listAcciones,
  resolveAccionCodigo,
  resolveAccionPendiente,
  resolveCentro,
} = require('../domain/catalogosHomologacion');
const { buildActiveSituacionCte, buildStrictActiveSituacionCte } = require('../repositories/oracle/sqlFragments');

function testCentroAliasesShareCanonicalIdentity() {
  const canonical = resolveCentro('CPAMS EL BARNE');
  const variant = resolveCentro('  Cpams\u00a0 El   Barné ');
  assert.strictEqual(canonical.id, 'INPEC_150');
  assert.strictEqual(variant.id, canonical.id);
  assert.strictEqual(variant.label, 'CPAMS EL BARNE');
  assert.strictEqual(variant.homologado, true);
  assert(getCentroNormalizedAliases(canonical.id).includes('CPAMS EL BARNE'));
}

function testOfficialCenterDirectoryIsLoaded() {
  const centers = listCentros();
  assert(centers.length >= 100);
  assert(centers.every((center) => /^INPEC_\d+$/.test(center.id)));
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

function testFilterCatalogsRequireActivePrisonStatus() {
  const sql = buildStrictActiveSituacionCte();
  assert.match(sql, /WHERE\s+s\.RN\s*=\s*1\s+AND\s+NVL\(s\.ACTIVO,\s*0\)\s*=\s*1/i);
  assert.match(sql, /FROM\s+DNDP\.SITUACION_CARCELARIA\s+source_s/i);
  assert.doesNotMatch(sql, /CASE\s+WHEN\s+NVL\(s\.ACTIVO/i);
}

function testCurrentSituationPrioritizesLatestCutoff() {
  const sql = buildActiveSituacionCte();
  assert.match(
    sql,
    /ORDER BY\s+COALESCE\(s\.FECHA_CORTE, CAST\(s\.FECHA_REGISTRO AS DATE\), s\.FECHA_CAPTURA\) DESC NULLS LAST[\s\S]*CASE WHEN NVL\(s\.ACTIVO, 0\) = 1/i
  );
  assert.match(sql, /COUNT\(\*\) OVER \(PARTITION BY s\.ID_PERSONA\) AS TOTAL_SITUACIONES/i);
}

testCentroAliasesShareCanonicalIdentity();
testOfficialCenterDirectoryIsLoaded();
testUnknownCentersRemainVisibleAndStable();
testActionsAreSeparatedFromStateAndKeepOriginalValue();
testFilterCatalogsRequireActivePrisonStatus();
testCurrentSituationPrioritizesLatestCutoff();
console.log('OK catalogos-homologacion.test');
