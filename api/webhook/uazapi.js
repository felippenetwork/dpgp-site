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
  const isGroup = jid.endsWith('@g.us') || jid === 'status@broadcast';

  return { jid, fromMe, isGroup };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  let logMsg = 'start';
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    const event   = (body.event || body.Event || body.eventType || body.EventType || '').toLowerCase();
    const rawData = body.data || body.Data;
    const allKeys = Object.keys(body);
    console.log('[WH-KEYS]', allKeys.slice(0,5).join('|'), '...', allKeys.slice(5).join('|'));
    logMsg = 'event='+event+' dataKeys='+(rawData ? Object.keys(rawData).join(',') : 'null');

    if (!event.startsWith('message')) { console.log('[WH] SKIP '+logMsg); return res.status(200).json({ ok: true }); }

    const incoming = extractIncomingMessage(rawData);
    logMsg += ' jid='+(incoming?.jid||'null')+' fromMe='+incoming?.fromMe+' isGroup='+incoming?.isGroup;

    if (!incoming || incoming.fromMe || incoming.isGroup) { console.log('[WH] SKIP '+logMsg); return res.status(200).json({ ok: true }); }

    const cfg = await db.getConfig();
    logMsg += ' ativo='+cfg.ausenciaAtivo+' msgs='+cfg.ausenciaMensagens?.length+' token='+!!cfg.uazapiInstanceToken;

    if (!cfg.ausenciaAtivo || !cfg.uazapiInstanceToken) { console.log('[WH] SKIP '+logMsg); return res.status(200).json({ ok: true }); }

    const msgs = Array.isArray(cfg.ausenciaMensagens) && cfg.ausenciaMensagens.length
      ? cfg.ausenciaMensagens : (cfg.ausenciaMensagem ? [cfg.ausenciaMensagem] : []);
    if (!msgs.length) { console.log('[WH] SKIP no-msgs '+logMsg); return res.status(200).json({ ok: true }); }

    const cooldown = cfg.ausenciaCooldown || {};
    const ultimo   = cooldown[incoming.jid] ? new Date(cooldown[incoming.jid]).getTime() : 0;
    const emCooldown = Date.now() - ultimo < COOLDOWN_MS;
    logMsg += ' cooldown='+emCooldown;

    if (emCooldown) { console.log('[WH] SKIP '+logMsg); return res.status(200).json({ ok: true }); }

    const texto   = msgs[Math.floor(Math.random() * msgs.length)].trim();
    const delayMs = (cfg.ausenciaDelay || 25) * 1000;

    await uazapi.sendText(cfg.uazapiInstanceToken, incoming.jid, texto, { delay: delayMs });

    const novoCooldown = { ...cooldown, [incoming.jid]: new Date().toISOString() };
    for (const jid of Object.keys(novoCooldown)) {
      if (Date.now() - new Date(novoCooldown[jid]).getTime() > COOLDOWN_MS) delete novoCooldown[jid];
    }
    await db.saveConfig({ ...cfg, ausenciaCooldown: novoCooldown });

    console.log('[WH] SENT '+logMsg);
    res.status(200).json({ ok: true });

  } catch (err) {
    console.log('[WH] ERR '+logMsg+' err='+err.message);
    res.status(200).json({ ok: true });
  }
};
