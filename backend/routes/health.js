const express = require('express');
const { healthCheck } = require('../db/oraclePool');

const router = express.Router();

router.get('/db', async (_req, res) => {
  try {
    const check = await healthCheck();
    return res.json({ ok: true, db: check?.row || null });
  } catch (err) {
    console.error('[health:db] Error Oracle:', err?.message || err);
    return res.status(503).json({ ok: false, message: 'Oracle no disponible.', code: err?.code || 'ORACLE_UNAVAILABLE' });
  }
});

module.exports = router;