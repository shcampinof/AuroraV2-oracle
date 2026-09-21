const express = require('express');
const reporteAtencionesService = require('../services/reporteAtencionesService');
const reporteGeneralService = require('../services/reporteGeneralService');

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

router.get('/general', (_req, res) => {
  const snapshot = reporteGeneralService.getGeneralReportSnapshot();
  res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
  if (!snapshot) {
    return res.status(503).json({
      message: 'El reporte general se está preparando. Intente nuevamente en unos minutos.',
      code: 'GENERAL_REPORT_NOT_READY',
    });
  }
  return res.json(snapshot);
});

module.exports = router;
