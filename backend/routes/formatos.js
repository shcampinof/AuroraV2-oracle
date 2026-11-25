const express = require('express');
const router = express.Router();

const { listFormatos, getFormatoById, createFormato, updateFormato, listCarpetas, saveCarpeta, deleteCarpeta } = require('../services/formatosService');
const { requireAdmin } = require('../middleware/roles');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function getConfiguredDownloadUrl(id) {
  const formato = getFormatoById(id);
  if (!formato) return { status: 404, body: { message: 'Formato no encontrado' } };

  const downloadUrl = String(formato.downloadUrl || '').trim();
  if (!downloadUrl) {
    return { status: 404, body: { message: 'Link de descarga no configurado para este formato' } };
  }

  return { status: 200, formato, downloadUrl };
}

// GET /api/formatos
router.get('/', (req, res) => {
  res.json(listFormatos());
});

router.post('/', requireAdmin, (req, res) => {
  res.status(201).json(createFormato(req.body));
});

router.get('/carpetas', (req, res) => {
  res.json(listCarpetas());
});

router.post('/carpetas', requireAdmin, (req, res) => {
  res.status(201).json(saveCarpeta(req.body));
});

router.put('/carpetas/:id', requireAdmin, (req, res) => {
  res.json(saveCarpeta(req.body, String(req.params.id)));
});

router.delete('/carpetas/:id', requireAdmin, (req, res) => {
  res.json(deleteCarpeta(String(req.params.id)));
});

router.put('/:id', requireAdmin, (req, res) => {
  res.json(updateFormato(String(req.params.id), req.body));
});

// GET /api/formatos/:id/download-url
router.get('/:id/download-url', (req, res) => {
  const id = String(req.params.id || '').trim();
  const result = getConfiguredDownloadUrl(id);
  if (result.status !== 200) return res.status(result.status).json(result.body);

  return res.json({ id: result.formato.id, downloadUrl: result.downloadUrl });
});

// GET /api/formatos/:id/download
router.get('/:id/download', (req, res) => {
  const id = String(req.params.id || '').trim();
  const result = getConfiguredDownloadUrl(id);
  if (result.status !== 200) return res.status(result.status).json(result.body);

  return res.redirect(result.downloadUrl);
});

module.exports = router;
