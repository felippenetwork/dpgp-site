const db     = require('../_lib/db');
const uazapi = require('../_lib/uazapi');

const COOLDOWN_MS  = 60 * 60 * 1000; // 1h por contato
const MAX_DELAY_MS = 50000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Extrai os campos relevantes do payload de mensagem da uazapi.
// Estrutura confirmada: { key: {remoteJid, fromMe}, message: {conversation|...}, pushName }
// Também tenta formatos alternativos (arrays, camelCase/PascalCase).
function extractIncomingMessage(data) {
  if (!data) return null;

  // Formato principal: data é o objeto da mensagem diretamente
  // { key: { remoteJid, fromMe }, message: { conversation } }
  let msg = data;

  // Formato alternativo: data.messages = [{...}] ou data.message = {...}
  if (Array.isArray(data.messages) && data.messages.length) msg = data.messages[0];
  else if (data.message && typeof data.message === 'object' && data.message.key) msg = data.message;

  // Extrai JID — tenta múltiplos paths conhecidos
  const jid =
    msg?.key?.remoteJid    ||
    msg?.key?.RemoteJid    ||
    msg?.remoteJid         ||
    msg?.chatid            ||
    msg?.chatId            ||
    msg?.from              ||
    null;

  if (!jid) return null;

  const fromMe = !!(
    msg?.key?.fromMe    ??
    msg?.key?.FromMe    ??
    msg?.fromMe         ??
    false
  );

  const isGroup = jid.endsWith('@g.us') || jid === 'status@broadcast';

  const text =
    msg?.message?.conversation                        ||
    msg?.message?.extendedTextMessage?.text           ||
    msg?.message?.imageMessage?.caption               ||
    msg?.text || msg?.body || msg?.conversation       ||
    '';

  return { jid, fromMe, isGroup, text };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  // Responde 200 IMEDIATAMENTE — a uazapi tem timeout curto para entrega do webhook.
  // O sleep + envio da mensagem acontece depois, enquanto a function ainda está viva.
  res.status(200).json({ ok: true });

  try {
    const body = req.body || {};
    const event = body.event || '';

    // Aceita 'messages', 'messages_upsert', 'message' etc.
    if (!event.startsWith('message')) return;

    const incoming = extractIncomingMessage(body.data);
    if (!incoming || incoming.fromMe || incoming.isGroup) return;

    const cfg = await db.getConfig();
    if (!cfg.ausenciaAtivo || !cfg.uazapiInstanceToken) return;

    const msgs = Array.isArray(cfg.ausenciaMensagens) && cfg.ausenciaMensagens.length
      ? cfg.ausenciaMensagens
      : (cfg.ausenciaMensagem ? [cfg.ausenciaMensagem] : []);
    if (!msgs.length) return;

    const cooldown = cfg.ausenciaCooldown || {};
    const ultimo = cooldown[incoming.jid] ? new Date(cooldown[incoming.jid]).getTime() : 0;
    if (Date.now() - ultimo < COOLDOWN_MS) return;

    const texto   = msgs[Math.floor(Math.random() * msgs.length)].trim();
    const delayMs = Math.min((cfg.ausenciaDelay || 25) * 1000, MAX_DELAY_MS);

    await sleep(delayMs);
    await uazapi.sendText(cfg.uazapiInstanceToken, incoming.jid, texto);

    const novoCooldown = { ...cooldown, [incoming.jid]: new Date().toISOString() };
    for (const jid of Object.keys(novoCooldown)) {
      if (Date.now() - new Date(novoCooldown[jid]).getTime() > COOLDOWN_MS) delete novoCooldown[jid];
    }
    await db.saveConfig({ ...cfg, ausenciaCooldown: novoCooldown });

  } catch { /* silencioso — não afeta resposta já enviada */ }
};
