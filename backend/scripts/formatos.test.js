const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const previous = { ...process.env };
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-formatos-'));
Object.assign(process.env, {
  NODE_ENV: 'test', AUTH_USER_ACCESS_MODE: 'open', AUTH_LOCAL_ADMIN_ENABLED: 'false',
  AUTH_USER_STORE_PATH: path.join(temp, 'users.json'),
  AURORA_FORMATOS_STORE_PATH: path.join(temp, 'formatos', 'catalogo.json'),
});
delete process.env.AUTH_USER_ALLOWLIST_ENABLED;
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { signAppToken } = require('../services/authService');
const { upsertManagedUser, updateManagedUser } = require('../services/userDirectoryService');
const { normalizeFormatoDownloadUrl } = require('../utils/formatoDownloadUrl');
const { listFormatos: initialFormatos } = require('../data/formatos');
const formatoColors = require('../../shared/formato-colors.json');
const app = express();
app.use(express.json());
app.use('/formatos', requireAuth, require('../routes/formatos'));
app.use((err, req, res, _next) => res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno' }));

async function run() {
  const cases = [
    [' https://tenant.sharepoint.com/:w:/s/docs/id?e=abc&web=1#seccion ', 'https://tenant.sharepoint.com/:w:/s/docs/id?e=abc&download=1#seccion'],
    ['https://tenant.sharepoint.com/a?download=0&download=2', 'https://tenant.sharepoint.com/a?download=1'],
    ['https://onedrive.live.com/?id=a&authkey=b', 'https://onedrive.live.com/?id=a&authkey=b&download=1'],
    ['https://example.org/archivo.pdf?firma=abc%2F123&x=1#pagina', 'https://example.org/archivo.pdf?firma=abc%2F123&x=1#pagina'],
    ['https://sharepoint.com.example.org/a?web=1', 'https://sharepoint.com.example.org/a?web=1'],
    ['https://example.org/a?download=0', 'https://example.org/a?download=0'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(normalizeFormatoDownloadUrl(input), expected);
    assert.equal(normalizeFormatoDownloadUrl(expected), expected);
  }
  for (const input of ['', 'archivo.docx', 'javascript:alert(1)', 'data:text/plain,a', 'file:///tmp/a', 'ftp://example.org/a', 'https://user:password@example.org/a', `https://example.org/${'a'.repeat(4096)}`]) {
    assert.throws(() => normalizeFormatoDownloadUrl(input));
  }

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/formatos`;
  const user = upsertManagedUser({ email: 'formatos-admin@example.test', roles: ['admin'], enabled: true });
  const admin = signAppToken({ ...user, provider: 'ldap' });
  const token = (roles) => signAppToken({ id: `formatos-${roles.join('-')}`, email: `${roles.join('-')}@example.test`, provider: 'ldap', roles });
  const reader = token(['user']);
  let checks = 0;
  async function request(method, suffix, auth, expected, body) {
    const res = await fetch(`${base}${suffix}`, {
      method, redirect: 'manual',
      headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(res.status, expected, `${method} ${suffix}`);
    checks += 1;
    return res;
  }
  try {
    const payload = { titulo: ' Formato nuevo ', color: '#2563A6', sourceUrl: cases[0][0] };
    for (const [method, suffix] of [['GET', ''], ['POST', ''], ['PUT', '/f3'], ['GET', '/carpetas'], ['POST', '/carpetas'], ['PUT', '/carpetas/c1'], ['DELETE', '/carpetas/c1']]) {
      await request(method, suffix, '', 401, method === 'GET' ? undefined : payload);
    }
    for (const roles of [['user'], ['pag'], ['dndp'], ['carguebd'], ['consulta'], ['admin', 'consulta']]) {
      await request('GET', '', token(roles), 200);
      await request('POST', '', token(roles), 403, payload);
      await request('PUT', '/f3', token(roles), 403, payload);
      await request('GET', '/carpetas', token(roles), 200);
      await request('POST', '/carpetas', token(roles), 403, { nombre: 'No autorizada' });
      await request('PUT', '/carpetas/c1', token(roles), 403, { nombre: 'No autorizada' });
      await request('DELETE', '/carpetas/c1', token(roles), 403);
    }
    assert.equal(fs.existsSync(process.env.AURORA_FORMATOS_STORE_PATH), false, 'Las lecturas y rechazos no crean el almacén');
    const initial = await (await request('GET', '', reader, 200)).json();
    assert.equal(initial.length, initialFormatos().length);
    for (const item of initialFormatos()) {
      assert.equal(initial.find((f) => f.id === item.id).downloadUrl, item.downloadUrl);
    }
    assert.deepEqual(await (await request('GET', '/carpetas', reader, 200)).json(), []);
    // Un catálogo persistido en el formato anterior se migra en el primer cambio.
    fs.mkdirSync(path.dirname(process.env.AURORA_FORMATOS_STORE_PATH), { recursive: true });
    fs.writeFileSync(process.env.AURORA_FORMATOS_STORE_PATH, JSON.stringify(initialFormatos()));
    assert.deepEqual(await (await request('GET', '', reader, 200)).json(), initial);
    let created = await (await request('POST', '', admin, 201, { ...payload, id: 'f3' })).json();
    assert.notEqual(created.id, 'f3');
    assert.equal(created.titulo, 'Formato nuevo');
    assert.equal(created.color, '#2563a6');
    assert.equal(created.sourceUrl, payload.sourceUrl.trim());
    assert.equal(created.downloadUrl, cases[0][1]);
    assert.equal((await (await request('GET', '', reader, 200)).json()).length, initial.length + 1);
    assert.equal(formatoColors.length, 5);
    assert.deepEqual(formatoColors.map((option) => option.label), ['Azul', 'Rosa', 'Verde', 'Morado', 'Naranja']);
    for (const option of formatoColors) {
      created = await (await request('PUT', `/${created.id}`, admin, 200, { ...payload, color: option.value })).json();
      assert.equal(created.color, option.value);
    }

    const existing = initial.find((f) => f.categoria === 'utilidad-publica');
    const updated = await (await request('PUT', `/${existing.id}`, admin, 200, {
      ...payload, titulo: 'Título actualizado', color: '#7552a3', sourceUrl: 'https://example.org/nuevo.docx',
    })).json();
    assert.equal(updated.id, existing.id);
    assert.equal(updated.categoria, existing.categoria);
    assert.equal(updated.color, '#7552a3');
    assert.equal((await (await request('GET', `/${existing.id}/download-url`, reader, 200)).json()).downloadUrl, updated.downloadUrl);
    const redirect = await request('GET', `/${existing.id}/download`, reader, 302);
    assert.equal(redirect.headers.get('location'), updated.downloadUrl);
    assert.equal(redirect.headers.get('cache-control'), 'no-store');

    const firstFolder = await (await request('POST', '/carpetas', admin, 201, { nombre: ' Solicitudes ', formatoIds: [created.id, existing.id] })).json();
    const carpetaId = firstFolder.carpeta.id;
    assert.equal(firstFolder.carpeta.nombre, 'Solicitudes');
    assert.deepEqual(firstFolder.formatos.filter((f) => f.carpetaId === carpetaId).map((f) => f.id).sort(), [created.id, existing.id].sort());
    assert.deepEqual(firstFolder.formatos.find((f) => f.id === existing.id), { ...updated, carpetaId });
    assert.equal(JSON.parse(fs.readFileSync(process.env.AURORA_FORMATOS_STORE_PATH, 'utf8')).version, 2);
    assert.deepEqual(await (await request('GET', '/carpetas', reader, 200)).json(), [firstFolder.carpeta]);

    const invalidFolderBefore = fs.readFileSync(process.env.AURORA_FORMATOS_STORE_PATH, 'utf8');
    for (const bad of [{ nombre: '' }, { nombre: 'x'.repeat(101) }, { nombre: 123 }, { nombre: 'solicitudes' }, { nombre: 'Otra', formatoIds: ['no-existe'] }, { nombre: 'Otra', formatoIds: 'f3' }, { nombre: 'Otra', formatoIds: [null] }]) {
      await request('POST', '/carpetas', admin, 400, bad);
    }
    await request('PUT', `/carpetas/${carpetaId}`, admin, 400, { nombre: ' ', formatoIds: [] });
    await request('PUT', '/carpetas/no-existe', admin, 404, { nombre: 'Otra' });
    await request('DELETE', '/carpetas/no-existe', admin, 404);
    for (const badId of ['no-existe', 123, {}, []]) {
      await request('POST', '', admin, 400, { ...payload, carpetaId: badId });
      await request('PUT', `/${created.id}`, admin, 400, { ...payload, carpetaId: badId });
    }
    assert.equal(fs.readFileSync(process.env.AURORA_FORMATOS_STORE_PATH, 'utf8'), invalidFolderBefore, 'Los cambios inválidos no alteran el catálogo');

    const renamed = await (await request('PUT', `/carpetas/${carpetaId}`, admin, 200, { nombre: 'Documentos' })).json();
    assert.equal(renamed.carpeta.nombre, 'Documentos');
    assert.equal(renamed.formatos.filter((f) => f.carpetaId === carpetaId).length, 2, 'Renombrar sin selección conserva los ítems');
    const otherFolder = await (await request('POST', '/carpetas', admin, 201, { nombre: 'Otra', formatoIds: [created.id] })).json();
    const otherId = otherFolder.carpeta.id;
    assert.equal(otherFolder.formatos.find((f) => f.id === created.id).carpetaId, otherId, 'Mover agrupa el ítem en una única carpeta');
    await request('PUT', `/carpetas/${otherId}`, admin, 400, { nombre: 'DOCUMENTOS' });

    const folderItem = await (await request('POST', '', admin, 201, { ...payload, carpetaId })).json();
    assert.equal(folderItem.carpetaId, carpetaId);
    const keptFolderItem = await (await request('PUT', `/${folderItem.id}`, admin, 200, { ...payload, titulo: 'Editado' })).json();
    assert.equal(keptFolderItem.carpetaId, carpetaId, 'Clientes anteriores conservan la carpeta al editar');
    const movedItem = await (await request('PUT', `/${folderItem.id}`, admin, 200, { ...payload, carpetaId: otherId })).json();
    assert.equal(movedItem.carpetaId, otherId);
    const removedItem = await (await request('PUT', `/${folderItem.id}`, admin, 200, { ...payload, carpetaId: null })).json();
    assert.equal(removedItem.carpetaId, null);
    const ungrouped = await (await request('PUT', `/carpetas/${otherId}`, admin, 200, { nombre: 'Otra', formatoIds: [] })).json();
    assert.equal(ungrouped.formatos.find((f) => f.id === created.id).carpetaId, null);

    delete require.cache[require.resolve('../services/formatosService')];
    const folderService = require('../services/formatosService');
    assert.deepEqual(folderService.listCarpetas(), ungrouped.carpetas, 'Las carpetas sobreviven al reinicio');
    assert.deepEqual(folderService.listFormatos(), ungrouped.formatos, 'La agrupación sobrevive al reinicio');
    const deleted = await (await request('DELETE', `/carpetas/${carpetaId}`, admin, 200)).json();
    assert.equal(deleted.formatos.length, ungrouped.formatos.length, 'Eliminar carpetas conserva todos los documentos');
    assert.equal(deleted.formatos.find((f) => f.id === existing.id).carpetaId, null);
    assert.deepEqual(deleted.carpetas, [otherFolder.carpeta]);
    assert.equal((await (await request('GET', `/${existing.id}/download-url`, reader, 200)).json()).downloadUrl, updated.downloadUrl);
    await request('DELETE', `/carpetas/${otherId}`, admin, 200);

    const before = fs.readFileSync(process.env.AURORA_FORMATOS_STORE_PATH, 'utf8');
    for (const bad of [{ titulo: '' }, { titulo: 'x'.repeat(251) }, { color: 'red' }, { color: '#ffffff' }, { color: '#aabbcc' }, { sourceUrl: 'javascript:alert(1)' }, { sourceUrl: '' }]) {
      await request('POST', '', admin, 400, { ...payload, ...bad });
      await request('PUT', '/f3', admin, 400, { ...payload, ...bad });
    }
    await request('PUT', '/no-existe', admin, 404, payload);
    await request('GET', '/no-existe/download-url', reader, 404);
    assert.equal(fs.readFileSync(process.env.AURORA_FORMATOS_STORE_PATH, 'utf8'), before);
    updateManagedUser(user.id, { roles: ['user'] });
    await request('PUT', '/f3', admin, 403, payload);
    await request('POST', '/carpetas', admin, 403, { nombre: 'Sin permisos' });
    await request('PUT', `/carpetas/${carpetaId}`, admin, 403, { nombre: 'Sin permisos' });
    await request('DELETE', `/carpetas/${carpetaId}`, admin, 403);
    assert.equal(fs.readFileSync(process.env.AURORA_FORMATOS_STORE_PATH, 'utf8'), before);

    // La recarga del módulo simula un reinicio sin perder altas ni cambios.
    delete require.cache[require.resolve('../services/formatosService')];
    const reloaded = require('../services/formatosService').listFormatos();
    assert.deepEqual(reloaded.find((f) => f.id === created.id), created);
    assert.deepEqual(reloaded.find((f) => f.id === updated.id), updated);
    fs.writeFileSync(process.env.AURORA_FORMATOS_STORE_PATH, '{invalid');
    await request('GET', '', reader, 500);
    await request('GET', '/carpetas', reader, 500);
    assert.throws(() => require('../services/formatosService').createFormato(payload));
    assert.throws(() => require('../services/formatosService').saveCarpeta({ nombre: 'Carpeta' }));
    assert.equal(fs.readFileSync(process.env.AURORA_FORMATOS_STORE_PATH, 'utf8'), '{invalid');
    console.log(JSON.stringify({ suite: 'formatos', ok: true, httpChecks: checks, urlCases: cases.length, initialItems: initial.length }));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  fs.rmSync(temp, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
  Object.assign(process.env, previous);
});
