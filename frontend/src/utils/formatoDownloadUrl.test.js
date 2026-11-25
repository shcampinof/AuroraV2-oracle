import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { normalizeFormatoDownloadUrl } from './formatoDownloadUrl.js';

const require = createRequire(import.meta.url);
const { normalizeFormatoDownloadUrl: serverUrl } = require('../../../backend/utils/formatoDownloadUrl.js');

describe('vista previa de descarga y normalización del servidor', () => {
  it.each([
    ' https://tenant.sharepoint.com/:w:/s/docs/id?e=abc&web=1#seccion ',
    'https://tenant.sharepoint.com/a?download=0&download=2',
    'https://onedrive.live.com/?id=a&authkey=b',
    'https://example.org/archivo.pdf?firma=abc%2F123&x=1#pagina',
    'https://sharepoint.com.example.org/a?web=1',
    'https://example.org/a?download=0',
  ])('genera la misma descarga para %s', (url) => {
    expect(normalizeFormatoDownloadUrl(url)).toBe(serverUrl(url));
  });

  it.each(['', 'archivo.docx', 'javascript:alert(1)', 'file:///tmp/a', 'https://user:password@example.org/a'])('rechaza el mismo enlace inválido: %s', (url) => {
    expect(() => normalizeFormatoDownloadUrl(url)).toThrow();
    expect(() => serverUrl(url)).toThrow();
  });
});
