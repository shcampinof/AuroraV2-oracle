function getTrustProxy(value = process.env.TRUST_PROXY) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.toLowerCase() === 'false' || raw === '0') return false;
  if (raw.toLowerCase() === 'true') {
    throw new Error('TRUST_PROXY debe identificar los proxies confiables o su número de saltos; no se admite true.');
  }
  return /^\d+$/.test(raw) ? Number(raw) : raw.split(',').map((part) => part.trim()).filter(Boolean);
}

function requestOrigin(req) {
  const host = req.get('host');
  return host ? `${req.protocol || 'http'}://${host}` : '';
}

module.exports = { getTrustProxy, requestOrigin };
