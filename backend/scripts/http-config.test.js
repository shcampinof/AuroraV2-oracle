const assert = require('node:assert/strict');
const express = require('express');
const { getTrustProxy, requestOrigin } = require('../config/http');

async function checkProxy(trust, expectedIp, expectedProtocol) {
  const app = express();
  app.set('trust proxy', trust);
  app.get('/', (req, res) => res.json({ ip: req.ip, origin: requestOrigin(req) }));
  const server = await new Promise((resolve) => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  try {
    const host = `127.0.0.1:${server.address().port}`;
    const response = await fetch(`http://${host}`, { headers: {
      'X-Forwarded-For': '203.0.113.77', 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'forged.example.test',
    } });
    assert.deepEqual(await response.json(), { ip: expectedIp, origin: `${expectedProtocol}://${host}` });
  } finally { await new Promise((resolve) => server.close(resolve)); }
}

(async () => {
  assert.equal(getTrustProxy(''), false);
  assert.equal(getTrustProxy('false'), false);
  assert.equal(getTrustProxy('1'), 1);
  assert.deepEqual(getTrustProxy('loopback, 10.0.0.0/8'), ['loopback', '10.0.0.0/8']);
  assert.throws(() => getTrustProxy('true'), /no se admite true/);
  await checkProxy(getTrustProxy('false'), '127.0.0.1', 'http');
  await checkProxy(getTrustProxy('loopback'), '203.0.113.77', 'https');
  console.log('http-config: OK (IP y origen directos; proxy explícitamente confiable)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
