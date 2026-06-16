/* ================================================
   Settings Page
   ================================================ */

Auth.requireAuth();

const DEFAULTS = {
  delayMin: 30,
  delayMax: 60,
  horarioInicio: '08:00',
  horarioFim: '21:00',
  postagensPorDia: 12,
  intervaloHoras: 1,
  intervaloMinutos: 0,
  ativo: false,
  timezone: 'America/Sao_Paulo',
  botApiUrl: '',
  apiKey: 'dpgp-secret-key',
};

function loadForm() {
  const cfg = Store.getConfig();

  document.getElementById('cfg-ativo').checked        = !!cfg.ativo;
  document.getElementById('cfg-horas').value          = cfg.intervaloHoras ?? 1;
  document.getElementById('cfg-minutos').value        = cfg.intervaloMinutos ?? 0;
  document.getElementById('cfg-maxdia').value         = cfg.postagensPorDia ?? 12;
  document.getElementById('cfg-inicio').value         = cfg.horarioInicio || '08:00';
  document.getElementById('cfg-fim').value            = cfg.horarioFim || '21:00';
  document.getElementById('cfg-timezone').value       = cfg.timezone || 'America/Sao_Paulo';
  document.getElementById('cfg-delay-min').value      = cfg.delayMin ?? 30;
  document.getElementById('cfg-delay-max').value      = cfg.delayMax ?? 60;
  document.getElementById('cfg-bot-url').value        = cfg.botApiUrl || '';
  document.getElementById('cfg-api-key').value        = cfg.apiKey || 'dpgp-secret-key';

  checkDelayWarning();
}

function checkDelayWarning() {
  const min = parseInt(document.getElementById('cfg-delay-min').value) || 0;
  document.getElementById('delay-warning').classList.toggle('hidden', min >= 15);
}

document.addEventListener('DOMContentLoaded', () => {
  loadForm();
  document.getElementById('cfg-delay-min').addEventListener('input', checkDelayWarning);
});

function saveAll() {
  const horas   = parseInt(document.getElementById('cfg-horas').value)   || 1;
  const minutos = parseInt(document.getElementById('cfg-minutos').value) || 0;
  const delayMin = parseInt(document.getElementById('cfg-delay-min').value) || 30;
  const delayMax = parseInt(document.getElementById('cfg-delay-max').value) || 60;

  if (delayMax < delayMin) {
    toast('O delay máximo deve ser maior que o mínimo.', 'error');
    return;
  }

  const cfg = {
    ativo:           document.getElementById('cfg-ativo').checked,
    intervaloHoras:  horas,
    intervaloMinutos: minutos,
    postagensPorDia: parseInt(document.getElementById('cfg-maxdia').value) || 12,
    horarioInicio:   document.getElementById('cfg-inicio').value || '08:00',
    horarioFim:      document.getElementById('cfg-fim').value    || '21:00',
    timezone:        document.getElementById('cfg-timezone').value,
    delayMin,
    delayMax,
    botApiUrl:       document.getElementById('cfg-bot-url').value.trim(),
    apiKey:          document.getElementById('cfg-api-key').value.trim() || 'dpgp-secret-key',
  };

  Store.saveConfig(cfg);
  toast('Configurações salvas com sucesso!', 'success');
}

// ── Helpers para API do bot ──
function getBotHeaders() {
  const cfg = Store.getConfig();
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': cfg.apiKey || 'dpgp-secret-key',
  };
}

function getBotUrl() {
  const cfg = Store.getConfig();
  return (cfg.botApiUrl || '').replace(/\/$/, '');
}

function setSyncStatus(msg, color = 'var(--text-3)') {
  const el = document.getElementById('sync-status');
  if (el) el.innerHTML = `<span style="color:${color}">${msg}</span>`;
}

// ── Testar conexão com o bot ──
async function testConnection() {
  const url = getBotUrl();
  const el  = document.getElementById('conn-test-result');
  if (!url) { el.textContent = '⚠️ Configure a URL do servidor primeiro.'; return; }

  el.textContent = '⏳ Testando...';
  try {
    const res  = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    if (data.connected) {
      el.innerHTML = `<span style="color:var(--accent)">✅ Conectado — ${data.phone || 'sem número'}</span>`;
    } else {
      el.innerHTML = `<span style="color:var(--warning)">🟡 Servidor online, WhatsApp desconectado</span>`;
    }
  } catch {
    el.innerHTML = `<span style="color:var(--danger)">❌ Servidor não acessível</span>`;
  }
}

// ── Enviar dados para o bot ──
async function syncToBot() {
  const url = getBotUrl();
  if (!url) { toast('Configure a URL do servidor primeiro.', 'warning'); return; }

  setSyncStatus('⏳ Sincronizando...');
  try {
    const payload = {
      templates: Store.getTemplates(),
      groups:    Store.getGroups(),
      config:    Store.getConfig(),
    };

    const res  = await fetch(`${url}/api/sync`, {
      method:  'POST',
      headers: getBotHeaders(),
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (data.success) {
      const s = data.synced;
      setSyncStatus(
        `✅ Sincronizado com sucesso! Templates: ${s.templates ?? 0}, Grupos: ${s.groups ?? 0}, Config: ${s.config ? 'sim' : 'não'}`,
        'var(--accent)'
      );
      toast('Dados enviados para o bot!', 'success');
    } else {
      setSyncStatus(`❌ Erro: ${data.error}`, 'var(--danger)');
      toast('Erro ao sincronizar.', 'error');
    }
  } catch (err) {
    setSyncStatus(`❌ Falha na conexão com o servidor.`, 'var(--danger)');
    toast('Servidor não acessível.', 'error');
  }
}

// ── Importar histórico do bot ──
async function pullHistory() {
  const url = getBotUrl();
  if (!url) { toast('Configure a URL do servidor primeiro.', 'warning'); return; }

  setSyncStatus('⏳ Importando histórico...');
  try {
    const res  = await fetch(`${url}/api/history?limit=500`, {
      headers: getBotHeaders(),
      signal:  AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (data.success && data.data) {
      // Sobrescreve histórico local com o do bot
      localStorage.setItem('dpgp_history', JSON.stringify(data.data));
      setSyncStatus(`✅ ${data.data.length} registro(s) importado(s) do bot.`, 'var(--accent)');
      toast(`Histórico importado: ${data.data.length} registros.`, 'success');
    } else {
      setSyncStatus(`❌ Erro: ${data.error}`, 'var(--danger)');
    }
  } catch {
    setSyncStatus(`❌ Falha ao importar histórico.`, 'var(--danger)');
    toast('Servidor não acessível.', 'error');
  }
}

// ── Disparo imediato ──
async function triggerDispatch() {
  const url = getBotUrl();
  if (!url) { toast('Configure a URL do servidor primeiro.', 'warning'); return; }

  if (!confirm('Iniciar um disparo manual agora?')) return;

  setSyncStatus('⏳ Disparando...');
  try {
    const res  = await fetch(`${url}/api/dispatch/trigger`, {
      method:  'POST',
      headers: getBotHeaders(),
      signal:  AbortSignal.timeout(30000),
    });

    const data = await res.json();
    if (data.success) {
      setSyncStatus('✅ Disparo executado com sucesso!', 'var(--accent)');
      toast('Disparo realizado!', 'success');
    } else {
      setSyncStatus(`❌ ${data.error}`, 'var(--danger)');
      toast(data.error || 'Erro no disparo.', 'error');
    }
  } catch {
    setSyncStatus('❌ Falha ao conectar com o servidor.', 'var(--danger)');
    toast('Servidor não acessível.', 'error');
  }
}

function resetDefaults() {
  if (!confirm('Restaurar todas as configurações para os valores padrão?')) return;
  Store.saveConfig({ ...DEFAULTS });
  loadForm();
  toast('Configurações restauradas.', 'info');
}

function clearHistory() {
  if (!confirm('Limpar todo o histórico de disparos? Esta ação não pode ser desfeita.')) return;
  Store.clearHistory();
  toast('Histórico limpo.', 'warning');
}

function resetAll() {
  const input = prompt('Para confirmar a redefinição total, digite: CONFIRMAR');
  if (input !== 'CONFIRMAR') {
    toast('Operação cancelada.', 'info');
    return;
  }

  localStorage.removeItem('dpgp_templates');
  localStorage.removeItem('dpgp_groups');
  localStorage.removeItem('dpgp_config');
  localStorage.removeItem('dpgp_history');

  toast('Todos os dados foram removidos.', 'warning');
  setTimeout(() => loadForm(), 500);
}
