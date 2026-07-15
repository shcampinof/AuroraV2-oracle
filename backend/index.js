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
const consolidado = require('./db/oracleConsolidado.repo');
const { closePool } = require('./db/oraclePool');
const { repairRegistryOnStartup, shutdownCargaJobs } = require('./services/cargaBdService');

const app = express();
const PORT = process.env.PORT || 7860;
const enableStartupWarmup = String(process.env.ENABLE_STARTUP_WARMUP || '').trim().toLowerCase() === 'true';
const frontendDistPath = path.join(__dirname, 'public', 'app');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

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
  res.json({ ok: true, message: 'Backend AURORA operativo (modo ORACLE v2 híbrido)' });
});
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

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
    message: String(err?.message || 'Error interno del backend.'),
    code: err?.code || 'API_ERROR',
  });
});

if (hasFrontendBuild) {
  // Sirve el build del frontend ya compilado.
  app.use(
    express.static(frontendDistPath, {
      setHeaders: (res, filePath) => {
        const fileName = path.basename(filePath);
        if (fileName === 'service-worker.js' || fileName === 'manifest.json') {
          res.setHeader('Cache-Control', 'no-cache');
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

    const startedAt = Date.now();
    try {
      const total = (await consolidado.getAll()).length;
      const elapsed = Date.now() - startedAt;
      console.log(`[warmup] Oracle cargado: ${total} registros (${elapsed} ms)`);
    } catch (err) {
      console.error('[warmup] No fue posible consultar Oracle:', err?.message || err);
    }

    try {
      const warmupCondenadosStartedAt = Date.now();
      if (typeof pplRoutes.warmupCondenadosIndex === 'function') {
        await pplRoutes.warmupCondenadosIndex();
      }
      const warmupCondenadosElapsed = Date.now() - warmupCondenadosStartedAt;
      console.log(`[warmup] Indice de usuarios asignados precalculado (${warmupCondenadosElapsed} ms)`);
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
