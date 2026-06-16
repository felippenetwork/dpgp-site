/* ================================================
   DPGP — Utilitários compartilhados
   ================================================ */

// ── Auth ──
const Auth = {
  SESSION_KEY: 'dpgp_session',

  isLogged() {
    return localStorage.getItem(this.SESSION_KEY) === 'ok';
  },

  requireAuth() {
    if (!this.isLogged()) {
      window.location.href = '/index.html';
    }
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    window.location.href = '/index.html';
  },
};

// ── Toast ──
function toast(msg, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

// ── Date helpers ──
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function relativeTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000)     return 'agora';
  if (diff < 3600000)   return `${Math.floor(diff / 60000)}min atrás`;
  if (diff < 86400000)  return `${Math.floor(diff / 3600000)}h atrás`;
  if (diff < 2592000000) return `${Math.floor(diff / 86400000)}d atrás`;
  return formatDate(iso);
}

// ── Type labels ──
const TYPE_LABELS = { text: 'Texto', image: 'Imagem', video: 'Vídeo', audio: 'Áudio' };
const TYPE_ICONS  = { text: '💬', image: '🖼️', video: '🎬', audio: '🎵' };

// ── Active nav ──
function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    if (el.dataset.page === path) el.classList.add('active');
    else el.classList.remove('active');
  });
}

// ── Bot status in sidebar ──
async function checkBotStatus() {
  const dot  = document.getElementById('conn-dot');
  const text = document.getElementById('conn-text');
  if (!dot || !text) return;

  const cfg = Store.getConfig();
  const url = (cfg.botApiUrl || CONFIG.botApiUrl || '').replace(/\/$/, '');

  if (!url) {
    dot.className  = 'conn-dot';
    text.textContent = 'Bot não configurado';
    return;
  }

  dot.className = 'conn-dot connecting';
  text.textContent = 'Verificando...';

  try {
    const res = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.connected) {
      dot.className    = 'conn-dot connected';
      text.textContent = 'Bot conectado';
    } else {
      dot.className    = 'conn-dot disconnected';
      text.textContent = 'Bot desconectado';
    }
  } catch {
    dot.className    = 'conn-dot disconnected';
    text.textContent = 'Bot offline';
  }
}

// ── Sidebar HTML (shared) ──
function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-logo">💬</div>
        <div>
          <div class="brand-name">${CONFIG.appName}</div>
          <div class="brand-tagline">${CONFIG.appTagline}</div>
        </div>
      </div>

      <nav class="nav">
        <a href="dashboard.html" class="nav-item" data-page="dashboard.html">
          ${svgIcon('grid')}
          <span>Dashboard</span>
        </a>
        <a href="connections.html" class="nav-item" data-page="connections.html">
          ${svgIcon('wifi')}
          <span>Conexões</span>
        </a>
        <a href="templates.html" class="nav-item" data-page="templates.html">
          ${svgIcon('layers')}
          <span>Templates</span>
        </a>
        <a href="groups.html" class="nav-item" data-page="groups.html">
          ${svgIcon('users')}
          <span>Grupos</span>
        </a>
        <a href="settings.html" class="nav-item" data-page="settings.html">
          ${svgIcon('settings')}
          <span>Configurações</span>
        </a>
        <a href="history.html" class="nav-item" data-page="history.html">
          ${svgIcon('clock')}
          <span>Histórico</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="bot-connection">
          <div class="conn-dot" id="conn-dot"></div>
          <span id="conn-text">Bot não verificado</span>
        </div>
        <button class="btn-logout" onclick="Auth.logout()">
          ${svgIcon('log-out')}
          <span>Sair</span>
        </button>
      </div>
    </aside>`;
}

// ── Mini SVG icons ──
function svgIcon(name) {
  const icons = {
    grid:     `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    wifi:     `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`,
    layers:   `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    users:    `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    settings: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    clock:    `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    'log-out': `<svg style="width:15px;height:15px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    plus:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    edit:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    trash:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
    search:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    x:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    check:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    upload:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
    image:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  };
  return icons[name] || '';
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  // Inject sidebar if placeholder exists
  const sbEl = document.getElementById('sidebar-placeholder');
  if (sbEl) {
    sbEl.outerHTML = renderSidebar();
    setActiveNav();
    setTimeout(checkBotStatus, 300);
    setInterval(checkBotStatus, 30000);
  }
});
