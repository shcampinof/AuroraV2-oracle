const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.NODE_ENV = 'test';
const store = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-pag-regional-'));
process.env.AUTH_USER_STORE_PATH = path.join(store, 'users.json');

async function testRoutes() {
  const express = require('express');
  const pagRepo = require('../repositories/oracle/pagRepository');
  const personaRepo = require('../repositories/oracle/personaRepository');
  const consolidado = require('../db/oracleConsolidado.repo');
  const { upsertManagedUser } = require('../services/userDirectoryService');
  upsertManagedUser({ id: 'linked', email: 'linked@example.test', roles: ['pag'], pagCedula: '11' });
  const regionals = { '11': 'BOYACÁ', '22': 'META', '33': '', '44': null };
  const cases = [
    { numero: '101', regional: 'BOYACÁ' },
    { numero: '102', regional: 'BOYACÁ' },
    { numero: '201', regional: 'META' },
    { numero: '202', regional: 'META' },
    { numero: '303', regional: '' },
  ];
  const listCalls = [];
  const countCalls = [];
  const filterCalls = [];
  const writes = [];
  const originals = { pag: pagRepo.findByCedula, list: personaRepo.listCondenadosSummary,
    count: personaRepo.countCondenadosSummary, options: personaRepo.listDistinctCondenadosFilterOptions,
    forbidden: personaRepo.listCondenadosOutsideRegional, assign: consolidado.assignDefensor,
    unassign: consolidado.unassignDefensor };
  const matched = (filters) => cases.filter((row) => !filters.regional || row.regional === filters.regional);
  pagRepo.findByCedula = async (cedula) => Object.hasOwn(regionals, cedula)
    ? { cedula, regional: regionals[cedula] } : null;
  personaRepo.listCondenadosSummary = async (options) => {
    listCalls.push(options);
    return { rows: matched(options.filters).slice(options.offset, options.offset + options.limit) };
  };
  personaRepo.countCondenadosSummary = async (options) => {
    countCalls.push(options);
    return matched(options.filters).length;
  };
  personaRepo.listDistinctCondenadosFilterOptions = async (options) => {
    filterCalls.push(options);
    return { departamentos: matched(options.filters).map((row) => row.regional), municipios: [], lugares: [], defensorOptions: [] };
  };
  personaRepo.listCondenadosOutsideRegional = async (documentos, regional) => cases
    .filter((row) => documentos.includes(row.numero) && (!regional || row.regional !== regional))
    .map((row) => row.numero);
  consolidado.assignDefensor = async (docs, _defensor, actor) => { writes.push({ docs, actor }); return docs.length; };
  consolidado.unassignDefensor = async (docs) => { writes.push({ docs }); return docs.length; };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: req.headers['x-test-user'] || 'unlinked', roles: [req.headers['x-test-role'] || 'pag'] };
    next();
  });
  app.use('/ppl', require('../routes/ppl'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  async function get(route, query, headers = {}) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/ppl/${route}?${new URLSearchParams(query)}`, { headers });
    return { status: response.status, body: await response.json(), cache: response.headers.get('x-aurora-cache') };
  }
  async function post(route, documentos, pagCedula, headers = {}) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/ppl/${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ documentos, pagCedula, defensor: 'DEFENSOR PRUEBA' }),
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    for (const cedula of ['11', '22', '33', '44', '11']) {
      const query = { tipo: 'condenado', pagCedula: cedula, page: '2', pageSize: '1' };
      const result = await get('condenados', query);
      assert.equal(result.status, 200);
      const expected = regionals[cedula] ? 2 : 5;
      assert.equal(result.body.meta.totalMatched, expected);
      assert.equal(result.body.meta.totalPages, expected);
      assert.deepEqual(result.body.rows.map((row) => row.numeroIdentificacion), [regionals[cedula] === 'META' ? '202' : '102']);
      assert.equal(result.body.rows[0].puedeAsignar, Boolean(regionals[cedula]), 'La caché conserva los permisos de cada PAG.');
      const options = await get('condenados/filter-options', query);
      assert.equal(options.status, 200);
      assert.equal(options.body.departamentos.length, regionals[cedula] ? 1 : 2);
    }
    assert.equal(listCalls.length, 3, 'La caché separa las regionales y la consulta sin regional.');
    assert.deepEqual(listCalls.map((call) => call.filters.regional), ['BOYACÁ', 'META', '']);
    assert.deepEqual(countCalls.map((call) => call.filters.regional), ['BOYACÁ', 'META', '']);
    assert.deepEqual(filterCalls.map((call) => call.filters.regional), ['BOYACÁ', 'META', '']);
    assert.equal(listCalls[0].offset, 1);
    const linked = await get('condenados', { tipo: 'condenado', pagCedula: '33' }, { 'x-test-user': 'linked' });
    assert.equal(linked.body.meta.totalMatched, 2);
    assert.deepEqual(linked.body.rows.map((row) => row.numeroIdentificacion), ['101', '102'], 'Prevalece la regional del PAG registrado.');
    const withoutCedula = await get('condenados', { tipo: 'condenado' }, { 'x-test-user': 'linked' });
    assert.deepEqual(withoutCedula.body.rows, linked.body.rows, 'Omitir la cédula conserva los permisos del PAG registrado.');
    const filtered = await get('condenados', { tipo: 'condenado', pagCedula: '11', regional: 'META' });
    assert.equal(filtered.body.meta.totalMatched, 2);
    assert.deepEqual(filtered.body.rows.map((row) => row.numeroIdentificacion), ['101', '102'], 'Cambiar un filtro no permite consultar otra regional en PAG.');
    const scopedOptions = await get('condenados/filter-options', { tipo: 'condenado', pagCedula: '11', regional: 'META' });
    assert.deepEqual(scopedOptions.body.departamentos, ['BOYACÁ']);
    assert.equal((await get('condenados', { tipo: 'condenado', pagCedula: '99' })).status, 400);
    for (const role of ['dndp', 'consulta']) {
      const response = await get('condenados', { tipo: 'condenado', pagCedula: '11' }, { 'x-test-role': role });
      assert.equal(response.body.meta.totalMatched, 5);
      assert.equal(response.body.rows[0].puedeAsignar, undefined, 'DNDP y Consulta no heredan permisos de PAG.');
    }
    const assigned = await get('condenados', { tipo: 'all', documento: '101' });
    assert.equal(assigned.status, 200);
    assert.equal(listCalls.at(-1).filters.regional, '', 'Usuarios asignados conserva su alcance.');
    for (const headers of [{ 'x-test-user': 'linked' }, { 'x-test-role': 'user' }]) {
      const allAssigned = await get('condenados', { tipo: 'all', nombre: 'CASO' }, headers);
      assert.equal(allAssigned.body.meta.totalMatched, 5, 'Usuarios asignados permite consultar todas las regionales a PAG y usuarios básicos.');
      const allOptions = await get('condenados/filter-options', { tipo: 'all' }, headers);
      assert.equal(allOptions.body.departamentos.length, 2);
    }
    for (const route of ['asignar-defensor', 'desasignar-defensor']) {
      const before = writes.length;
      for (const docs of [['201'], ['101', '201'], ['303']]) {
        const denied = await post(route, docs, '11');
        assert.equal(denied.status, 403);
        assert.equal(denied.body.code, 'PAG_REGIONAL_FORBIDDEN');
      }
      for (const cedula of ['33', '44']) {
        assert.equal((await post(route, ['101'], cedula)).status, 403, 'PAG sin regional tiene solo consulta en condenados.');
      }
      assert.equal((await post(route, ['201'], '22', { 'x-test-user': 'linked' })).status, 403, 'Cambiar la cédula no permite cambiar la regional registrada.');
      assert.equal(writes.length, before, 'Un lote con casos ajenos se rechaza antes de escribir.');
      assert.equal((await post(route, ['101', '102'], '11')).status, 200);
      assert.equal((await post(route, ['201'], '22')).status, 200);
      assert.equal((await post(route, ['201'], '', { 'x-test-role': 'dndp' })).status, 200);
      assert.equal((await post(route, ['404'], '11')).status, 200, 'El alcance de sindicados se conserva.');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    pagRepo.findByCedula = originals.pag;
    personaRepo.listCondenadosSummary = originals.list;
    personaRepo.countCondenadosSummary = originals.count;
    personaRepo.listDistinctCondenadosFilterOptions = originals.options;
    personaRepo.listCondenadosOutsideRegional = originals.forbidden;
    consolidado.assignDefensor = originals.assign;
    consolidado.unassignDefensor = originals.unassign;
  }
}

async function testFilterSql() {
  const pool = require('../db/oraclePool');
  const original = pool.execute;
  const captures = [];
  pool.execute = async (sql, binds) => { captures.push({ sql, binds }); return { rows: [] }; };
  const repositoryPath = require.resolve('../repositories/oracle/personaRepository');
  delete require.cache[repositoryPath];
  try {
    const repository = require(repositoryPath);
    const options = await repository.listDistinctCondenadosFilterOptions({ tipo: 'condenado', filters: { regional: 'BOYACÁ' } });
    assert.equal(captures.length, 4);
    assert.deepEqual(options.regionales, ['BOYACÁ']);
    for (const { sql, binds } of captures) {
      assert.equal(binds.regional, 'BOYACA');
      assert.match(sql, /report_erones AS/);
      assert.match(sql, /eron\.REGIONAL_KEY = :regional/);
    }
    captures.length = 0;
    await repository.listCondenadosOutsideRegional(['101', '201', '101'], 'BOYACÁ');
    assert.equal(captures.length, 1);
    assert.equal(captures[0].binds.regional, 'BOYACA');
    assert.equal(captures[0].binds.documento0, '101');
    assert.equal(captures[0].binds.documento1, '201');
    assert.match(captures[0].sql, /AND NOT \(/);
    assert.match(captures[0].sql, /eron\.REGIONAL_KEY = :regional/);
    assert.match(captures[0].sql, /NVL\(s.ACTIVO, 0\) = 1/);
    assert.match(captures[0].sql, /LIKE '%condenad%'/);
    captures.length = 0;
    await repository.listCondenadosOutsideRegional(['101'], '');
    assert.doesNotMatch(captures[0].sql, /report_erones/);
    assert.match(captures[0].sql, /AND 1=1/);
    captures.length = 0;
    await repository.listCondenadosOutsideRegional(Array.from({ length: 1001 }, (_, index) => String(index + 1)), 'META');
    assert.equal(captures.length, 2, 'Los lotes respetan el límite IN de Oracle.');
  } finally {
    pool.execute = original;
    delete require.cache[repositoryPath];
  }
}

testRoutes().then(testFilterSql).then(() => console.log('pag-regional-scope checks passed'))
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => fs.rmSync(store, { recursive: true, force: true }));
