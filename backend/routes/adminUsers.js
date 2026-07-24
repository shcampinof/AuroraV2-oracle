const express = require('express');
const path = require('path');
const multer = require('multer');
const { normalizeRoles } = require('../services/authService');
const {
  deleteManagedUser,
  importManagedUsers,
  listUsers,
  updateManagedUser,
  upsertManagedUser,
} = require('../services/userDirectoryService');
const { analyzeUserCsv } = require('../services/userCsvImportService');

const router = express.Router();

function hasAdminAccess(user) {
  const roles = normalizeRoles(user?.roles, []);
  return roles.includes('admin');
}

function requireAdmin(req, res, next) {
  if (hasAdminAccess(req.user)) return next();
  return res.status(403).json({
    message: 'No tiene permisos para administrar usuarios.',
    code: 'ADMIN_USERS_FORBIDDEN',
  });
}

function cleanUserPayload(body) {
  return {
    email: String(body?.email || '').trim().toLowerCase(),
    name: String(body?.name || '').trim(),
    roles: Array.isArray(body?.roles) ? body.roles : String(body?.roles || '').split(','),
    enabled: body?.enabled == null ? true : Boolean(body.enabled),
  };
}

function cleanPatchPayload(body) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body || {}, 'email')) {
    patch.email = String(body.email || '').trim().toLowerCase();
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'name')) {
    patch.name = String(body.name || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'roles')) {
    patch.roles = Array.isArray(body.roles) ? body.roles : String(body.roles || '').split(',');
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'enabled')) {
    patch.enabled = Boolean(body.enabled);
  }
  return patch;
}

router.use(requireAdmin);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.AUTH_USER_IMPORT_MAX_MB || 2) * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname || '').toLowerCase() !== '.csv') {
      return cb(new Error('Solo se permiten archivos .csv.'));
    }
    return cb(null, true);
  },
});

function receiveCsv(req, res, next) {
  csvUpload.single('archivo')(req, res, (err) => {
    if (!err && !req.file) {
      return res.status(400).json({ message: 'Seleccione un archivo CSV.', code: 'ADMIN_USER_CSV_REQUIRED' });
    }
    if (!err) return next();
    return res.status(400).json({
      message: err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo CSV supera el tamaño permitido.'
        : String(err.message || 'No fue posible recibir el CSV.'),
      code: err.code || 'ADMIN_USER_CSV_UPLOAD_FAILED',
    });
  });
}

router.get('/', (_req, res) => {
  res.json({ users: listUsers() });
});

router.post('/import/preview', receiveCsv, (req, res) => {
  try {
    const analysis = analyzeUserCsv(req.file.buffer, listUsers());
    return res.json({ preview: { entries: analysis.entries, summary: analysis.summary } });
  } catch (err) {
    return res.status(Number(err?.status) || 500).json({
      message: String(err?.message || 'No fue posible analizar el CSV.'),
      code: err?.code || 'ADMIN_USER_CSV_PREVIEW_FAILED',
    });
  }
});

router.post('/import', receiveCsv, (req, res) => {
  try {
    const analysis = analyzeUserCsv(req.file.buffer, listUsers());
    const result = importManagedUsers(analysis.emails);
    return res.status(201).json({
      imported: result.imported.length,
      skipped: analysis.summary.existing + analysis.summary.duplicates + analysis.summary.invalid + result.skipped.length,
      summary: analysis.summary,
    });
  } catch (err) {
    return res.status(Number(err?.status) || 500).json({
      message: String(err?.message || 'No fue posible importar los usuarios.'),
      code: err?.code || 'ADMIN_USER_CSV_IMPORT_FAILED',
    });
  }
});

router.post('/', (req, res) => {
  try {
    const user = upsertManagedUser(cleanUserPayload(req.body));
    return res.status(201).json({ user });
  } catch (err) {
    return res.status(Number(err?.status) || 500).json({
      message: String(err?.message || 'No fue posible guardar el usuario.'),
      code: err?.code || 'ADMIN_USER_SAVE_FAILED',
    });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const user = updateManagedUser(req.params.id, cleanPatchPayload(req.body));
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    return res.json({ user });
  } catch (err) {
    return res.status(Number(err?.status) || 500).json({
      message: String(err?.message || 'No fue posible actualizar el usuario.'),
      code: err?.code || 'ADMIN_USER_UPDATE_FAILED',
    });
  }
});

router.delete('/:id', (req, res) => {
  const deleted = deleteManagedUser(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Usuario no encontrado.' });
  return res.json({ ok: true });
});

module.exports = router;
