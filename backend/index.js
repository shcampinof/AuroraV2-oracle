const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '.env') });
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const formatosRoutes = require('./routes/formatos');
const pplRoutes = require('./routes/ppl');
const defensoresRoutes = require('./routes/defensores');
const healthRoutes = require('./routes/health');
const { requireAuth } = require('./middleware/auth');
const consolidado = require('./db/oracleConsolidado.repo');
const { closePool } = require('./db/oraclePool');

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
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'https://login.microsoftonline.com'],
        imgSrc: ["'self'", 'data:', 'https://raw.githubusercontent.com'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor AURORA escuchando en http://0.0.0.0:${PORT}`);
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
    await closePool();
  } catch (err) {
    console.error('[shutdown] Error cerrando pool Oracle:', err?.message || err);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
