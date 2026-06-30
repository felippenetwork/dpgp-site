const db     = require('../_lib/db');
const uazapi = require('../_lib/uazapi');

const COOLDOWN_MS = 60 * 60 * 1000;

function normalize(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = k[0].toLowerCase() + k.slice(1);
    out[key] = (v && typeof v === 'object' && !Array.isArray(v)) ? normalize(v) : v;
  }
  return out;
}

// Payload real da uazapi: body.message contém chatid, fromMe, isGroup, content
function extractIncomingMessage(rawData) {
  if (!rawData) return null;
  const data = normalize(rawData);

  let msg = data;
  if (Array.isArray(data.messages) && data.messages.length) msg = normalize(data.messages[0]);
  else if (data.message && typeof data.message === 'object' && data.message.key) msg = data.message;

  const jid =
    msg?.key?.remoteJid ||
    msg?.remoteJid      ||
    msg?.chatid         ||
    msg?.chatId         ||
    msg?.from           ||
    null;

  if (!jid) return null;

  const fromMe  = !!(msg?.key?.fromMe ?? msg?.fromMe ?? false);
  const isGroup = !!(msg?.key?.isGroup ?? msg?.isGroup ?? jid.endsWith('@g.us') ?? false);

  return { jid, fromMe, isGroup };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    const event   = (body.event || body.Event || body.eventType || body.EventType || '').toLowerCase();
    // body.message = mensagem real | body.chat = metadado CRM (não usar para extração)
    const rawData = body.data || body.Data || body.message || body.Message;

    if (!event.startsWith('message')) return res.status(200).json({ ok: true });

    const incoming = extractIncomingMessage(rawData);
    if (!incoming || incoming.fromMe || incoming.isGroup) return res.status(200).json({ ok: true });

    const cfg = await db.getConfig();
    if (!cfg.ausenciaAtivo || !cfg.uazapiInstanceToken) return res.status(200).json({ ok: true });

    const msgs = Array.isArray(cfg.ausenciaMensagens) && cfg.ausenciaMensagens.length
      ? cfg.ausenciaMensagens : (cfg.ausenciaMensagem ? [cfg.ausenciaMensagem] : []);
    if (!msgs.length) return res.status(200).json({ ok: true });

    const cooldown = cfg.ausenciaCooldown || {};
    const ultimo   = cooldown[incoming.jid] ? new Date(cooldown[incoming.jid]).getTime() : 0;
    if (Date.now() - ultimo < COOLDOWN_MS) return res.status(200).json({ ok: true });

    const texto   = msgs[Math.floor(Math.random() * msgs.length)].trim();
    const delayMs = (cfg.ausenciaDelay || 25) * 1000;

    // Grava cooldown ANTES de enviar — evita que mensagens em sequência
    // rápida passem pelo check antes da primeira resposta ser registrada.
    const novoCooldown = { ...cooldown, [incoming.jid]: new Date().toISOString() };
    for (const jid of Object.keys(novoCooldown)) {
      if (Date.now() - new Date(novoCooldown[jid]).getTime() > COOLDOWN_MS) delete novoCooldown[jid];
    }
    await db.saveConfig({ ...cfg, ausenciaCooldown: novoCooldown });

    await uazapi.sendText(cfg.uazapiInstanceToken, incoming.jid, texto, { delay: delayMs });
    res.status(200).json({ ok: true });

  } catch {
    res.status(200).json({ ok: true });
  }
};
