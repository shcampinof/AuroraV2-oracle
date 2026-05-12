const API_BASE = String(process.env.API_BASE_URL || 'http://localhost:7860/api').replace(/\/+$/, '');
const API_AUTH_TOKEN = String(process.env.API_AUTH_TOKEN || '').trim();
const API_LOGIN_USERNAME = String(process.env.API_LOGIN_USERNAME || 'admin').trim();
const API_LOGIN_PASSWORD = String(process.env.API_LOGIN_PASSWORD || 'admin').trim();

async function fetchJson(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function loginToken() {
  if (API_AUTH_TOKEN) return API_AUTH_TOKEN;
  if (!API_LOGIN_USERNAME || !API_LOGIN_PASSWORD) return '';

  const { status, data } = await fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: API_LOGIN_USERNAME,
      password: API_LOGIN_PASSWORD,
    }),
  });

  if (status >= 400 || !data?.token) {
    const message = data?.message || 'No fue posible obtener token de autenticación.';
    throw new Error(`${message} Configure API_AUTH_TOKEN o API_LOGIN_USERNAME/API_LOGIN_PASSWORD.`);
  }

  return data.token;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

(async () => {
  try {
    const checks = [];
    checks.push({ name: 'health', ...(await fetchJson('/health')) });
    checks.push({ name: 'health/db', ...(await fetchJson('/health/db')) });

    const token = await loginToken();
    const authenticatedOptions = { headers: authHeaders(token) };
    checks.push({ name: 'ppl/condenados', ...(await fetchJson('/ppl/condenados?limit=5', authenticatedOptions)) });

    const firstDoc = checks[2]?.data?.rows?.[0]?.numeroIdentificacion;
    if (firstDoc) {
      checks.push({ name: 'ppl/:documento', ...(await fetchJson(`/ppl/${encodeURIComponent(firstDoc)}`, authenticatedOptions)) });
      checks.push({ name: 'ppl/:documento/actuaciones', ...(await fetchJson(`/ppl/${encodeURIComponent(firstDoc)}/actuaciones`, authenticatedOptions)) });
    }

    const failed = checks.filter((check) => Number(check.status) >= 400);
    console.log(JSON.stringify({ apiBase: API_BASE, checks }, null, 2));
    process.exitCode = failed.length ? 1 : 0;
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err?.message || String(err) }, null, 2));
    process.exitCode = 1;
  }
})();
