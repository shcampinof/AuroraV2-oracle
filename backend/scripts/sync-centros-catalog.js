const fs = require('fs/promises');
const path = require('path');
const { normalizeWhitespace } = require('../utils/textNormalization');

const DATASET_ID = '24zf-4cfu';
const DATASET_URL = `https://www.datos.gov.co/resource/${DATASET_ID}.json?$limit=500`;
const CATALOG_PATH = path.join(__dirname, '..', 'catalogs', 'centros-reclusion.v1.json');
const ALIASES_PATH = path.join(__dirname, '..', 'catalogs', 'centros-reclusion.aliases.v1.json');

async function readCurrentAliases() {
  try {
    const current = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
    return new Map(
      (current?.items || []).map((item) => [
        String(item?.id || '').trim(),
        Array.isArray(item?.aliases) ? item.aliases : [],
      ])
    );
  } catch (error) {
    if (error?.code === 'ENOENT') return new Map();
    throw error;
  }
}

async function main() {
  const response = await fetch(DATASET_URL, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`No fue posible descargar el directorio oficial (${response.status}).`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length < 100) {
    throw new Error(`Directorio oficial incompleto: ${Array.isArray(rows) ? rows.length : 0} filas.`);
  }

  const previousAliases = await readCurrentAliases();
  const curatedConfig = JSON.parse(await fs.readFile(ALIASES_PATH, 'utf8')) || {};
  const curatedAliases = curatedConfig.aliasesById || {};
  const preferredLabels = curatedConfig.preferredLabelsById || {};
  const ids = new Set();
  const items = rows
    .map((row) => {
      const code = normalizeWhitespace(row?.cod_establecimiento).replace(/\D+/g, '');
      const officialLabel = normalizeWhitespace(row?.nombre_establecimiento_sisipec);
      if (!code || !officialLabel) return null;
      const id = `INPEC_${code}`;
      if (ids.has(id)) throw new Error(`Código INPEC duplicado: ${code}`);
      ids.add(id);
      const label = normalizeWhitespace(preferredLabels[id]) || officialLabel;
      const aliases = Array.from(new Set([
        label,
        officialLabel,
        ...(previousAliases.get(id) || []),
        ...(Array.isArray(curatedAliases[id]) ? curatedAliases[id] : []),
      ].map(normalizeWhitespace).filter(Boolean)));
      return { id, label, aliases };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.id.slice(6)) - Number(b.id.slice(6)));

  const catalog = {
    schemaVersion: 1,
    catalogVersion: 'INPEC-2025-07-31',
    source: {
      datasetId: DATASET_ID,
      name: 'Directorio de Establecimientos de Reclusión de Orden Nacional',
      owner: 'Instituto Nacional Penitenciario y Carcelario - INPEC',
      dataLastUpdated: '2025-07-31',
      url: `https://www.datos.gov.co/resource/${DATASET_ID}`,
    },
    items,
  };

  await fs.writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log(`Catálogo actualizado: ${items.length} establecimientos oficiales.`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
