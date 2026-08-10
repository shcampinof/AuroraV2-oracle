const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');
const { normalizeRoles } = require('../services/authService');

const {
  createCarga,
  getCarga,
  listCargas,
  listSources,
  readLog,
  retryCarga,
} = require('../services/cargaBdService');
const {
  cleanupDefensor,
  executeCleanup,
  previewCleanup,
} = require('../services/actuacionCleanupService');

const router = express.Router();

function parseList(value, fallback) {
  const parsed = String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
}

function hasAdminAccess(user) {
  const allowedRoles = parseList(process.env.CARGUEBD_ADMIN_ROLES, ['admin', 'carguebd', 'cargas_bd']);
  const roles = normalizeRoles(user?.roles, []);
  if (roles.some((role) => allowedRoles.includes(role))) return true;
  return user?.provider === 'local' && roles.includes('admin');
}

function requireCargaAdmin(req, res, next) {
  if (hasAdminAccess(req.user)) return next();
  return res.status(403).json({
    message: 'No tiene permisos para administrar cargas de base de datos.',
    code: 'CARGUEBD_FORBIDDEN',
  });
}

function tempUploadDir() {
  const configured = process.env.AURORA_CARGAS_TMP_DIR;
  const dir = configured
    ? path.resolve(configured)
    : path.join(os.tmpdir(), 'aurora-cargas-bd');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const upload = multer({
  dest: tempUploadDir(),
  limits: {
    fileSize: Number(process.env.CARGUEBD_MAX_FILE_MB || 120) * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext !== '.xlsx') {
      return cb(new Error('Solo se permiten archivos .xlsx.'));
    }
    return cb(null, true);
  },
});

function uploadArchivo(req, res, next) {
  upload.single('archivo')(req, res, (err) => {
    if (!err) return next();
    const status = err instanceof multer.MulterError ? 400 : 400;
    return res.status(status).json({
      message: String(err.message || 'No fue posible recibir el archivo.'),
      code: err.code || 'CARGUEBD_UPLOAD_FAILED',
    });
  });
}

function removeTempFile(file) {
  if (!file?.path) return;
  fs.unlink(file.path, () => {});
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    provider: user.provider,
  };
}

router.use(requireCargaAdmin);

router.get('/fuentes', (_req, res) => {
  res.json({ fuentes: listSources() });
});

router.get('/', (_req, res) => {
  res.json({ cargas: listCargas() });
});

router.get('/actuaciones/preview', async (req, res, next) => {
  try {
    const defensor = req.query?.defensor || cleanupDefensor();
    const preview = await previewCleanup(defensor);
    return res.json({ preview });
  } catch (err) {
    return next(err);
  }
});

router.delete('/actuaciones', async (req, res, next) => {
  try {
    const result = await executeCleanup({
      defensor: req.body?.defensor,
      expectedCount: req.body?.expectedCount,
      expectedAssignments: req.body?.expectedAssignments,
      confirmation: req.body?.confirmation,
      user: req.user,
    });
    return res.json({
      message: `${result.deleted} actuaciones y ${result.assignmentsDeleted} asignaciones eliminadas. Las personas y situaciones no se modificaron.`,
      result,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', (req, res) => {
  const carga = getCarga(req.params.id);
  if (!carga) return res.status(404).json({ message: 'Carga no encontrada.' });
  return res.json({ carga });
});

router.get('/:id/log', (req, res) => {
  const log = readLog(req.params.id);
  if (log == null) return res.status(404).json({ message: 'Carga no encontrada.' });
  res.type('text/plain; charset=utf-8').send(log);
});

router.post('/', uploadArchivo, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Debe adjuntar un archivo .xlsx en el campo archivo.' });
    }

    const carga = createCarga({
      sourceId: req.body?.fuente,
      tempPath: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      uploadedBy: publicUser(req.user),
    });

    return res.status(202).json({
      message: 'Carga recibida. El proceso se ejecuta en segundo plano.',
      carga,
    });
  } catch (err) {
    removeTempFile(req.file);
    const status = Number(err?.status) || 500;
    return res.status(status).json({
      message: String(err?.message || 'No fue posible crear la carga.'),
      code: err?.code || 'CARGUEBD_CREATE_FAILED',
    });
  }
});

router.post('/:id/retry', (req, res) => {
  const carga = retryCarga(req.params.id);
  if (!carga) return res.status(404).json({ message: 'Carga no encontrada.' });
  return res.status(202).json({ message: 'Reintento iniciado.', carga });
});

module.exports = router;
