/* ================================================
   Dashboard Page
   ================================================ */

Auth.requireAuth();

function loadPage() {
  const stats = Store.getStats();

  document.getElementById('stat-templates').textContent = stats.activeTemplates;
  document.getElementById('stat-groups').textContent    = stats.activeGroups;
  document.getElementById('stat-today').textContent     = stats.dispatchesToday;
  document.getElementById('stat-total').textContent     = stats.totalDispatches;

  const cfg = Store.getConfig();
  document.getElementById('info-ativo').innerHTML = cfg.ativo
    ? '<span style="color:var(--accent)">● Ativa</span>'
    : '<span style="color:var(--danger)">● Pausada</span>';

  const horas = cfg.intervaloHoras || 1;
  const mins  = cfg.intervaloMinutos || 0;
  document.getElementById('info-intervalo').textContent =
    mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;

  document.getElementById('info-horario').textContent =
    `${cfg.horarioInicio || '08:00'} → ${cfg.horarioFim || '21:00'}`;

  document.getElementById('info-maxdia').textContent =
    `${cfg.postagensPorDia || 12} postagens`;

  document.getElementById('info-delay').textContent =
    `${cfg.delayMin || 30}s — ${cfg.delayMax || 60}s`;

  renderChart();
  renderRecentHistory();
}

function renderChart() {
  const history = Store.getHistory();
  const days    = [];
  const counts  = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toDateString();
    const label  = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    days.push(label);
    counts.push(history.filter(h => new Date(h.sentAt).toDateString() === dayStr).length);
  }

  const ctx = document.getElementById('dispatch-chart').getContext('2d');

  if (window._dashChart) window._dashChart.destroy();

  window._dashChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Disparos',
        data: counts,
        backgroundColor: 'rgba(37,211,102,0.25)',
        borderColor: '#25D366',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1A1D27',
          borderColor: '#2D3148',
          borderWidth: 1,
          titleColor: '#E2E8F0',
          bodyColor: '#94A3B8',
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} disparo(s)`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#2D3148' },
          ticks: { color: '#64748B', font: { size: 11 } },
        },
        y: {
          grid: { color: '#2D3148' },
          ticks: { color: '#64748B', font: { size: 11 }, stepSize: 1 },
          beginAtZero: true,
        },
      },
    },
  });
}

function renderRecentHistory() {
  const history = Store.getHistory().slice(0, 10);
  const el = document.getElementById('recent-history');

  if (!history.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">Nenhum disparo registrado</div>
        <div class="empty-desc">Os disparos realizados aparecerão aqui.</div>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="dispatch-list">${history.map(h => `
    <div class="history-item">
      <div class="history-icon" style="background:${h.status === 'success' ? 'var(--accent-dim)' : 'var(--danger-dim)'}">
        ${h.status === 'success' ? '✅' : '❌'}
      </div>
      <div class="history-info">
        <div class="history-group">${escHtml(h.groupName || h.groupJid || 'Grupo desconhecido')}</div>
        <div class="history-detail">
          ${TYPE_ICONS[h.templateType] || '💬'} Template ${h.templateType || 'text'}
        </div>
      </div>
      <div class="history-time">${relativeTime(h.sentAt)}</div>
    </div>`).join('')}
  </div>`;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.addEventListener('DOMContentLoaded', async () => {
  try { await Store.init(); } catch { toast('Configure o Supabase em Configurações → Banco de Dados.', 'warning'); return; }
  loadPage();
});
