const db     = require('../_lib/db');
const uazapi = require('../_lib/uazapi');

function normalizeQr(qr) {
  if (!qr) return null;
  return qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const cfg = await db.getConfig();
    if (!cfg.uazapiInstanceToken) {
      return res.json({ success: true, connected: false, qr: null, phone: null });
    }

    const result = await uazapi.getInstanceStatus(cfg.uazapiInstanceToken);
    const instance = result.instance || {};

    res.json({
      success:   true,
      connected: !!result.status?.connected,
      phone:     instance.owner || null,
      qr:        normalizeQr(instance.qrcode),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
