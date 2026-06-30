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

  const debug = { step: 'start', jid: null, fromMe: null, isGroup: null, err: null };
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    // Salva payload completo no Supabase para inspeção (síncrono)
    const cfgSnap = await db.getConfig();
    await db.saveConfig({ ...cfgSnap, _debugPayload: JSON.stringify(body).slice(0, 2000) });

    debug.keys  = Object.keys(body).join('|');
    debug.event = (body.event || body.Event || body.eventType || body.EventType || '').toLowerCase();
    // body.message = mensagem real | body.chat = metadado CRM do contato (não usar para extração)
    const rawData = body.data || body.Data || body.message || body.Message;

    if (!debug.event.startsWith('message')) { debug.step = 'skip_event'; res.status(200).json({ ok: true }); return; }

    const incoming = extractIncomingMessage(rawData);
    debug.jid     = incoming?.jid || 'null';
    debug.fromMe  = incoming?.fromMe;
    debug.isGroup = incoming?.isGroup;

    if (!incoming || incoming.fromMe || incoming.isGroup) { debug.step = 'skip_incoming'; res.status(200).json({ ok: true }); return; }

    const cfg = await db.getConfig();
    debug.ativo = cfg.ausenciaAtivo;

    if (!cfg.ausenciaAtivo || !cfg.uazapiInstanceToken) { debug.step = 'skip_config'; res.status(200).json({ ok: true }); return; }

    const msgs = Array.isArray(cfg.ausenciaMensagens) && cfg.ausenciaMensagens.length
      ? cfg.ausenciaMensagens : (cfg.ausenciaMensagem ? [cfg.ausenciaMensagem] : []);
    if (!msgs.length) { debug.step = 'skip_nomsgs'; res.status(200).json({ ok: true }); return; }

    const cooldown = cfg.ausenciaCooldown || {};
    const ultimo   = cooldown[incoming.jid] ? new Date(cooldown[incoming.jid]).getTime() : 0;
    debug.cooldown = Date.now() - ultimo < COOLDOWN_MS;
    if (debug.cooldown) { debug.step = 'skip_cooldown'; res.status(200).json({ ok: true }); return; }

    const texto   = msgs[Math.floor(Math.random() * msgs.length)].trim();
    const delayMs = (cfg.ausenciaDelay || 25) * 1000;
    debug.step    = 'sending';

    await uazapi.sendText(cfg.uazapiInstanceToken, incoming.jid, texto, { delay: delayMs });

    const novoCooldown = { ...cooldown, [incoming.jid]: new Date().toISOString() };
    for (const jid of Object.keys(novoCooldown)) {
      if (Date.now() - new Date(novoCooldown[jid]).getTime() > COOLDOWN_MS) delete novoCooldown[jid];
    }
    await db.saveConfig({ ...cfg, ausenciaCooldown: novoCooldown });
    debug.step = 'done';
    res.status(200).json({ ok: true });

  } catch (err) {
    debug.step = 'error';
    debug.err  = err.message;
    res.status(200).json({ ok: true });
  } finally {
    console.log('[WH]', JSON.stringify(debug));
  }
};
