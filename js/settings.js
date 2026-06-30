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
  ausenciaAtivo: false,
  ausenciaMensagens: [],
  ausenciaDelay: 25,
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
  document.getElementById('cfg-ausencia-ativo').checked = !!cfg.ausenciaAtivo;
  document.getElementById('cfg-ausencia-delay').value   = cfg.ausenciaDelay ?? 25;
  const list = document.getElementById('ausencia-msgs-list');
  list.innerHTML = '';
  // compatibilidade com campo antigo
  const msgs = Array.isArray(cfg.ausenciaMensagens) && cfg.ausenciaMensagens.length
    ? cfg.ausenciaMensagens
    : (cfg.ausenciaMensagem ? [cfg.ausenciaMensagem] : []);
  if (msgs.length) msgs.forEach(m => addAusenciaMsg(m));
  else addAusenciaMsg();

  checkDelayWarning();
}

function checkDelayWarning() {
  const min = parseInt(document.getElementById('cfg-delay-min').value) || 0;
  document.getElementById('delay-warning').classList.toggle('hidden', min >= 15);
}

document.addEventListener('DOMContentLoaded', async () => {
  try { await Store.init(); } catch (e) { toast('Erro ao conectar ao Supabase: ' + e.message, 'error'); }
  loadForm();
  document.getElementById('cfg-delay-min').addEventListener('input', checkDelayWarning);
});

async function saveAll() {
  const horas   = parseInt(document.getElementById('cfg-horas').value)   || 1;
  const minutos = parseInt(document.getElementById('cfg-minutos').value) || 0;
  const delayMin = parseInt(document.getElementById('cfg-delay-min').value) || 30;
  const delayMax = parseInt(document.getElementById('cfg-delay-max').value) || 60;

  if (delayMax < delayMin) {
    toast('O delay máximo deve ser maior que o mínimo.', 'error');
    return;
  }

  // Faz merge com a config atual em vez de sobrescrever — o blob também guarda
  // estado interno do servidor (token da instância uazapi, fila de disparo,
  // cooldown de ausência) que não deve ser perdido ao salvar este formulário.
  const cfg = {
    ...Store.getConfig(),
    ativo:           document.getElementById('cfg-ativo').checked,
    intervaloHoras:  horas,
    intervaloMinutos: minutos,
    postagensPorDia: parseInt(document.getElementById('cfg-maxdia').value) || 12,
    horarioInicio:   document.getElementById('cfg-inicio').value || '08:00',
    horarioFim:      document.getElementById('cfg-fim').value    || '21:00',
    timezone:        document.getElementById('cfg-timezone').value,
    delayMin,
    delayMax,
    ausenciaAtivo:     document.getElementById('cfg-ausencia-ativo').checked,
    ausenciaMensagens: getAusenciaMensagens(),
    ausenciaDelay:     parseInt(document.getElementById('cfg-ausencia-delay').value) || 25,
  };

  try {
    await Store.saveConfig(cfg);
    toast('Configurações salvas com sucesso!', 'success');
  } catch (err) {
    toast('Erro ao salvar: ' + err.message, 'error');
  }
}

function setSyncStatus(msg, color = 'var(--text-3)') {
  const el = document.getElementById('sync-status');
  if (el) el.innerHTML = `<span style="color:${color}">${msg}</span>`;
}

// ── Disparo imediato ──
async function triggerDispatch() {
  if (!confirm('Iniciar um disparo manual agora?')) return;

  setSyncStatus('⏳ Disparando...');
  try {
    const res  = await fetch('/api/dispatch/trigger', {
      method:  'POST',
      signal:  AbortSignal.timeout(60000),
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

// ── Mensagens de ausência (lista dinâmica) ────────────────────────────────────
function addAusenciaMsg(value = '') {
  const list = document.getElementById('ausencia-msgs-list');
  const idx  = list.children.length + 1;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:8px;align-items:flex-start';

  const ta = document.createElement('textarea');
  ta.className   = 'form-control ausencia-msg-input';
  ta.rows        = 3;
  ta.placeholder = `Mensagem ${idx}...`;
  ta.style.flex  = '1';
  ta.value       = value;

  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'btn btn-danger btn-icon btn-sm';
  btn.title     = 'Remover';
  btn.style.cssText = 'margin-top:2px;flex-shrink:0';
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  btn.onclick   = () => { wrap.remove(); updateAusenciaPlaceholders(); };

  wrap.appendChild(ta);
  wrap.appendChild(btn);
  list.appendChild(wrap);
}

function updateAusenciaPlaceholders() {
  document.querySelectorAll('.ausencia-msg-input').forEach((ta, i) => {
    ta.placeholder = `Mensagem ${i + 1}...`;
  });
}

function getAusenciaMensagens() {
  return Array.from(document.querySelectorAll('.ausencia-msg-input'))
    .map(ta => ta.value.trim())
    .filter(Boolean);
}

function resetDefaults() {
  if (!confirm('Restaurar todas as configurações para os valores padrão?')) return;
  Store.saveConfig({ ...Store.getConfig(), ...DEFAULTS });
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
