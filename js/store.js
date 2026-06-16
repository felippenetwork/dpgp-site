/* ================================================
   DPGP — Camada de dados (Supabase)
   ================================================ */

const Store = (() => {
  let _db  = null;
  let _cache = { templates: [], groups: [], config: {}, history: [] };

  function getDB() {
    if (_db) return _db;
    const url = CONFIG.supabaseUrl;
    const key = CONFIG.supabaseKey;
    if (!url || !key) throw new Error('Supabase não configurado em config.js');
    _db = window.supabase.createClient(url, key);
    return _db;
  }

  function isConfigured() {
    return !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);
  }

  // ── Mapeamento DB (snake_case) ↔ JS (camelCase) ───────────────────────────
  function rowToTemplate(r) {
    // media_url pode ser JSON array ou URL simples (retrocompatibilidade)
    let mediaUrls = [];
    try {
      const parsed = JSON.parse(r.media_url || '[]');
      mediaUrls = Array.isArray(parsed) ? parsed : (r.media_url ? [r.media_url] : []);
    } catch {
      mediaUrls = r.media_url ? [r.media_url] : [];
    }
    return {
      id: r.id, name: r.name || '', type: r.type || 'text',
      content: r.content || '', mediaUrls,
      mediaUrl: mediaUrls[0] || '',
      active: r.active !== false, order: r.order || 0,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
  function templateToRow(t) {
    const urls = Array.isArray(t.mediaUrls) && t.mediaUrls.length ? t.mediaUrls : (t.mediaUrl ? [t.mediaUrl] : []);
    return {
      id: t.id, name: t.name || '', type: t.type || 'text',
      content: t.content || '', media_url: urls.length ? JSON.stringify(urls) : '',
      active: t.active !== false, order: t.order || 0,
    };
  }
  function rowToGroup(r) {
    return { id: r.id, jid: r.jid, name: r.name || r.jid, active: r.active !== false, addedAt: r.added_at };
  }
  function groupToRow(g) {
    return { id: g.id, jid: g.jid, name: g.name, active: g.active !== false };
  }
  function rowToHistory(r) {
    return {
      id: r.id, templateId: r.template_id || '', templateType: r.template_type || 'text',
      groupJid: r.group_jid || '', groupName: r.group_name || '',
      status: r.status || 'success', sentAt: r.sent_at,
    };
  }

  // ── Init: carrega tudo do Supabase na memória ──────────────────────────────
  async function init() {
    const db = getDB();
    const [t, g, c, h] = await Promise.all([
      db.from('templates').select('*').order('created_at', { ascending: true }),
      db.from('groups').select('*').order('added_at', { ascending: true }),
      db.from('config').select('data').eq('id', 1).single(),
      db.from('history').select('*').order('sent_at', { ascending: false }).limit(500),
    ]);
    _cache.templates = (t.data || []).map(rowToTemplate);
    _cache.groups    = (g.data || []).map(rowToGroup);
    _cache.config    = c.data?.data || {};
    _cache.history   = (h.data || []).map(rowToHistory);
  }

  return {
    isConfigured,
    init,

    // ── Templates ────────────────────────────────────────────────────────────
    getTemplates() { return _cache.templates; },

    async addTemplate(tpl) {
      const mediaUrls = Array.isArray(tpl.mediaUrls) ? tpl.mediaUrls : (tpl.mediaUrl ? [tpl.mediaUrl] : []);
      const item = {
        id: Date.now().toString(), name: tpl.name || '', type: tpl.type || 'text',
        content: tpl.content || '', mediaUrls, mediaUrl: mediaUrls[0] || '',
        active: tpl.active !== undefined ? tpl.active : true,
        order: _cache.templates.length + 1, createdAt: new Date().toISOString(),
      };
      const { error } = await getDB().from('templates').insert([templateToRow(item)]);
      if (error) throw error;
      _cache.templates.push(item);
      return item;
    },

    async updateTemplate(id, data) {
      const idx = _cache.templates.findIndex(t => t.id === id);
      if (idx === -1) return null;
      const updated = { ..._cache.templates[idx], ...data, updatedAt: new Date().toISOString() };
      const { error } = await getDB().from('templates').update(templateToRow(updated)).eq('id', id);
      if (error) throw error;
      _cache.templates[idx] = updated;
      return updated;
    },

    async deleteTemplate(id) {
      const { error } = await getDB().from('templates').delete().eq('id', id);
      if (error) throw error;
      _cache.templates = _cache.templates.filter(t => t.id !== id);
    },

    // ── Grupos ───────────────────────────────────────────────────────────────
    getGroups() { return _cache.groups; },

    async addGroup(group) {
      if (_cache.groups.find(g => g.jid === group.jid)) return null;
      const item = {
        id: Date.now().toString(), jid: group.jid,
        name: group.name || group.jid, active: true, addedAt: new Date().toISOString(),
      };
      const { error } = await getDB().from('groups').insert([groupToRow(item)]);
      if (error) throw error;
      _cache.groups.push(item);
      return item;
    },

    async updateGroup(id, data) {
      const idx = _cache.groups.findIndex(g => g.id === id);
      if (idx === -1) return null;
      const updated = { ..._cache.groups[idx], ...data };
      const { error } = await getDB().from('groups').update(groupToRow(updated)).eq('id', id);
      if (error) throw error;
      _cache.groups[idx] = updated;
      return updated;
    },

    async deleteGroup(id) {
      const { error } = await getDB().from('groups').delete().eq('id', id);
      if (error) throw error;
      _cache.groups = _cache.groups.filter(g => g.id !== id);
    },

    // ── Config ───────────────────────────────────────────────────────────────
    getConfig() { return _cache.config; },

    async saveConfig(cfg) {
      _cache.config = cfg;
      const { error } = await getDB().from('config')
        .upsert({ id: 1, data: cfg, updated_at: new Date().toISOString() });
      if (error) throw error;
    },

    // ── Histórico ────────────────────────────────────────────────────────────
    getHistory() { return _cache.history; },

    async addHistory(entry) {
      const item = {
        id: Date.now().toString(), templateId: entry.templateId || '',
        templateType: entry.templateType || 'text', groupJid: entry.groupJid || '',
        groupName: entry.groupName || '', status: entry.status || 'success',
        sentAt: new Date().toISOString(),
      };
      const { error } = await getDB().from('history').insert([{
        id: item.id, template_id: item.templateId, template_type: item.templateType,
        group_jid: item.groupJid, group_name: item.groupName,
        status: item.status, sent_at: item.sentAt,
      }]);
      if (error) throw error;
      _cache.history.unshift(item);
      if (_cache.history.length > 500) _cache.history.length = 500;
    },

    async clearHistory() {
      const { error } = await getDB().from('history').delete().gte('id', '');
      if (error) throw error;
      _cache.history = [];
    },

    // ── Storage de arquivos (Supabase Storage) ───────────────────────────────
    async uploadFile(file) {
      const db  = getDB();
      const ext = file.name.split('.').pop().toLowerCase();
      const name = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await db.storage.from('uploads').upload(name, file, {
        cacheControl: '3600', upsert: false,
      });
      if (error) throw error;
      const { data: urlData } = db.storage.from('uploads').getPublicUrl(data.path);
      return urlData.publicUrl;
    },

    async deleteFile(url) {
      if (!url || !url.includes('/uploads/')) return;
      const db   = getDB();
      const path = url.split('/uploads/').pop().split('?')[0];
      await db.storage.from('uploads').remove([path]);
    },

    // ── Stats ────────────────────────────────────────────────────────────────
    getStats() {
      const today = new Date().toDateString();
      return {
        totalTemplates:   _cache.templates.length,
        activeTemplates:  _cache.templates.filter(t => t.active).length,
        totalGroups:      _cache.groups.length,
        activeGroups:     _cache.groups.filter(g => g.active).length,
        dispatchesToday:  _cache.history.filter(h => new Date(h.sentAt).toDateString() === today).length,
        totalDispatches:  _cache.history.length,
      };
    },
  };
})();
