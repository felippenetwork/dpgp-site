/* ================================================
   Connections Page
   ================================================ */

Auth.requireAuth();

let qrInterval = null;

function setStatus(state, text) {
  const badge = document.getElementById('conn-status-badge');
  const txtEl = document.getElementById('conn-status-text');
  const icons = { connected: '🟢', disconnected: '🔴', connecting: '🟡' };
  badge.className = `conn-status-badge csb-${state}`;
  badge.querySelector('span').textContent = icons[state] || '⚪';
  txtEl.textContent = text;
}

async function refreshStatus() {
  setStatus('connecting', 'Verificando conexão...');

  try {
    const res  = await fetch('/api/uazapi/status', { signal: AbortSignal.timeout(15000) });
    const data = await res.json();

    if (data.connected) {
      setStatus('connected', 'Bot conectado');
      showConnectedUI(data.phone || '');
    } else if (data.qr) {
      setStatus('connecting', 'Aguardando scan do QR Code...');
      showQRUI(data.qr);
    } else {
      setStatus('disconnected', 'Bot desconectado');
      showDisconnectedUI();
    }
  } catch {
    setStatus('disconnected', 'Erro ao verificar status');
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
  setStatus('connecting', 'Iniciando conexão...');

  try {
    const res  = await fetch('/api/uazapi/connect', {
      method: 'POST',
      signal: AbortSignal.timeout(25000),
    });
    const data = await res.json();

    if (!data.success) {
      toast(data.error || 'Erro ao iniciar conexão', 'error');
      setStatus('disconnected', 'Erro de conexão');
      return;
    }

    if (data.qr) {
      setStatus('connecting', 'Escaneie o QR Code com seu WhatsApp');
      showQRUI(data.qr);
      toast('QR Code gerado! Escaneie com o WhatsApp.', 'info');
    } else if (data.connected) {
      setStatus('connected', 'Bot conectado');
      showConnectedUI(data.phone || '');
      toast('Bot conectado com sucesso!', 'success');
    } else {
      toast('Aguardando QR Code...', 'info');
      if (!qrInterval) qrInterval = setInterval(refreshStatus, 5000);
    }
  } catch {
    toast('Não foi possível conectar à uazapi.', 'error');
    setStatus('disconnected', 'Erro de conexão');
  }
}

async function disconnectBot() {
  if (!confirm('Deseja desconectar o bot do WhatsApp?')) return;

  try {
    await fetch('/api/uazapi/disconnect', { method: 'POST', signal: AbortSignal.timeout(15000) });
    toast('Bot desconectado.', 'warning');
    showDisconnectedUI();
    setStatus('disconnected', 'Bot desconectado');
  } catch {
    toast('Erro ao desconectar.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  Auth.requireAuth();
  try { await Store.init(); } catch (e) { console.error('Supabase:', e.message); }
  refreshStatus();
});
