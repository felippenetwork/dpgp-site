const dispatchEngine = require('../_lib/dispatchEngine');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const result = await dispatchEngine.tick({ force: true });
    if (result.skipped) return res.status(400).json({ success: false, error: result.skipped });
    res.json({ success: true, message: 'Disparo executado com sucesso.', result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
