/* ================================================
   Cliente uazapi — fetch puro, sem SDK/dependências
   ================================================ */

const UAZAPI_URL = (process.env.UAZAPI_URL || '').replace(/\/$/, '');

function assertConfigured() {
  if (!UAZAPI_URL) throw new Error('UAZAPI_URL não configurada no ambiente da Vercel.');
}

async function call(path, { method = 'GET', token, admin = false, body } = {}) {
  assertConfigured();
  const headers = { 'Content-Type': 'application/json' };
  if (admin) {
    if (!process.env.UAZAPI_ADMIN_TOKEN) throw new Error('UAZAPI_ADMIN_TOKEN não configurado.');
    headers.admintoken = process.env.UAZAPI_ADMIN_TOKEN;
  } else {
    if (!token) throw new Error('Token de instância não informado.');
    headers.token = token;
  }

  const res = await fetch(`${UAZAPI_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.error || data?.message || `uazapi ${method} ${path} → HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function createInstance(name) {
  return call('/instance/create', { method: 'POST', admin: true, body: { name } });
}

function connectInstance(token, phone) {
  return call('/instance/connect', { method: 'POST', token, body: phone ? { phone } : {} });
}

function getInstanceStatus(token) {
  return call('/instance/status', { method: 'GET', token });
}

function disconnectInstance(token) {
  return call('/instance/disconnect', { method: 'POST', token });
}

function deleteInstance(token) {
  return call('/instance', { method: 'DELETE', token });
}

function listGroups(token) {
  return call('/group/list', { method: 'GET', token });
}

function sendText(token, number, text, opts = {}) {
  return call('/send/text', { method: 'POST', token, body: { number, text, ...opts } });
}

function sendMedia(token, number, type, file, opts = {}) {
  return call('/send/media', { method: 'POST', token, body: { number, type, file, ...opts } });
}

function setWebhook(token, url, events) {
  return call('/webhook', { method: 'POST', token, body: { url, enabled: true, events } });
}

// A instância pode ter sido apagada/expirada do lado da uazapi (ex: instâncias
// não conectadas têm TTL) — nesse caso o token salvo no Supabase fica "morto"
// e toda chamada com ele falha com 401/"Invalid token.". Detecta esse caso
// para o caller poder recriar a instância em vez de só repassar o erro.
function isStaleTokenError(err) {
  return err?.status === 401 || /invalid token/i.test(err?.message || '');
}

module.exports = {
  createInstance, connectInstance, getInstanceStatus, disconnectInstance,
  deleteInstance, listGroups, sendText, sendMedia, setWebhook,
  isStaleTokenError,
};
