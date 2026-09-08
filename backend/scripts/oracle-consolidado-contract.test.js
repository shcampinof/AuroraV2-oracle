const assert = require('assert/strict');

const consolidado = require('../db/oracleConsolidado.repo');
const pplService = require('../services/pplService');

assert.equal(
  typeof consolidado.getDataVersionInfo,
  'function',
  'oracleConsolidado.repo must expose the data-version contract used by the PPL route'
);

assert.deepEqual(
  consolidado.getDataVersionInfo(),
  pplService.getDataVersionInfo(),
  'the repository adapter must delegate data-version information to pplService'
);

console.log('oracle-consolidado-contract.test.js: OK');
