/* ================================================
   History Page
   ================================================ */

Auth.requireAuth();

const PAGE_SIZE = 25;
let currentPage = 1;
let filteredList = [];

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderHistory() {
  currentPage = 1;
  filterAndRender();
}

function filterAndRender() {
  const query   = document.getElementById('search').value.toLowerCase();
  const fStatus = document.getElementById('filter-status').value;
  const fType   = document.getElementById('filter-type').value;
  const fDate   = document.getElementById('filter-date').value;

  let list = Store.getHistory();

  if (query)   list = list.filter(h => (h.groupName || h.groupJid || '').toLowerCase().includes(query));
  if (fStatus) list = list.filter(h => h.status === fStatus);
  if (fType)   list = list.filter(h => h.templateType === fType);
  if (fDate)   list = list.filter(h => h.sentAt && h.sentAt.startsWith(fDate));

  filteredList = list;

  const all = Store.getHistory();
  const today = new Date().toDateString();
  document.getElementById('hist-count').textContent = `${list.length} de ${all.length} registros`;
  document.getElementById('hs-success').textContent = all.filter(h => h.status === 'success').length;
  document.getElementById('hs-failed').textContent  = all.filter(h => h.status === 'failed').length;
  document.getElementById('hs-today').textContent   = all.filter(h => new Date(h.sentAt).toDateString() === today).length;

  renderPage();
}

function renderPage() {
  const tbody  = document.getElementById('hist-tbody');
  const empty  = document.getElementById('hist-empty');
  const table  = document.getElementById('hist-table');
  const info   = document.getElementById('page-info');
  const btnP   = document.getElementById('btn-prev');
  const btnN   = document.getElementById('btn-next');
  const pgDiv  = document.getElementById('pagination');

  if (!filteredList.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    table.style.display = 'none';
    pgDiv.style.display = 'none';
    return;
  }

  empty.classList.add('hidden');
  table.style.display = '';

  const totalPages = Math.ceil(filteredList.length / PAGE_SIZE);
  currentPage = Math.max(1, Math.min(currentPage, totalPages));

  const slice = filteredList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  tbody.innerHTML = slice.map(h => `
    <tr>
      <td>
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:${h.status === 'success' ? 'var(--accent)' : 'var(--danger)'}">
          ${h.status === 'success' ? '✅' : '❌'}
          ${h.status === 'success' ? 'Sucesso' : 'Falha'}
        </span>
      </td>
      <td class="td-bold">${escHtml(h.groupName || h.groupJid || '—')}</td>
      <td>
        <span class="badge badge-${h.templateType || 'text'}">
          ${TYPE_ICONS[h.templateType] || '💬'} ${TYPE_LABELS[h.templateType] || 'Texto'}
        </span>
      </td>
      <td class="text-muted text-sm">${formatDate(h.sentAt)}</td>
      <td class="text-muted text-sm">${relativeTime(h.sentAt)}</td>
    </tr>`).join('');

  info.textContent = `Página ${currentPage} de ${totalPages} · ${filteredList.length} registros`;
  pgDiv.style.display = totalPages > 1 ? 'flex' : 'none';
  btnP.disabled = currentPage <= 1;
  btnN.disabled = currentPage >= totalPages;
}

function changePage(delta) {
  currentPage += delta;
  renderPage();
}

async function clearAll() {
  if (!confirm('Limpar todo o histórico de disparos?')) return;
  try {
    await Store.clearHistory();
    toast('Histórico limpo.', 'warning');
    filteredList = [];
    renderPage();
    document.getElementById('hs-success').textContent = 0;
    document.getElementById('hs-failed').textContent  = 0;
    document.getElementById('hs-today').textContent   = 0;
    document.getElementById('hist-count').textContent = '0 registros';
  } catch (err) { toast('Erro: ' + err.message, 'error'); }
}

function exportCSV() {
  const data = Store.getHistory();
  if (!data.length) { toast('Nenhum dado para exportar.', 'warning'); return; }

  const header = 'Status,Grupo,JID,Tipo,Data/Hora';
  const rows   = data.map(h =>
    [h.status, `"${(h.groupName || '').replace(/"/g,'""')}"`, h.groupJid, h.templateType, h.sentAt].join(',')
  );

  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `historico-dpgp-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportado!', 'success');
}

document.addEventListener('DOMContentLoaded', async () => {
  try { await Store.init(); } catch { toast('Configure o Supabase em Configurações → Banco de Dados.', 'warning'); return; }
  filterAndRender();
});
