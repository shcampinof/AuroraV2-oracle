const express = require('express');
const router = express.Router();

const { listFormatos, getFormatoById } = require('../data/formatos');

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
