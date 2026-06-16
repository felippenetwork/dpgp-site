/* ================================================
   Templates Page
   ================================================ */

Auth.requireAuth();

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderGrid() {
  const query  = document.getElementById('search').value.toLowerCase();
  const fType  = document.getElementById('filter-type').value;
  const fStat  = document.getElementById('filter-status').value;

  let list = Store.getTemplates();

  if (query)           list = list.filter(t => (t.name || '').toLowerCase().includes(query) || (t.content || '').toLowerCase().includes(query) || (t.mediaName || '').toLowerCase().includes(query));
  if (fType)           list = list.filter(t => t.type === fType);
  if (fStat === 'active')   list = list.filter(t => t.active);
  if (fStat === 'inactive') list = list.filter(t => !t.active);

  const all = Store.getTemplates();
  document.getElementById('tpl-count').textContent =
    `${all.filter(t=>t.active).length} ativo(s) · ${all.length} total`;

  const grid = document.getElementById('templates-grid');

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">📋</div>
        <div class="empty-title">Nenhum template encontrado</div>
        <div class="empty-desc">${query || fType || fStat ? 'Tente outros filtros.' : 'Crie seu primeiro template de postagem.'}</div>
        ${!query && !fType && !fStat ? `<button class="btn btn-primary" onclick="openModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Criar primeiro template
        </button>` : ''}
      </div>`;
    return;
  }

  grid.innerHTML = list.map(t => cardHTML(t)).join('');
}

function cardHTML(t) {
  const badgeClass = `badge badge-${t.type}`;
  const mediaHTML  = mediaPreviewHTML(t);

  return `
    <div class="template-card ${t.active ? '' : 'inactive'}" id="card-${t.id}">
      ${mediaHTML}
      <div class="template-body">
        <div class="template-meta">
          <span class="${badgeClass}">${TYPE_ICONS[t.type]} ${TYPE_LABELS[t.type]}</span>
          <span class="template-id">#${t.id.slice(-6)}</span>
        </div>
        ${t.name ? `<div style="font-size:14px;font-weight:700;color:var(--text-1);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(t.name)}</div>` : ''}
        <div class="template-content">
          ${t.content ? escHtml(t.content) : '<span style="color:var(--text-3);font-style:italic">Sem legenda</span>'}
        </div>
        <div class="template-footer">
          <span class="template-date">${formatDateShort(t.createdAt)}</span>
          <button class="btn btn-ghost btn-icon btn-sm" title="Visualizar" onclick="viewTemplate('${t.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Editar" onclick="openModal('${t.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-danger btn-icon btn-sm" title="Deletar" onclick="deleteTemplate('${t.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm" title="${t.active ? 'Desativar' : 'Ativar'}" onclick="toggleTemplate('${t.id}')">
            ${t.active
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="width:15px;height:15px"><polyline points="20 6 9 17 4 12"/></svg>`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" style="width:15px;height:15px"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
            }
          </button>
        </div>
      </div>
    </div>`;
}

function mediaPreviewHTML(t) {
  if (t.type === 'text') {
    return `<div class="template-media-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Mensagem de texto</span></div>`;
  }
  if (t.type === 'audio') {
    return `<div class="template-media-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg><span>Áudio</span></div>`;
  }
  if (t.type === 'image' && t.mediaUrl) {
    return `<div class="template-media"><img src="${escHtml(t.mediaUrl)}" alt="preview" onerror="this.parentElement.innerHTML='<div class=template-media-placeholder><span style=font-size:32px>🖼️</span><span>Imagem</span></div>'"></div>`;
  }
  if (t.type === 'video' && t.mediaUrl) {
    return `<div class="template-media" style="position:relative;background:#000">
      <video src="${escHtml(t.mediaUrl)}" style="width:100%;height:180px;object-fit:cover" muted></video>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
        <div style="background:rgba(0,0,0,.55);border-radius:50%;width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-size:20px">▶️</div>
      </div>
    </div>`;
  }
  const icon = t.type === 'image' ? '🖼️' : '🎬';
  return `<div class="template-media-placeholder"><span style="font-size:32px;opacity:.5">${icon}</span><span>${TYPE_LABELS[t.type]}</span><span style="font-size:11px">URL não configurada</span></div>`;
}

// ── Modal ──
function openModal(id = null) {
  const isEdit = !!id;
  document.getElementById('modal-title').textContent   = isEdit ? 'Editar Template' : 'Novo Template';
  document.getElementById('modal-save-btn').textContent = isEdit ? 'Salvar alterações' : 'Criar Template';
  document.getElementById('edit-id').value = id || '';

  if (isEdit) {
    const tpl = Store.getTemplates().find(t => t.id === id);
    if (!tpl) return;
    document.getElementById('tpl-name').value    = tpl.name || '';
    document.getElementById('tpl-type').value    = tpl.type;
    document.getElementById('tpl-content').value = tpl.content || '';
    document.getElementById('tpl-active').checked = tpl.active;
    _mediaUrls = Array.isArray(tpl.mediaUrls) ? [...tpl.mediaUrls] : (tpl.mediaUrl ? [tpl.mediaUrl] : []);
    document.getElementById('upload-idle').classList.remove('hidden');
    document.getElementById('upload-progress').classList.add('hidden');
    document.getElementById('upload-done').classList.add('hidden');
    document.getElementById('tpl-media-url').value = '';
    document.getElementById('tpl-file-input').value = '';
    setMediaTab('upload');
    onTypeChange();
    renderMediaList();
    updateCharCount();
  } else {
    document.getElementById('tpl-name').value      = '';
    document.getElementById('tpl-type').value      = 'text';
    document.getElementById('tpl-content').value   = '';
    document.getElementById('tpl-active').checked  = true;
    resetUploadArea();
    onTypeChange();
    updateCharCount();
  }

  document.getElementById('modal-backdrop').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
}

function closeModalBackdrop(e) {
  if (e.target === document.getElementById('modal-backdrop')) closeModal();
}

// ── Lista de mídias ──
let _mediaUrls = [];

function renderMediaList() {
  const list = document.getElementById('media-list');
  const type = document.getElementById('tpl-type').value;
  if (!_mediaUrls.length) { list.innerHTML = ''; return; }

  list.innerHTML = _mediaUrls.map((url, i) => {
    const thumb = type === 'image'
      ? `<img src="${escHtml(url)}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;flex-shrink:0" onerror="this.style.display='none'">`
      : type === 'video'
      ? `<div style="width:60px;height:60px;background:var(--bg-hover);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">🎬</div>`
      : `<div style="width:60px;height:60px;background:var(--bg-hover);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">🎵</div>`;

    const label = url.split('/').pop().split('?')[0] || url;

    return `<div style="display:flex;align-items:center;gap:10px;background:var(--bg-hover);border-radius:8px;padding:8px 10px">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(label)}</div>
        ${i === 0 ? '<div style="font-size:11px;color:var(--accent);margin-top:2px">Principal</div>' : ''}
      </div>
      <button type="button" class="btn btn-danger btn-icon btn-sm" title="Remover" onclick="removeMedia(${i})" style="flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  }).join('');
}

function removeMedia(i) {
  _mediaUrls.splice(i, 1);
  renderMediaList();
}

function addMediaUrl() {
  const input = document.getElementById('tpl-media-url');
  const url = input.value.trim();
  if (!url) { toast('Digite uma URL válida.', 'warning'); return; }
  _mediaUrls.push(url);
  input.value = '';
  renderMediaList();
  toast('Mídia adicionada.', 'success');
}

// ── Upload de mídia ──
function setMediaTab(tab) {
  const isUpload = tab === 'upload';
  document.getElementById('media-tab-upload').classList.toggle('hidden', !isUpload);
  document.getElementById('media-tab-url').classList.toggle('hidden', isUpload);
  document.getElementById('tab-upload').className = isUpload ? 'btn btn-secondary btn-sm' : 'btn btn-ghost btn-sm';
  document.getElementById('tab-url').className    = isUpload ? 'btn btn-ghost btn-sm'     : 'btn btn-secondary btn-sm';
  document.getElementById('tab-upload').style.flex = '1';
  document.getElementById('tab-url').style.flex    = '1';
}

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('upload-drop-area').style.borderColor = 'var(--border)';
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelect(file);
}

const UPLOAD_CHUNK_SIZE = 500 * 1024;

async function handleFileSelect(file) {
  if (!file) return;
  const cfg    = Store.getConfig();
  const apiUrl = (cfg.botApiUrl || '').replace(/\/$/, '');
  if (!apiUrl) { toast('Configure a URL do servidor nas Configurações.', 'warning'); return; }

  const progress = document.getElementById('upload-progress');
  document.getElementById('upload-idle').classList.add('hidden');
  document.getElementById('upload-done').classList.add('hidden');
  progress.classList.remove('hidden');
  progress.textContent = '⏳ Lendo arquivo...';

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const headers = {
      'Content-Type': 'application/json',
      'X-Api-Key':    cfg.apiKey || 'dpgp-secret-key',
    };

    progress.textContent = '⏳ Iniciando...';
    const startRes  = await fetch(`${apiUrl}/api/upload/start`, { method: 'POST', headers, body: '{}' });
    const startData = await startRes.json();
    if (!startData.success) throw new Error(startData.error || 'Falha ao iniciar upload');
    const { uploadId } = startData;

    const total = Math.ceil(base64.length / UPLOAD_CHUNK_SIZE);
    for (let i = 0; i < total; i++) {
      const chunk = base64.slice(i * UPLOAD_CHUNK_SIZE, (i + 1) * UPLOAD_CHUNK_SIZE);
      progress.textContent = `⏳ Enviando... ${Math.round((i + 1) / total * 90)}%`;
      const chunkRes  = await fetch(`${apiUrl}/api/upload/chunk`, {
        method: 'POST', headers,
        body: JSON.stringify({ uploadId, index: i, data: chunk }),
      });
      const chunkData = await chunkRes.json();
      if (!chunkData.success) throw new Error(chunkData.error || `Falha no chunk ${i}`);
    }

    progress.textContent = '⏳ Finalizando...';
    const finishRes  = await fetch(`${apiUrl}/api/upload/finish`, {
      method: 'POST', headers,
      body: JSON.stringify({ uploadId, filename: file.name }),
    });
    const finishData = await finishRes.json();
    if (!finishData.success) throw new Error(finishData.error || 'Falha ao finalizar upload');

    _mediaUrls.push(finishData.url);
    renderMediaList();

    progress.classList.add('hidden');
    document.getElementById('upload-done').classList.remove('hidden');
    document.getElementById('upload-done').textContent = `✅ ${file.name} enviado`;
    document.getElementById('tpl-file-input').value = '';
    toast('Arquivo enviado!', 'success');
  } catch (err) {
    progress.classList.add('hidden');
    document.getElementById('upload-idle').classList.remove('hidden');
    toast('Erro ao enviar: ' + err.message, 'error');
  }
}

function resetUploadArea() {
  _mediaUrls = [];
  document.getElementById('media-list').innerHTML = '';
  document.getElementById('upload-idle').classList.remove('hidden');
  document.getElementById('upload-progress').classList.add('hidden');
  document.getElementById('upload-done').classList.add('hidden');
  document.getElementById('tpl-file-input').value = '';
  document.getElementById('tpl-media-url').value = '';
  setMediaTab('upload');
}

function onTypeChange() {
  const type = document.getElementById('tpl-type').value;
  const mediaSection = document.getElementById('media-section');
  const contentLabel = document.getElementById('content-label');

  if (type === 'text') {
    mediaSection.classList.add('hidden');
    contentLabel.textContent = 'Conteúdo da mensagem';
  } else {
    mediaSection.classList.remove('hidden');
    contentLabel.textContent = 'Legenda (opcional)';
    renderMediaList();
  }
}

function updateCharCount() {
  const len = document.getElementById('tpl-content').value.length;
  document.getElementById('char-count').textContent = `${len} caractere${len !== 1 ? 's' : ''}`;
}

async function saveTemplate() {
  const id      = document.getElementById('edit-id').value;
  const name    = document.getElementById('tpl-name').value.trim();
  const type    = document.getElementById('tpl-type').value;
  const content = document.getElementById('tpl-content').value.trim();
  const active  = document.getElementById('tpl-active').checked;

  if (type === 'text' && !content) { toast('Digite o conteúdo da mensagem.', 'warning'); return; }
  if (type !== 'text' && !_mediaUrls.length) { toast('Adicione pelo menos uma mídia.', 'warning'); return; }

  const mediaUrls = [..._mediaUrls];
  const mediaUrl  = mediaUrls[0] || '';

  const btn = document.getElementById('modal-save-btn');
  btn.disabled = true;
  try {
    if (id) {
      await Store.updateTemplate(id, { name, type, content, mediaUrls, mediaUrl, active });
      toast('Template atualizado!', 'success');
    } else {
      await Store.addTemplate({ name, type, content, mediaUrls, mediaUrl, active });
      toast('Template criado!', 'success');
    }
    closeModal();
    renderGrid();
  } catch (err) {
    toast('Erro ao salvar: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteTemplate(id) {
  if (!confirm('Deseja deletar este template?')) return;
  try {
    await Store.deleteTemplate(id);
    toast('Template deletado.', 'warning');
    renderGrid();
  } catch (err) { toast('Erro: ' + err.message, 'error'); }
}

async function toggleTemplate(id) {
  const tpl = Store.getTemplates().find(t => t.id === id);
  if (!tpl) return;
  try {
    await Store.updateTemplate(id, { active: !tpl.active });
    renderGrid();
  } catch (err) { toast('Erro: ' + err.message, 'error'); }
}

// ── View Modal ──
function viewTemplate(id) {
  const tpl = Store.getTemplates().find(t => t.id === id);
  if (!tpl) return;

  document.getElementById('view-title').textContent = tpl.name ? `${tpl.name}` : `${TYPE_ICONS[tpl.type]} Template — ${TYPE_LABELS[tpl.type]}`;
  document.getElementById('view-edit-btn').onclick = () => { closeView(); openModal(id); };

  let html = '';
  if (tpl.mediaUrl && tpl.type === 'image') {
    html += `<img src="${escHtml(tpl.mediaUrl)}" style="width:100%;max-height:300px;object-fit:cover;border-radius:var(--radius-sm);margin-bottom:16px">`;
  } else if (tpl.mediaUrl && tpl.type === 'video') {
    html += `<video src="${escHtml(tpl.mediaUrl)}" controls style="width:100%;max-height:300px;border-radius:var(--radius-sm);margin-bottom:16px"></video>`;
  } else if (tpl.mediaUrl && tpl.type === 'audio') {
    html += `<audio src="${escHtml(tpl.mediaUrl)}" controls style="width:100%;margin-bottom:16px"></audio>`;
  }

  if (tpl.content) {
    html += `<div style="background:var(--bg-hover);border-radius:var(--radius-sm);padding:14px;font-size:14px;color:var(--text-1);white-space:pre-wrap;line-height:1.6">${escHtml(tpl.content)}</div>`;
  }

  html += `
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
      <span class="badge badge-${tpl.type}">${TYPE_ICONS[tpl.type]} ${TYPE_LABELS[tpl.type]}</span>
      <span class="badge ${tpl.active ? 'badge-active' : 'badge-inactive'}">${tpl.active ? '● Ativo' : '● Inativo'}</span>
      <span style="font-size:12px;color:var(--text-3);margin-left:auto">Criado: ${formatDate(tpl.createdAt)}</span>
    </div>`;

  document.getElementById('view-body').innerHTML = html;
  document.getElementById('view-backdrop').classList.remove('hidden');
}

function closeView() {
  document.getElementById('view-backdrop').classList.add('hidden');
}

function closeViewBackdrop(e) {
  if (e.target === document.getElementById('view-backdrop')) closeView();
}

document.addEventListener('DOMContentLoaded', async () => {
  try { await Store.init(); } catch { toast('Configure o Supabase em Configurações → Banco de Dados.', 'warning'); return; }
  renderGrid();
});
