const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '.env') });
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const formatosRoutes = require('./routes/formatos');
const pplRoutes = require('./routes/ppl');
const defensoresRoutes = require('./routes/defensores');
const adminCargasRoutes = require('./routes/adminCargas');
const adminUsersRoutes = require('./routes/adminUsers');
const healthRoutes = require('./routes/health');
const { requireAuth } = require('./middleware/auth');
const { closePool } = require('./db/oraclePool');
const { repairRegistryOnStartup, shutdownCargaJobs } = require('./services/cargaBdService');

const app = express();
const PORT = process.env.PORT || 7860;
const enableStartupWarmup = String(process.env.ENABLE_STARTUP_WARMUP ?? 'true').trim().toLowerCase() !== 'false';
const frontendDistPath = path.join(__dirname, 'public', 'app');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexPath);
const configuredTutorialVideosPath = String(process.env.AURORA_VIDEOS_DIR || '').trim();
const tutorialVideosPath = configuredTutorialVideosPath
  ? path.resolve(configuredTutorialVideosPath)
  : path.join(__dirname, 'tutorial-videos');

const corsOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isProduction() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function normalizeOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

function requestOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}

function getHttpsOptions() {
  const keyPath = String(process.env.HTTPS_KEY_PATH || process.env.TLS_KEY_PATH || process.env.SSL_KEY_PATH || '').trim();
  const certPath = String(process.env.HTTPS_CERT_PATH || process.env.TLS_CERT_PATH || process.env.SSL_CERT_PATH || '').trim();
  if (!keyPath && !certPath) return null;
  if (!keyPath || !certPath) {
    throw new Error('Para habilitar HTTPS configure HTTPS_KEY_PATH y HTTPS_CERT_PATH.');
  }
  const resolveFromBackend = (filePath) => (path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath));
  const resolvedKeyPath = resolveFromBackend(keyPath);
  const resolvedCertPath = resolveFromBackend(certPath);
  if (!fs.existsSync(resolvedKeyPath)) {
    throw new Error(`No existe el archivo configurado en HTTPS_KEY_PATH: ${resolvedKeyPath}`);
  }
  if (!fs.existsSync(resolvedCertPath)) {
    throw new Error(`No existe el archivo configurado en HTTPS_CERT_PATH: ${resolvedCertPath}`);
  }
  return {
    key: fs.readFileSync(resolvedKeyPath),
    cert: fs.readFileSync(resolvedCertPath),
  };
}

const httpsOptions = getHttpsOptions();
const isHttpsEnabled = Boolean(httpsOptions);

try {
  repairRegistryOnStartup();
} catch (err) {
  console.error('[cargas_bd] No fue posible validar/reparar el historial de cargas:', err?.message || err);
}

function corsOptionsDelegate(req, callback) {
  const origin = req.get('Origin');
  if (!origin) return callback(null, { origin: true });

  const normalizedOrigin = normalizeOrigin(origin);
  const sameOrigin = normalizedOrigin && normalizedOrigin === requestOrigin(req);
  const allowedByConfig = corsOrigins.includes(origin) || corsOrigins.includes(normalizedOrigin);
  const allowedInDevelopment = !isProduction() && !corsOrigins.length;

  if (sameOrigin || allowedByConfig || allowedInDevelopment) {
    return callback(null, { origin: true });
  }

  return callback(new Error('Origen CORS no autorizado.'));
}

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: false,
    strictTransportSecurity: isHttpsEnabled,
    referrerPolicy: { policy: 'no-referrer' },
  })
);
app.use(cors(corsOptionsDelegate));
app.use(express.json({ limit: '256kb' }));
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Salud
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Backend AURORA operativo.' });
});
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

// Videos locales del Manual Interactivo. Express atiende solicitudes Range,
// necesarias para adelantar el video sin descargar el archivo completo.
app.use(
  '/tutorial-videos',
  express.static(tutorialVideosPath, {
    acceptRanges: true,
    fallthrough: false,
    maxAge: '1d',
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

// Rutas principales
app.use('/api/formatos', requireAuth, formatosRoutes);
app.use('/api/ppl', requireAuth, pplRoutes);
app.use('/api/defensores', requireAuth, defensoresRoutes);
app.use('/api/admin/cargas', requireAuth, adminCargasRoutes);
app.use('/api/admin/users', requireAuth, adminUsersRoutes);

app.use('/api', (err, req, res, _next) => {
  console.error(`[api:error] ${req.method} ${req.originalUrl}:`, err?.message || err);
  if (res.headersSent) return;
  const status = Number(err?.status || err?.statusCode) || 500;
  res.status(status).json({
    message: status >= 500 ? 'Error interno del backend.' : String(err?.message || 'Solicitud no válida.'),
    code: status >= 500 ? 'API_ERROR' : err?.code || 'API_ERROR',
  });
});

if (hasFrontendBuild) {
  // Sirve el build del frontend ya compilado.
  app.use(
    express.static(frontendDistPath, {
      setHeaders: (res, filePath) => {
        const fileName = path.basename(filePath);
        if (fileName === 'index.html' || fileName === 'service-worker.js') {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (fileName === 'manifest.json') {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        }
      },
    })
  );

  // Fallback SPA para rutas del frontend (excluye API).
  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
    res.sendFile(frontendIndexPath);
  });
}

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint API no encontrado' });
});

const server = httpsOptions ? https.createServer(httpsOptions, app) : http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  const protocol = httpsOptions ? 'https' : 'http';
  console.log(`Servidor AURORA escuchando en ${protocol}://0.0.0.0:${PORT}`);
  setImmediate(async () => {
    if (!enableStartupWarmup) {
      console.log('[warmup] Deshabilitado. Define ENABLE_STARTUP_WARMUP=true para activarlo.');
      return;
    }

    try {
      const warmupCondenadosStartedAt = Date.now();
      if (typeof pplRoutes.warmupCondenadosIndex === 'function') {
        await pplRoutes.warmupCondenadosIndex();
      }
      const warmupCondenadosElapsed = Date.now() - warmupCondenadosStartedAt;
      console.log(`[warmup] Filtros de usuarios asignados precalculados (${warmupCondenadosElapsed} ms)`);
    } catch (err) {
      console.error('[warmup] No fue posible precargar cache de condenados:', err?.message || err);
    }
  });
});

async function shutdown(signal) {
  console.log(`[shutdown] Señal ${signal}. Cerrando pool Oracle...`);
  try {
    shutdownCargaJobs(signal);
    await closePool();
  } catch (err) {
    console.error('[shutdown] Error cerrando pool Oracle:', err?.message || err);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
