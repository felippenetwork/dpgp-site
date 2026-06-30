const dispatchEngine = require('../_lib/dispatchEngine');

// Alvo do cron externo (ex: cron-job.org), chamado a cada 1 minuto.
// Protegido por CRON_SECRET — Vercel Hobby não suporta cron nativo sub-diário.
module.exports = async (req, res) => {
  const secret = req.query?.secret || req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  try {
    const result = await dispatchEngine.tick({ force: false });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
