const express = require('express');
const reporteAtencionesService = require('../services/reporteAtencionesService');

const router = express.Router();

router.get('/atenciones-defensores/opciones', async (_req, res, next) => {
  try {
    return res.json(await reporteAtencionesService.getReportOptions());
  } catch (error) {
    return next(error);
  }
});

router.get('/atenciones-defensores', async (req, res, next) => {
  try {
    const report = await reporteAtencionesService.generateReport({
      fechaInicio: req.query.fechaInicio,
      fechaFin: req.query.fechaFin,
      regional: req.query.regional,
      defensorId: req.query.defensorId,
    });
    return res.json(report);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
