const assert = require('assert');
const {
  homologateIdentityOptions,
  homologateTextOptions,
  normalizeComparisonText,
  normalizeSearchText,
  normalizeWhitespace,
  repairKnownMojibake,
} = require('../utils/textNormalization');

assert.deepStrictEqual(
  homologateTextOptions(['ATLANTICO', ' ATLÁNTICO ', 'BOLIVAR', 'BOLÍVAR']),
  ['ATLÁNTICO', 'BOLÍVAR']
);

assert.deepStrictEqual(
  homologateIdentityOptions([
    { id: '123', label: 'JOSE PEREZ' },
    { id: '123', label: 'JOSÉ PÉREZ' },
    { id: '456', label: 'JOSÉ PÉREZ' },
  ]),
  [
    { id: '123', label: 'JOSÉ PÉREZ' },
    { id: '456', label: 'JOSÉ PÉREZ' },
  ]
);
const { getEstadoEtiqueta, resolveEstadoCodigo } = require('../domain/estadoCaso');

assert.strictEqual(normalizeSearchText('  Cpams\u00a0 El   Barné '), 'CPAMS EL BARNE');
assert.strictEqual(normalizeComparisonText('MUÑOZ'), 'munoz');
assert.strictEqual(normalizeWhitespace('A\u200b  B'), 'A B');
assert.strictEqual(repairKnownMojibake(`MU\u00c3\u2018OZ`), 'MUÑOZ');
assert.strictEqual(resolveEstadoCodigo('Entrevistar al usuario'), 'ENTREVISTAR_USUARIO');
assert.strictEqual(resolveEstadoCodigo('ENTREVISTAR_USUARIO'), 'ENTREVISTAR_USUARIO');
assert.strictEqual(getEstadoEtiqueta('ENTREVISTAR_USUARIO'), 'Entrevistar al usuario');

console.log('OK text-normalization.test');
