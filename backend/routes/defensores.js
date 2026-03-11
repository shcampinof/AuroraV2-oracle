const express = require('express');
const defensores = require('../db/defensores.repo');
const consolidado = require('../db/oracleConsolidado.repo');

const router = express.Router();

// GET /api/defensores
// ?source=condenados -> lista unica desde la fuente principal de PPL (consolidado_ppl.csv)
router.get('/', async (req, res) => {
  const source = String(req.query.source || '').trim().toLowerCase();
  try {
    if (source === 'condenados') {
      const defensoresCondenados = await consolidado.getDefensoresDistinct({ tipo: 'condenado' });
      return res.json({
        defensores: defensoresCondenados,
        opciones: defensores.toOptions(defensoresCondenados),
      });
    }
    return res.json({
      defensores: defensores.getAll(),
      opciones: defensores.getAllOptions(),
    });
  } catch (err) {
    console.error('[defensores:list] Error Oracle:', err?.message || err);
    return res.status(500).json({ error: 'Error consultando defensores.', code: 'DEFENSOR_LIST_ERROR' });
  }
});

// POST /api/defensores
// body: { nombre: string }
router.post('/', async (req, res) => {
  try {
    const nombre = defensores.normalizeNombre(req.body?.nombre);
    defensores.assertNombreValido(nombre);

    const existsInCondenados = (await consolidado.getDefensoresDistinct({ tipo: 'condenado' }))
      .some((value) => defensores.normalizeNombre(value) === nombre);

    if (existsInCondenados) {
      return res.status(409).json({
        error: 'El defensor ya existe.',
        code: 'DUPLICATE_DEFENSOR',
      });
    }

    const created = defensores.create(nombre);
    return res.status(201).json({
      defensor: created,
      opcion: defensores.toOptions([created])[0],
    });
  } catch (err) {
    const status = Number(err?.status) || 500;
    const code = err?.code || 'DEFENSOR_CREATE_ERROR';
    const error =
      status >= 500 ? 'Error guardando defensor.' : String(err?.message || 'Error guardando defensor.');
    return res.status(status).json({ error, code });
  }
});

module.exports = router;
