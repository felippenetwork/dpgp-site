const db     = require('../_lib/db');
const uazapi = require('../_lib/uazapi');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const cfg = await db.getConfig();
    if (!cfg.uazapiInstanceToken) return res.json({ success: true, message: 'Já desconectado.' });

    try {
      await uazapi.disconnectInstance(cfg.uazapiInstanceToken);
    } catch (err) {
      if (!uazapi.isStaleTokenError(err)) throw err;
      await db.saveConfig({ ...cfg, uazapiInstanceId: null, uazapiInstanceToken: null });
    }
    res.json({ success: true, message: 'Desconectado com sucesso.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
