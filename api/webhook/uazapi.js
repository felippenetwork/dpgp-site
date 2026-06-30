const db     = require('../_lib/db');
const uazapi = require('../_lib/uazapi');

const COOLDOWN_MS = 60 * 60 * 1000; // 1h por contato

// Extrai os campos relevantes do payload de mensagem da uazapi.
// Estrutura confirmada: { key:{remoteJid,fromMe}, message:{conversation|...} }
function extractIncomingMessage(data) {
  if (!data) return null;

  // Formato principal: data é o objeto da mensagem diretamente
  let msg = data;
  if (Array.isArray(data.messages) && data.messages.length) msg = data.messages[0];
  else if (data.message && typeof data.message === 'object' && data.message.key) msg = data.message;

  const jid =
    msg?.key?.remoteJid ||
    msg?.key?.RemoteJid ||
    msg?.remoteJid      ||
    msg?.chatid         ||
    msg?.chatId         ||
    msg?.from           ||
    null;

  if (!jid) return null;

  const fromMe = !!(msg?.key?.fromMe ?? msg?.key?.FromMe ?? msg?.fromMe ?? false);
  const isGroup = jid.endsWith('@g.us') || jid === 'status@broadcast';

  return { jid, fromMe, isGroup };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Garante parsing mesmo se Content-Type não for application/json
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const event = body.event || '';
    if (!event.startsWith('message')) return res.status(200).json({ ok: true });

    const incoming = extractIncomingMessage(body.data);
    if (!incoming || incoming.fromMe || incoming.isGroup) return res.status(200).json({ ok: true });

    const cfg = await db.getConfig();
    if (!cfg.ausenciaAtivo || !cfg.uazapiInstanceToken) return res.status(200).json({ ok: true });

    const msgs = Array.isArray(cfg.ausenciaMensagens) && cfg.ausenciaMensagens.length
      ? cfg.ausenciaMensagens
      : (cfg.ausenciaMensagem ? [cfg.ausenciaMensagem] : []);
    if (!msgs.length) return res.status(200).json({ ok: true });

    const cooldown = cfg.ausenciaCooldown || {};
    const ultimo = cooldown[incoming.jid] ? new Date(cooldown[incoming.jid]).getTime() : 0;
    if (Date.now() - ultimo < COOLDOWN_MS) return res.status(200).json({ ok: true });

    const texto    = msgs[Math.floor(Math.random() * msgs.length)].trim();
    const delayMs  = (cfg.ausenciaDelay || 25) * 1000;

    // Sem sleep na function — passa o delay para a uazapi que simula o
    // "digitando..." nativamente. Assim respondemos antes do timeout do webhook.
    await uazapi.sendText(cfg.uazapiInstanceToken, incoming.jid, texto, { delay: delayMs });

    const novoCooldown = { ...cooldown, [incoming.jid]: new Date().toISOString() };
    for (const jid of Object.keys(novoCooldown)) {
      if (Date.now() - new Date(novoCooldown[jid]).getTime() > COOLDOWN_MS) delete novoCooldown[jid];
    }
    await db.saveConfig({ ...cfg, ausenciaCooldown: novoCooldown });

    res.status(200).json({ ok: true });
  } catch {
    res.status(200).json({ ok: true });
  }
};
