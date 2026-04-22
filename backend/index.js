require('dotenv').config();
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');

const formatosRoutes = require('./routes/formatos');
const pplRoutes = require('./routes/ppl');
const defensoresRoutes = require('./routes/defensores');
const healthRoutes = require('./routes/health');
const consolidado = require('./db/oracleConsolidado.repo');
const { closePool } = require('./db/oraclePool');

const app = express();
const PORT = process.env.PORT || 7860;
const frontendDistPath = path.join(__dirname, 'public', 'app');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

app.use(cors());
app.use(express.json());
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Salud
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Backend AURORA operativo (modo ORACLE v2 híbrido)' });
});
app.use('/api/health', healthRoutes);

// Rutas principales
app.use('/api/formatos', formatosRoutes);
app.use('/api/ppl', pplRoutes);
app.use('/api/defensores', defensoresRoutes);

// Sirve carpeta de formatos como estatica para enlaces directos.
app.use('/downloads', express.static(path.join(__dirname, 'public', 'formatos')));

if (hasFrontendBuild) {
  // Sirve el build del frontend ya compilado.
  app.use(express.static(frontendDistPath));

  // Fallback SPA para rutas del frontend (excluye API y descargas).
  app.get(/^\/(?!api(?:\/|$)|downloads(?:\/|$)).*/, (req, res) => {
    res.sendFile(frontendIndexPath);
  });
}

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint API no encontrado' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor AURORA escuchando en http://0.0.0.0:${PORT}`);
  setImmediate(async () => {
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
