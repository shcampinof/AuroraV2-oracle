const assert = require('assert');

async function captureDefensorSearch(defensor) {
  const oraclePoolPath = require.resolve('../db/oraclePool');
  const repositoryPath = require.resolve('../repositories/oracle/personaRepository');
  const oraclePool = require(oraclePoolPath);
  const originalExecute = oraclePool.execute;
  let captured = null;

  oraclePool.execute = async (sql, binds, options) => {
    captured = { sql, binds, options };
    return { rows: [] };
  };
  delete require.cache[repositoryPath];

  try {
    const repository = require(repositoryPath);
    await repository.listCondenadosSummary({
      tipo: 'all',
      filters: { defensor },
      limit: 10,
      includeExactCounts: false,
    });
    return captured;
  } finally {
    oraclePool.execute = originalExecute;
    delete require.cache[repositoryPath];
  }
}

async function testCanonicalCatalogNameHasPriority() {
  const captured = await captureDefensorSearch('MUÑOZ');

  assert(captured, 'La búsqueda debe ejecutar SQL.');
  assert.match(
    captured.sql,
    /COALESCE\(TO_NCHAR\(d\.NOMBRE\), TO_NCHAR\(a\.NOMBRE_DEFENSOR\)\)/,
    'El nombre canónico del catálogo debe tener prioridad sobre el snapshot de la asignación.'
  );
}

async function testCorrectAndMojibakeInputsShareSearchKey() {
  const correct = await captureDefensorSearch('MUÑOZ');
  const corrupted = await captureDefensorSearch(`MU\u00c3\u2018OZ`);

  assert.strictEqual(correct.binds.defensorFilter, 'MUNOZ%');
  assert.strictEqual(corrupted.binds.defensorFilter, 'MUNOZ%');
  assert.match(
    corrupted.sql,
    /UNISTR\('\\00C3\\2018'\)/,
    'Oracle también debe reparar la secuencia mojibake de Ñ antes de comparar.'
  );
}

(async () => {
  await testCanonicalCatalogNameHasPriority();
  await testCorrectAndMojibakeInputsShareSearchKey();
  console.log('OK mojibake-search.test');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
