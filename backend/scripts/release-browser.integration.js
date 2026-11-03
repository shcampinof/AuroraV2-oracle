const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// La batería de publicación incluye siempre el service worker. Requiere una
// candidata y Oracle de pruebas; nunca se omite silenciosamente por falta de entorno.
assert.equal(process.env.RUN_RELEASE_BROWSER_INTEGRATION, 'true', 'Configure RUN_RELEASE_BROWSER_INTEGRATION=true para una candidata aislada.');
assert(process.env.VERSION_QA_BASE_URL, 'Configure VERSION_QA_BASE_URL; no se usa el servicio publicado por defecto.');
const output = process.env.VERSION_QA_OUTPUT || '/tmp/aurora-release-browser';
fs.mkdirSync(output, { recursive: true });
const checks = [];
let failed = false;
for (const [file, folder] of [
  ['version-flows.browser.integration.js', 'version'],
  ['offline-auth.browser.integration.js', 'offline'],
  ['pag-reasignacion.browser.integration.js', 'reasignacion'],
  ['cierre-eron.browser.integration.js', 'cierres'],
]) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], {
    stdio: 'inherit', env: {
      ...process.env, RUN_VERSION_BROWSER_INTEGRATION: 'true', RUN_PAG_BROWSER_INTEGRATION: 'true', RUN_CIERRE_BROWSER_INTEGRATION: 'true',
      PAG_BROWSER_BASE_URL: process.env.VERSION_QA_BASE_URL, CIERRE_BROWSER_BASE_URL: process.env.VERSION_QA_BASE_URL,
      VERSION_QA_OUTPUT: path.join(output, folder),
    },
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0 || result.error) failed = true;
  checks.push({ file, ok: result.status === 0 && !result.error, exitCode: result.status });
  fs.writeFileSync(path.join(output, 'browser-release-results.json'), JSON.stringify({ completed: checks.length === 4, ok: checks.length === 4 && !failed, checks }, null, 2));
}
if (failed) process.exitCode = 1;
