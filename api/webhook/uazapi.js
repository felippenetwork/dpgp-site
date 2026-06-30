const db     = require('../_lib/db');
const uazapi = require('../_lib/uazapi');

const COOLDOWN_MS  = 60 * 60 * 1000; // 1h por contato
const MAX_DELAY_MS = 50000;          // headroom de segurança sob o maxDuration da function

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// O payload de "messages" da uazapi não tem schema fixo documentado —
// extração defensiva, tentando os formatos mais comuns (similar ao
// ERP-RIFAS, que normaliza camelCase/PascalCase).
function extractIncomingMessage(data) {
  if (!data) return null;
  const msg = data.message || (Array.isArray(data.messages) ? data.messages[0] : data);
  if (!msg) return null;

  const jid = msg.chatid || msg.chatId || msg.remoteJid || msg.key?.remoteJid || msg.from || null;
  if (!jid) return null;

  const fromMe = !!(msg.fromMe ?? msg.fromme ?? msg.key?.fromMe);
  const isGroup = jid.endsWith('@g.us') || jid === 'status@broadcast';

  const text =
    msg.text || msg.body || msg.conversation ||
    msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

  return { jid, fromMe, isGroup, text };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  // Sempre responde 200 rápido para a uazapi não reenviar o evento por timeout —
  // erros são engolidos deliberadamente (best-effort, não é fluxo crítico).
  try {
    const { event, data } = req.body || {};
    if (event !== 'messages') return res.status(200).json({ ok: true });

    const incoming = extractIncomingMessage(data);
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
    const delayMs  = Math.min((cfg.ausenciaDelay || 25) * 1000, MAX_DELAY_MS);
    await sleep(delayMs);

    await uazapi.sendText(cfg.uazapiInstanceToken, incoming.jid, texto);

    const novoCooldown = { ...cooldown, [incoming.jid]: new Date().toISOString() };
    // Limpa entradas com mais de 1h para o blob não crescer indefinidamente
    for (const jid of Object.keys(novoCooldown)) {
      if (Date.now() - new Date(novoCooldown[jid]).getTime() > COOLDOWN_MS) delete novoCooldown[jid];
    }
    await db.saveConfig({ ...cfg, ausenciaCooldown: novoCooldown });

    res.status(200).json({ ok: true });
  } catch {
    res.status(200).json({ ok: true });
  }
};
