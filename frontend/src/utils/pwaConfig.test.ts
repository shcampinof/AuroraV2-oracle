import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');

function readPublicFile(relativePath: string) {
  return readFileSync(path.join(frontendRoot, 'public', relativePath), 'utf8');
}

describe('PWA configuration', () => {
  it('declares an installable manifest with scoped Aurora metadata', () => {
    const manifest = JSON.parse(readPublicFile('manifest.json'));

    expect(manifest.name).toContain('Aurora');
    expect(manifest.short_name).toBe('Aurora');
    expect(manifest.id).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('es-CO');
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192', purpose: 'any maskable' }),
        expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512', purpose: 'any maskable' }),
      ])
    );
  });

  it('keeps API reads out of the app shell cache and queues only controlled writes', () => {
    const serviceWorker = readPublicFile('service-worker.js');

    expect(serviceWorker).toContain("const QUEUE_MAX_ITEMS = 75");
    expect(serviceWorker).toContain("const QUEUE_MAX_BODY_BYTES = 256 * 1024");
    expect(serviceWorker).toContain("pathname === '/api' || pathname.startsWith('/api/')");
    expect(serviceWorker).toContain("method === 'PUT' && /^\\/api\\/ppl\\/[^/]+$/.test(pathname)");
    expect(serviceWorker).toContain("method === 'POST' && /^\\/api\\/ppl\\/[^/]+\\/actuaciones$/.test(pathname)");
    expect(serviceWorker).toContain("method === 'POST' && pathname === '/api/ppl/asignar-defensor'");
    expect(serviceWorker).toContain("method === 'POST' && pathname === '/api/defensores'");
    expect(serviceWorker).toContain("status: 202");
    expect(serviceWorker).toContain("'X-Aurora-Queued': 'true'");
  });

  it('uses a build-time placeholder for Vite hashed assets', () => {
    const serviceWorker = readPublicFile('service-worker.js');

    expect(serviceWorker).toContain('AURORA_PRECACHE_ASSETS');
    expect(serviceWorker).toContain('...BUILD_ASSETS');
  });
});
