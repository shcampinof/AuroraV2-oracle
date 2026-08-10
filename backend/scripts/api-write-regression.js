const path = require('path');

require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env.test') });

const API_BASE = String(process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 7860}/api`).replace(/\/+$/, '');
const API_AUTH_TOKEN = String(process.env.API_AUTH_TOKEN || '').trim();
const API_LOGIN_USERNAME = String(process.env.API_LOGIN_USERNAME || process.env.AUTH_LOCAL_ADMIN_USERNAME || 'admin').trim();
const API_LOGIN_PASSWORD = String(process.env.API_LOGIN_PASSWORD || process.env.AUTH_LOCAL_ADMIN_PASSWORD || 'admin').trim();
const TEST_DOCUMENTO = String(process.env.API_TEST_DOCUMENTO || '900000001').trim();
const TEST_PAG_CEDULA = String(process.env.API_TEST_PAG_CEDULA || '900001').trim();
const TEST_DEFENSOR_CEDULA = String(process.env.API_TEST_DEFENSOR_CEDULA || '900002').trim();

async function fetchJson(route, options = {}) {
  const url = `${API_BASE}${route}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_err) {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function loginToken() {
  if (API_AUTH_TOKEN) return API_AUTH_TOKEN;

  const { status, data } = await fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: API_LOGIN_USERNAME,
      password: API_LOGIN_PASSWORD,
    }),
  });

  if (status >= 400 || !data?.token) {
    const message = data?.message || 'No fue posible obtener token de autenticacion.';
    throw new Error(`${message} Configure API_AUTH_TOKEN o API_LOGIN_USERNAME/API_LOGIN_PASSWORD.`);
  }

  return data.token;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function assertStatus(check, expected) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(Number(check.status))) {
    throw new Error(`${check.name} devolvio HTTP ${check.status}; se esperaba ${allowed.join(' o ')}`);
  }
}

function lettersSuffix() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let value = Date.now();
  let out = '';
  for (let i = 0; i < 5; i += 1) {
    out += alphabet[value % alphabet.length];
    value = Math.floor(value / alphabet.length);
  }
  return out;
}

(async () => {
  const checks = [];
  try {
    const token = await loginToken();
    const headers = authHeaders(token);
    const marker = `Prueba automatizada ${new Date().toISOString()}`;

    checks.push({ name: 'health', ...(await fetchJson('/health')) });
    assertStatus(checks.at(-1), 200);

    checks.push({ name: 'health/db', ...(await fetchJson('/health/db')) });
    assertStatus(checks.at(-1), 200);

    checks.push({ name: 'ppl/:documento antes', ...(await fetchJson(`/ppl/${encodeURIComponent(TEST_DOCUMENTO)}`, { headers })) });
    assertStatus(checks.at(-1), 200);

    checks.push({
      name: 'ppl/:documento put gestion',
      ...(await fetchJson(`/ppl/${encodeURIComponent(TEST_DOCUMENTO)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          'Resumen del analisis del caso': marker,
          'Fecha de analisis juridico del caso': '2026-05-12',
        }),
      })),
    });
    assertStatus(checks.at(-1), 200);

    checks.push({
      name: 'ppl/:documento post actuacion',
      ...(await fetchJson(`/ppl/${encodeURIComponent(TEST_DOCUMENTO)}/actuaciones`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          'Accion a realizar': 'Seguimiento de prueba automatizada',
          'Resumen del analisis del caso': marker,
          'Fecha de entrevista': '2026-05-12',
        }),
      })),
    });
    assertStatus(checks.at(-1), 201);

    const defensorCedula = String(990000000 + Math.floor(Math.random() * 999999));
    checks.push({
      name: 'defensores post',
      ...(await fetchJson('/defensores', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          cedula: defensorCedula,
          nombre: `DEFENSOR PRUEBA ${lettersSuffix()}`,
          correo: `defensor.${defensorCedula}@example.test`,
          regional: 'REGIONAL PRUEBAS',
          cedulaPag: TEST_PAG_CEDULA,
        }),
      })),
    });
    assertStatus(checks.at(-1), 201);

    checks.push({
      name: 'ppl/asignar-defensor',
      ...(await fetchJson('/ppl/asignar-defensor', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          documentos: [TEST_DOCUMENTO],
          defensorCedula: TEST_DEFENSOR_CEDULA,
          pagCedula: TEST_PAG_CEDULA,
        }),
      })),
    });
    assertStatus(checks.at(-1), 200);

    checks.push({
      name: 'ppl/:documento/actuaciones despues',
      ...(await fetchJson(`/ppl/${encodeURIComponent(TEST_DOCUMENTO)}/actuaciones`, { headers })),
    });
    assertStatus(checks.at(-1), 200);

    const actuaciones = checks.at(-1)?.data?.actuaciones;
    if (!Array.isArray(actuaciones) || actuaciones.length < 1) {
      throw new Error('El historial de actuaciones no devolvio registros despues de crear una actuacion.');
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          apiBase: API_BASE,
          documento: TEST_DOCUMENTO,
          checks: checks.map((check) => ({ name: check.name, status: check.status })),
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          apiBase: API_BASE,
          documento: TEST_DOCUMENTO,
          error: err?.message || String(err),
          checks: checks.map((check) => ({ name: check.name, status: check.status, data: check.data })),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  }
})();
