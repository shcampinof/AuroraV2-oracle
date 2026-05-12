const express = require('express');
const defensoresRepo = require('../repositories/oracle/defensoresRepository');
const consolidado = require('../db/oracleConsolidado.repo');

const router = express.Router();

// GET /api/defensores
// ?source=condenados -> lista unica desde asignaciones/gestiones Oracle de PPL condenadas.
router.get('/', async (req, res) => {
  const source = String(req.query.source || '').trim().toLowerCase();
  try {
    if (source === 'condenados') {
      const defensoresCondenados = await consolidado.getDefensoresDistinct({ tipo: 'condenado' });
      return res.json({
        defensores: defensoresCondenados,
        opciones: defensoresRepo.toOptions(defensoresCondenados),
      });
    }
    const defensores = await defensoresRepo.listAll();
    return res.json({
      defensores: defensores.map((item) => item.nombre).filter(Boolean),
      opciones: defensoresRepo.toOptions(defensores),
    });
  } catch (err) {
    console.error('[defensores:list] Error Oracle:', err?.message || err);
    return res.status(500).json({ error: 'Error consultando defensores.', code: 'DEFENSOR_LIST_ERROR' });
  }
});

// POST /api/defensores
// body: { cedula: string, nombre: string, correo?: string, regional?: string, cedulaPag?: string }
router.post('/', async (req, res) => {
  try {
    const nombre = defensoresRepo.normalizeNombre(req.body?.nombre);
    defensoresRepo.assertNombreValido(nombre);
    const cedula = defensoresRepo.normalizeCedula(req.body?.cedula);

    const existsInCondenados = (await consolidado.getDefensoresDistinct({ tipo: 'condenado' }))
      .some((value) => defensoresRepo.normalizeNombre(value) === nombre);

    if (existsInCondenados) {
      return res.status(409).json({
        error: 'El defensor ya existe.',
        code: 'DUPLICATE_DEFENSOR',
      });
    }

    const created = await defensoresRepo.create({
      cedula,
      nombre,
      correo: req.body?.correo,
      regional: req.body?.regional,
      cedulaPag: req.body?.cedulaPag,
    });
    return res.status(201).json({
      defensor: created?.nombre || nombre,
      opcion: defensoresRepo.toOptions([created])[0],
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
