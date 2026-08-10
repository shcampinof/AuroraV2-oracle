const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { analyzeUserCsv } = require('../services/userCsvImportService');
const { importManagedUsers, listUsers } = require('../services/userDirectoryService');

function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-user-import-test-'));
  const store = path.join(tempDir, 'auth-users.json');
  const previousStore = process.env.AUTH_USER_STORE_PATH;
  process.env.AUTH_USER_STORE_PATH = store;

  try {
    fs.writeFileSync(store, JSON.stringify({
      users: [{ id: 'existente@defensoria.gov.co', email: 'existente@defensoria.gov.co', roles: ['admin'], enabled: false }],
    }));

    const csv = Buffer.from(
      '\uFEFFcorreo\r\nNueva@defensoria.gov.co\r\nexistente@defensoria.gov.co\r\nnueva@defensoria.gov.co\r\ncorreo-invalido\r\n'
    );
    const preview = analyzeUserCsv(csv, listUsers());
    assert.deepEqual(preview.summary, { totalRows: 4, ready: 1, existing: 1, duplicates: 1, invalid: 1 });
    assert.deepEqual(preview.emails, ['nueva@defensoria.gov.co']);

    const result = importManagedUsers(preview.emails);
    assert.equal(result.imported.length, 1);
    const users = listUsers();
    assert.equal(users.length, 2);
    const imported = users.find((user) => user.email === 'nueva@defensoria.gov.co');
    assert.equal(imported.name, '');
    assert.deepEqual(imported.roles, ['user']);
    const existing = users.find((user) => user.email === 'existente@defensoria.gov.co');
    assert.deepEqual(existing.roles, ['admin']);
    assert.equal(existing.enabled, false);

    const repeated = importManagedUsers(['nueva@defensoria.gov.co']);
    assert.equal(repeated.imported.length, 0);
    assert.deepEqual(repeated.skipped, ['nueva@defensoria.gov.co']);

    const semicolonPreview = analyzeUserCsv('correo;otra\ntercera@defensoria.gov.co;dato\n', users);
    assert.equal(semicolonPreview.summary.ready, 1);
    console.log('user-csv-import.test.js: OK');
  } finally {
    if (previousStore == null) delete process.env.AUTH_USER_STORE_PATH;
    else process.env.AUTH_USER_STORE_PATH = previousStore;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

run();
