const db     = require('../_lib/db');
const uazapi = require('../_lib/uazapi');

function normalizeQr(qr) {
  if (!qr) return null;
  return qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const cfg = await db.getConfig();
    let { uazapiInstanceId, uazapiInstanceToken } = cfg;

    async function criarNovaInstancia() {
      const created = await uazapi.createInstance(`dpgp-${Date.now()}`);
      uazapiInstanceId    = created.instance?.id || created.instance?.token || null;
      uazapiInstanceToken = created.token;
      await db.saveConfig({ ...await db.getConfig(), uazapiInstanceId, uazapiInstanceToken });

      const host = req.headers['x-forwarded-host'] || req.headers.host;
      uazapi.setWebhook(uazapiInstanceToken, `https://${host}/api/webhook/uazapi`, ['messages', 'connection'])
        .catch(() => {});
    }

    if (!uazapiInstanceToken) await criarNovaInstancia();

    let result;
    try {
      result = await uazapi.connectInstance(uazapiInstanceToken);
    } catch (err) {
      // Token salvo está morto (instância expirou/foi apagada na uazapi) — recria.
      if (!uazapi.isStaleTokenError(err)) throw err;
      await criarNovaInstancia();
      result = await uazapi.connectInstance(uazapiInstanceToken);
    }

    const instance = result.instance || {};

    res.json({
      success:   true,
      connected: !!result.connected,
      phone:     instance.owner || null,
      qr:        normalizeQr(instance.qrcode),
      paircode:  instance.paircode || null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
