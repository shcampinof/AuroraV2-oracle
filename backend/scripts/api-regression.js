const API_BASE = String(process.env.API_BASE_URL || 'http://localhost:7860/api').replace(/\/+$/, '');

async function fetchJson(path) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  try {
    const checks = [];
    checks.push({ name: 'health', ...(await fetchJson('/health')) });
    checks.push({ name: 'health/db', ...(await fetchJson('/health/db')) });
    checks.push({ name: 'ppl/condenados', ...(await fetchJson('/ppl/condenados?limit=5')) });

    const firstDoc = checks[2]?.data?.rows?.[0]?.numeroIdentificacion;
    if (firstDoc) {
      checks.push({ name: 'ppl/:documento', ...(await fetchJson(`/ppl/${encodeURIComponent(firstDoc)}`)) });
      checks.push({ name: 'ppl/:documento/actuaciones', ...(await fetchJson(`/ppl/${encodeURIComponent(firstDoc)}/actuaciones`)) });
    }

    const failed = checks.filter((check) => Number(check.status) >= 400);
    console.log(JSON.stringify({ apiBase: API_BASE, checks }, null, 2));
    process.exitCode = failed.length ? 1 : 0;
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err?.message || String(err) }, null, 2));
    process.exitCode = 1;
  }
})();