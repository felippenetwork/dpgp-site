const db     = require('../_lib/db');
const uazapi = require('../_lib/uazapi');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const cfg = await db.getConfig();
    if (!cfg.uazapiInstanceToken) {
      return res.status(503).json({ success: false, error: 'WhatsApp não conectado' });
    }

    let groups;
    try {
      ({ groups } = await uazapi.listGroups(cfg.uazapiInstanceToken));
    } catch (err) {
      if (!uazapi.isStaleTokenError(err)) throw err;
      await db.saveConfig({ ...cfg, uazapiInstanceId: null, uazapiInstanceToken: null });
      return res.status(503).json({ success: false, error: 'WhatsApp não conectado' });
    }
    const list = (groups || [])
      .map(g => ({ jid: g.JID, name: g.Name || g.JID, participants: g.Participants?.length || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    res.json({ success: true, groups: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
