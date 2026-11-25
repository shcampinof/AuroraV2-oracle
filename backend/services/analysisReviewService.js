const repository = require('../repositories/oracle/analysisReviewRepository');
const pplService = require('./pplService');

let scheduler = null;
let running = null;

const { bogotaDate } = require('../utils/analysisReviewDate');

async function schedulerTick(now = new Date()) {
  if (running) return running;
  running = (async () => {
    const created = await repository.createDueReviews(bogotaDate(now));
    if (created > 0) {
      pplService.invalidateDataCache();
      console.log(`[revision-analisis] Se crearon ${created} actuaciones de revisión.`);
    }
    return created;
  })();
  try { return await running; } finally { running = null; }
}

function startAnalysisReviewScheduler() {
  if (scheduler) return;
  const tick = () => schedulerTick().catch(error => {
    console.error('[revision-analisis] No fue posible crear las revisiones; se reintentará:', error?.message || error);
  });
  tick();
  scheduler = setInterval(tick, 60_000);
  scheduler.unref?.();
}

async function stopAnalysisReviewScheduler() {
  if (scheduler) clearInterval(scheduler);
  scheduler = null;
  if (running) await running.catch(() => {});
}

module.exports = { bogotaDate, schedulerTick, startAnalysisReviewScheduler, stopAnalysisReviewScheduler };
