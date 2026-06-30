const db     = require('../_lib/db');
const uazapi = require('../_lib/uazapi');

const COOLDOWN_MS = 60 * 60 * 1000;

function extractIncomingMessage(data) {
  if (!data) return null;

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
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    // LOG TEMPORÁRIO — remover após diagnosticar
    console.log('[WEBHOOK] body completo:', JSON.stringify(body).slice(0, 800));

    const event = body.event || '';
    console.log('[WEBHOOK] event:', event);

    if (!event.startsWith('message')) {
      console.log('[WEBHOOK] ignorado — event não começa com message');
      return res.status(200).json({ ok: true });
    }

    const incoming = extractIncomingMessage(body.data);
    console.log('[WEBHOOK] incoming:', JSON.stringify(incoming));

    if (!incoming || incoming.fromMe || incoming.isGroup) {
      console.log('[WEBHOOK] ignorado — fromMe/isGroup/null');
      return res.status(200).json({ ok: true });
    }

    const cfg = await db.getConfig();
    console.log('[WEBHOOK] ausenciaAtivo:', cfg.ausenciaAtivo, '| msgs:', cfg.ausenciaMensagens?.length, '| token:', !!cfg.uazapiInstanceToken);

    if (!cfg.ausenciaAtivo || !cfg.uazapiInstanceToken) return res.status(200).json({ ok: true });

    const msgs = Array.isArray(cfg.ausenciaMensagens) && cfg.ausenciaMensagens.length
      ? cfg.ausenciaMensagens
      : (cfg.ausenciaMensagem ? [cfg.ausenciaMensagem] : []);
    if (!msgs.length) return res.status(200).json({ ok: true });

    const cooldown = cfg.ausenciaCooldown || {};
    const ultimo = cooldown[incoming.jid] ? new Date(cooldown[incoming.jid]).getTime() : 0;
    const emCooldown = Date.now() - ultimo < COOLDOWN_MS;
    console.log('[WEBHOOK] cooldown:', emCooldown);
    if (emCooldown) return res.status(200).json({ ok: true });

    const texto   = msgs[Math.floor(Math.random() * msgs.length)].trim();
    const delayMs = (cfg.ausenciaDelay || 25) * 1000;
    console.log('[WEBHOOK] enviando para:', incoming.jid, '| texto:', texto.slice(0, 50));

    await uazapi.sendText(cfg.uazapiInstanceToken, incoming.jid, texto, { delay: delayMs });
    console.log('[WEBHOOK] enviado com sucesso');

    const novoCooldown = { ...cooldown, [incoming.jid]: new Date().toISOString() };
    for (const jid of Object.keys(novoCooldown)) {
      if (Date.now() - new Date(novoCooldown[jid]).getTime() > COOLDOWN_MS) delete novoCooldown[jid];
    }
    await db.saveConfig({ ...cfg, ausenciaCooldown: novoCooldown });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.log('[WEBHOOK] erro:', err.message);
    res.status(200).json({ ok: true });
  }
};
