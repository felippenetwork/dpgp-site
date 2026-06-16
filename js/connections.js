/* ================================================
   Connections Page
   ================================================ */

Auth.requireAuth();

let qrInterval = null;

function getBotUrl() {
  const cfg = Store.getConfig();
  return (cfg.botApiUrl || CONFIG.botApiUrl || '').replace(/\/$/, '');
}

function setStatus(state, text) {
  const badge = document.getElementById('conn-status-badge');
  const txtEl = document.getElementById('conn-status-text');
  const icons = { connected: '🟢', disconnected: '🔴', connecting: '🟡' };
  badge.className = `conn-status-badge csb-${state}`;
  badge.querySelector('span').textContent = icons[state] || '⚪';
  txtEl.textContent = text;
}

async function refreshStatus() {
  const url = getBotUrl();
  document.getElementById('configured-url').textContent = url || 'Não configurada';

  if (!url) {
    setStatus('disconnected', 'URL do Bot não configurada');
    showDisconnectedUI();
    return;
  }

  setStatus('connecting', 'Verificando conexão...');

  try {
    const res  = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();

    if (data.connected) {
      setStatus('connected', 'Bot conectado');
      showConnectedUI(data.phone || data.jid || '');
    } else if (data.qr) {
      setStatus('connecting', 'Aguardando scan do QR Code...');
      showQRUI(data.qr);
    } else {
      setStatus('disconnected', 'Bot desconectado');
      showDisconnectedUI();
    }
  } catch {
    setStatus('disconnected', 'Bot offline / não acessível');
    showDisconnectedUI();
  }
}

function showConnectedUI(phone) {
  document.getElementById('qr-section').classList.add('hidden');
  document.getElementById('connected-info').classList.remove('hidden');
  document.getElementById('btn-connect').classList.add('hidden');
  document.getElementById('btn-disconnect').classList.remove('hidden');
  document.getElementById('phone-number').textContent = phone || 'Conectado';
  if (qrInterval) { clearInterval(qrInterval); qrInterval = null; }
}

function showDisconnectedUI() {
  document.getElementById('qr-section').classList.remove('hidden');
  document.getElementById('connected-info').classList.add('hidden');
  document.getElementById('btn-connect').classList.remove('hidden');
  document.getElementById('btn-disconnect').classList.add('hidden');
  document.getElementById('qr-wrap').classList.add('hidden');
  document.getElementById('qr-placeholder').classList.remove('hidden');
  if (qrInterval) { clearInterval(qrInterval); qrInterval = null; }
}

function showQRUI(qrDataUrl) {
  document.getElementById('qr-section').classList.remove('hidden');
  document.getElementById('connected-info').classList.add('hidden');
  document.getElementById('btn-connect').classList.add('hidden');
  document.getElementById('btn-disconnect').classList.add('hidden');

  const img = document.getElementById('qr-img');
  img.src = qrDataUrl;
  document.getElementById('qr-wrap').classList.remove('hidden');
  document.getElementById('qr-placeholder').classList.add('hidden');

  // Poll for status every 5s while waiting
  if (!qrInterval) {
    qrInterval = setInterval(refreshStatus, 5000);
  }
}

async function connectBot() {
  const url = getBotUrl();
  if (!url) {
    toast('Configure a URL do bot em Configurações primeiro.', 'warning');
    return;
  }

  setStatus('connecting', 'Iniciando conexão...');

  try {
    const res  = await fetch(`${url}/api/connect`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    if (data.qr) {
      setStatus('connecting', 'Escaneie o QR Code com seu WhatsApp');
      showQRUI(data.qr);
      toast('QR Code gerado! Escaneie com o WhatsApp.', 'info');
    } else if (data.connected) {
      setStatus('connected', 'Bot conectado');
      showConnectedUI(data.phone || '');
      toast('Bot conectado com sucesso!', 'success');
    } else {
      toast(data.error || 'Erro ao iniciar conexão', 'error');
    }
  } catch {
    toast('Não foi possível conectar ao servidor bot.', 'error');
    setStatus('disconnected', 'Erro de conexão');
  }
}

async function disconnectBot() {
  const url = getBotUrl();
  if (!url) return;

  if (!confirm('Deseja desconectar o bot do WhatsApp?')) return;

  try {
    await fetch(`${url}/api/disconnect`, { method: 'POST', signal: AbortSignal.timeout(8000) });
    toast('Bot desconectado.', 'warning');
    showDisconnectedUI();
    setStatus('disconnected', 'Bot desconectado');
  } catch {
    toast('Erro ao desconectar.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  Auth.requireAuth();
  refreshStatus();
});
