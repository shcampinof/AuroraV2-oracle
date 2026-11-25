// Mantener el mismo resultado que backend/utils/formatoDownloadUrl.js.
// formatoDownloadUrl.test.js comprueba ambas implementaciones.
export function normalizeFormatoDownloadUrl(value) {
  const sourceUrl = typeof value === 'string' ? value.trim() : '';
  if (!sourceUrl || sourceUrl.length > 4096) {
    throw new Error('Ingrese un enlace de hasta 4096 caracteres.');
  }
  let url;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error('Ingrese un enlace completo que comience por https:// o http://.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('El enlace debe usar https:// o http:// y no debe incluir credenciales.');
  }
  const host = url.hostname.toLowerCase();
  if (host === 'sharepoint.com' || host.endsWith('.sharepoint.com') || host === 'onedrive.live.com') {
    url.searchParams.delete('web');
    url.searchParams.set('download', '1');
  }
  return url.toString();
}
