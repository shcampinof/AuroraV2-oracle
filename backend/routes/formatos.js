const express = require('express');
const router = express.Router();

const { listFormatos, getFormatoById } = require('../data/formatos.mock');

const FORMATOS_BASE_URL =
  process.env.FORMATOS_BASE_URL ||
  'https://raw.githubusercontent.com/shcampinof/AuroraV1/main/backend/public/formatos';

// GET /api/formatos
router.get('/', (req, res) => {
  res.json(listFormatos());
});

// GET /api/formatos/:id/download
router.get('/:id/download', (req, res) => {
  const id = String(req.params.id || '').trim();
  const formato = getFormatoById(id);
  if (!formato) return res.status(404).json({ message: 'Formato no encontrado' });

  const externalUrl = `${FORMATOS_BASE_URL}/${encodeURIComponent(formato.filename)}`;
  return res.redirect(externalUrl);
});

module.exports = router;
