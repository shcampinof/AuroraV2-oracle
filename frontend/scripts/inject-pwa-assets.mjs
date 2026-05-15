import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const distRoot = path.join(frontendRoot, 'dist');
const assetsDir = path.join(distRoot, 'assets');
const serviceWorkerPath = path.join(distRoot, 'service-worker.js');
const placeholder = '  // AURORA_PRECACHE_ASSETS';

async function listAssetUrls() {
  const entries = await readdir(assetsDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => `/assets/${entry.name}`)
    .sort();
}

const assetUrls = await listAssetUrls();
const serviceWorker = await readFile(serviceWorkerPath, 'utf8');

if (!serviceWorker.includes(placeholder)) {
  throw new Error('No se encontro el marcador AURORA_PRECACHE_ASSETS en service-worker.js');
}

const injected = assetUrls.length
  ? assetUrls.map((url) => `  ${JSON.stringify(url)}`).join(',\n')
  : placeholder;

await writeFile(serviceWorkerPath, serviceWorker.replace(placeholder, injected), 'utf8');

console.log(`[pwa] Assets precacheados en service-worker.js: ${assetUrls.length}`);
