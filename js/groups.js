/* ================================================
   Groups Page
   ================================================ */

Auth.requireAuth();

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let _importedGroups = [];

function renderTable() {
  const query  = document.getElementById('search').value.toLowerCase();
  const fStat  = document.getElementById('filter-status').value;

  let list = Store.getGroups();
  if (query) list = list.filter(g => g.name.toLowerCase().includes(query) || g.jid.includes(query));
  if (fStat === 'active')   list = list.filter(g => g.active);
  if (fStat === 'inactive') list = list.filter(g => !g.active);

  const all = Store.getGroups();
  document.getElementById('group-count').textContent =
    `${all.filter(g=>g.active).length} ativo(s) · ${all.length} total`;

  const tbody  = document.getElementById('groups-tbody');
  const empty  = document.getElementById('groups-empty');
  const table  = document.getElementById('groups-table');

  if (!list.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    table.style.display = 'none';
    return;
  }

  empty.classList.add('hidden');
  table.style.display = '';

  tbody.innerHTML = list.map(g => `
    <tr>
      <td class="td-bold">${escHtml(g.name)}</td>
      <td class="td-mono">${escHtml(g.jid)}</td>
      <td class="text-muted text-sm">${formatDateShort(g.addedAt)}</td>
      <td>
        <span class="badge ${g.active ? 'badge-active' : 'badge-inactive'}">
          ${g.active ? '● Ativo' : '● Inativo'}
        </span>
      </td>
      <td class="text-right">
        <div class="td-actions" style="justify-content:flex-end">
          <label class="toggle" title="${g.active ? 'Desativar' : 'Ativar'}">
            <input type="checkbox" ${g.active ? 'checked' : ''} onchange="toggleGroup('${g.id}')">
            <div class="toggle-track"></div>
            <div class="toggle-thumb"></div>
          </label>
          <button class="btn btn-ghost btn-icon btn-sm" title="Editar nome" onclick="editGroupName('${g.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-danger btn-icon btn-sm" title="Remover" onclick="deleteGroup('${g.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Modal Add ──
function openAddModal() {
  document.getElementById('grp-name').value = '';
  document.getElementById('grp-jid').value  = '';
  document.getElementById('modal-backdrop').classList.remove('hidden');
  setTimeout(() => document.getElementById('grp-name').focus(), 100);
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
}

function closeModalBackdrop(e) {
  if (e.target === document.getElementById('modal-backdrop')) closeModal();
}

function normalizeJid() {
  let val = document.getElementById('grp-jid').value.trim();
  // Auto-append @g.us if user typed just numbers
  if (val && /^\d+$/.test(val)) {
    document.getElementById('grp-jid').value = val + '@g.us';
  }
}

async function saveGroup() {
  const name = document.getElementById('grp-name').value.trim();
  const jid  = document.getElementById('grp-jid').value.trim();
  if (!jid) { toast('Informe o JID do grupo.', 'warning'); return; }
  try {
    const result = await Store.addGroup({ name: name || jid, jid });
    if (!result) { toast('Este grupo já está cadastrado.', 'error'); return; }
    toast('Grupo adicionado!', 'success');
    closeModal();
    renderTable();
  } catch (err) { toast('Erro: ' + err.message, 'error'); }
}

async function toggleGroup(id) {
  const g = Store.getGroups().find(g => g.id === id);
  if (!g) return;
  try { await Store.updateGroup(id, { active: !g.active }); renderTable(); }
  catch (err) { toast('Erro: ' + err.message, 'error'); }
}

async function editGroupName(id) {
  const g = Store.getGroups().find(g => g.id === id);
  if (!g) return;
  const name = prompt('Novo nome do grupo:', g.name);
  if (name === null) return;
  try {
    await Store.updateGroup(id, { name: name.trim() || g.name });
    renderTable();
    toast('Nome atualizado.', 'success');
  } catch (err) { toast('Erro: ' + err.message, 'error'); }
}

async function deleteGroup(id) {
  const g = Store.getGroups().find(g => g.id === id);
  if (!g) return;
  if (!confirm(`Remover o grupo "${g.name}" da lista de disparo?`)) return;
  try {
    await Store.deleteGroup(id);
    toast('Grupo removido.', 'warning');
    renderTable();
  } catch (err) { toast('Erro: ' + err.message, 'error'); }
}

// ── Carregar grupos do WhatsApp ──
let _waGroups = [];

async function loadFromWhatsApp() {
  document.getElementById('wa-backdrop').classList.remove('hidden');
  document.getElementById('wa-loading').classList.remove('hidden');
  document.getElementById('wa-content').classList.add('hidden');
  document.getElementById('wa-error').classList.add('hidden');

  try {
    const res  = await fetch('/api/uazapi/groups', { signal: AbortSignal.timeout(20000) });
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Erro ao carregar grupos');

    _waGroups = data.groups;
    renderWAList();
    document.getElementById('wa-loading').classList.add('hidden');
    document.getElementById('wa-content').classList.remove('hidden');
    document.getElementById('wa-count').textContent = `${_waGroups.length} grupo(s) encontrado(s)`;

  } catch (err) {
    document.getElementById('wa-loading').classList.add('hidden');
    document.getElementById('wa-error').classList.remove('hidden');
    document.getElementById('wa-error').textContent =
      err.message.includes('conectado') ? '⚠️ WhatsApp não está conectado.' :
      '❌ Não foi possível carregar os grupos: ' + err.message;
  }
}

function renderWAList(filter = '') {
  const existing = new Set(Store.getGroups().map(g => g.jid));
  const list     = filter
    ? _waGroups.filter(g => g.name.toLowerCase().includes(filter.toLowerCase()))
    : _waGroups;

  document.getElementById('wa-list').innerHTML = list.map(g => `
    <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
      <input type="checkbox" class="wa-chk" data-jid="${escHtml(g.jid)}" data-name="${escHtml(g.name)}" ${existing.has(g.jid) ? 'checked' : ''} style="width:16px;height:16px;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(g.name)}</div>
        <div style="font-size:11px;color:var(--text-3);font-family:monospace">${escHtml(g.jid)} · ${g.participants} membro(s)</div>
      </div>
      ${existing.has(g.jid) ? '<span style="font-size:11px;color:var(--accent);flex-shrink:0">✓ já adicionado</span>' : ''}
    </label>`).join('') || '<div style="padding:24px;text-align:center;color:var(--text-3)">Nenhum grupo encontrado.</div>';
}

function filterWAList() {
  renderWAList(document.getElementById('wa-search').value);
}

function toggleWASelectAll(check) {
  document.querySelectorAll('.wa-chk').forEach(el => el.checked = check);
}

async function importWASelected() {
  const checks = document.querySelectorAll('.wa-chk:checked');
  if (!checks.length) { toast('Selecione pelo menos um grupo.', 'warning'); return; }

  let added = 0;
  for (const el of checks) {
    try {
      const result = await Store.addGroup({ jid: el.dataset.jid, name: el.dataset.name });
      if (result) added++;
    } catch (_) {}
  }

  toast(`${added} grupo(s) adicionado(s)!${checks.length - added > 0 ? ` (${checks.length - added} já existiam)` : ''}`, 'success');
  closeWAModal();
  renderTable();
}

function closeWAModal() {
  document.getElementById('wa-backdrop').classList.add('hidden');
  document.getElementById('wa-search').value = '';
}

function closeWAModalBackdrop(e) {
  if (e.target === document.getElementById('wa-backdrop')) closeWAModal();
}

// ── Import from Bot ──
function importFromBot() {
  document.getElementById('import-json').value = '';
  document.getElementById('import-preview').classList.add('hidden');
  _importedGroups = [];
  document.getElementById('import-backdrop').classList.remove('hidden');
}

function closeImportModal() {
  document.getElementById('import-backdrop').classList.add('hidden');
}

function closeImportBackdrop(e) {
  if (e.target === document.getElementById('import-backdrop')) closeImportModal();
}

function parseImport() {
  const raw = document.getElementById('import-json').value.trim();
  if (!raw) { toast('Cole o JSON do bot.', 'warning'); return; }

  try {
    const data = JSON.parse(raw);
    let groups = [];

    // Support multiple formats from the bot config.json
    if (data.grupos && Array.isArray(data.grupos)) {
      groups = data.grupos.map(g => ({ jid: g.id || g.jid, name: g.name || g.id || g.jid }));
    } else if (Array.isArray(data)) {
      groups = data.map(g => ({ jid: g.id || g.jid, name: g.name || g.id || g.jid }));
    }

    if (!groups.length) {
      toast('Nenhum grupo encontrado no JSON.', 'error');
      return;
    }

    _importedGroups = groups;
    document.getElementById('import-preview').classList.remove('hidden');
    document.getElementById('import-list').innerHTML = groups.map(g =>
      `<div style="padding:4px 0;border-bottom:1px solid var(--border)">
        <strong>${escHtml(g.name)}</strong>
        <span class="font-mono text-muted" style="font-size:11px;margin-left:8px">${escHtml(g.jid)}</span>
      </div>`
    ).join('');

    toast(`${groups.length} grupo(s) encontrado(s). Clique em "Importar grupos".`, 'info');
  } catch {
    toast('JSON inválido. Verifique o conteúdo copiado.', 'error');
  }
}

async function doImport() {
  if (!_importedGroups.length) { toast('Clique em "Pré-visualizar" primeiro.', 'warning'); return; }

  let added = 0;
  for (const g of _importedGroups) {
    try { const r = await Store.addGroup(g); if (r) added++; } catch (_) {}
  }

  toast(`${added} grupo(s) importado(s)!${_importedGroups.length - added > 0 ? ` (${_importedGroups.length - added} já existiam)` : ''}`, 'success');
  closeImportModal();
  renderTable();
}

document.addEventListener('DOMContentLoaded', async () => {
  try { await Store.init(); } catch { toast('Configure o Supabase em Configurações → Banco de Dados.', 'warning'); return; }
  renderTable();
});
