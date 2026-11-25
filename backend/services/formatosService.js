const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { listFormatos: listInitialFormatos } = require('../data/formatos');
const { normalizeFormatoDownloadUrl } = require('../utils/formatoDownloadUrl');
const formatoColors = require('../../shared/formato-colors.json');
const allowedColors = new Set(formatoColors.map((option) => option.value));

function storePath() {
  return path.resolve(process.env.AURORA_FORMATOS_STORE_PATH || path.join(__dirname, '..', 'storage', 'formatos', 'catalogo.json'));
}

function withDefaults(formato) {
  return {
    ...formato,
    sourceUrl: formato.sourceUrl || formato.downloadUrl,
    color: formato.color || (formato.categoria === 'utilidad-publica' ? '#c23b73' : '#2563a6'),
    carpetaId: formato.carpetaId || null,
  };
}

function readStore(filePath) {
  try {
    const catalogo = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // Los catálogos anteriores contenían únicamente el arreglo de formatos.
    if (Array.isArray(catalogo)) return { version: 2, formatos: catalogo.map(withDefaults), carpetas: [] };
    if (catalogo?.version !== 2 || !Array.isArray(catalogo.formatos) || !Array.isArray(catalogo.carpetas)) {
      throw new Error('El catálogo de formatos no es válido.');
    }
    return { ...catalogo, formatos: catalogo.formatos.map(withDefaults) };
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 2, formatos: listInitialFormatos().map(withDefaults), carpetas: [] };
    throw error;
  }
}

function writeStore(filePath, catalogo) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(catalogo, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function invalid(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function validateChanges(data) {
  const titulo = typeof data?.titulo === 'string' ? data.titulo.trim() : '';
  if (!titulo || titulo.length > 250) throw invalid('Ingrese un título de hasta 250 caracteres.');
  if (typeof data?.color !== 'string' || !allowedColors.has(data.color.toLowerCase())) {
    throw invalid('Seleccione uno de los cinco colores de la paleta.');
  }
  const sourceUrl = typeof data?.sourceUrl === 'string' ? data.sourceUrl.trim() : '';
  let downloadUrl;
  try {
    downloadUrl = normalizeFormatoDownloadUrl(sourceUrl);
  } catch (error) {
    throw invalid(error.message);
  }
  return { titulo, color: data.color.toLowerCase(), sourceUrl, downloadUrl };
}

function listFormatos() {
  return readStore(storePath()).formatos;
}

function getFormatoById(id) {
  return listFormatos().find((formato) => formato.id === id);
}

function createFormato(data) {
  const changes = validateChanges(data);
  const filePath = storePath();
  const catalogo = readStore(filePath);
  const formato = { id: `f-${randomUUID()}`, ...changes, carpetaId: validateCarpetaId(data?.carpetaId, catalogo) };
  catalogo.formatos.push(formato);
  writeStore(filePath, catalogo);
  return formato;
}

function updateFormato(id, data) {
  const filePath = storePath();
  const catalogo = readStore(filePath);
  const index = catalogo.formatos.findIndex((formato) => formato.id === id);
  if (index < 0) throw Object.assign(new Error('Formato no encontrado.'), { status: 404 });
  const formato = {
    ...catalogo.formatos[index], ...validateChanges(data),
    carpetaId: validateCarpetaId(data?.carpetaId === undefined ? catalogo.formatos[index].carpetaId : data.carpetaId, catalogo),
  };
  catalogo.formatos[index] = formato;
  writeStore(filePath, catalogo);
  return formato;
}

function validateCarpetaId(id, catalogo) {
  if (id === undefined || id === null || id === '') return null;
  if (typeof id !== 'string' || !catalogo.carpetas.some((carpeta) => carpeta.id === id)) {
    throw invalid('La carpeta seleccionada no existe.');
  }
  return id;
}

function listCarpetas() {
  return readStore(storePath()).carpetas;
}

function saveCarpeta(data, id) {
  const filePath = storePath();
  const catalogo = readStore(filePath);
  const existing = id ? catalogo.carpetas.find((carpeta) => carpeta.id === id) : null;
  if (id && !existing) throw Object.assign(new Error('Carpeta no encontrada.'), { status: 404 });
  const nombre = typeof data?.nombre === 'string' ? data.nombre.trim() : '';
  if (!nombre || nombre.length > 100) throw invalid('Ingrese un nombre de carpeta de hasta 100 caracteres.');
  if (catalogo.carpetas.some((carpeta) => carpeta.id !== id && carpeta.nombre.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es'))) {
    throw invalid('Ya existe una carpeta con ese nombre.');
  }
  if (data.formatoIds !== undefined && (!Array.isArray(data.formatoIds)
    || data.formatoIds.some((formatoId) => typeof formatoId !== 'string' || !catalogo.formatos.some((formato) => formato.id === formatoId)))) {
    throw invalid('Seleccione únicamente ítems existentes.');
  }
  const carpeta = { id: existing?.id || `c-${randomUUID()}`, nombre };
  if (existing) catalogo.carpetas = catalogo.carpetas.map((item) => item.id === id ? carpeta : item);
  else catalogo.carpetas.push(carpeta);
  if (data.formatoIds !== undefined) {
    const selected = new Set(data.formatoIds);
    catalogo.formatos = catalogo.formatos.map((formato) => ({
      ...formato,
      carpetaId: selected.has(formato.id) ? carpeta.id : formato.carpetaId === carpeta.id ? null : formato.carpetaId,
    }));
  }
  writeStore(filePath, catalogo);
  return { carpeta, carpetas: catalogo.carpetas, formatos: catalogo.formatos };
}

function deleteCarpeta(id) {
  const filePath = storePath();
  const catalogo = readStore(filePath);
  if (!catalogo.carpetas.some((carpeta) => carpeta.id === id)) {
    throw Object.assign(new Error('Carpeta no encontrada.'), { status: 404 });
  }
  catalogo.carpetas = catalogo.carpetas.filter((carpeta) => carpeta.id !== id);
  catalogo.formatos = catalogo.formatos.map((formato) => formato.carpetaId === id ? { ...formato, carpetaId: null } : formato);
  writeStore(filePath, catalogo);
  return { carpetas: catalogo.carpetas, formatos: catalogo.formatos };
}

module.exports = { listFormatos, getFormatoById, createFormato, updateFormato, listCarpetas, saveCarpeta, deleteCarpeta };
