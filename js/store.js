/* ================================================
   DPGP — Camada de dados (localStorage)
   ================================================ */

const Store = {
  _ns: 'dpgp_',

  _get(key) {
    try { return JSON.parse(localStorage.getItem(this._ns + key)); } catch { return null; }
  },

  _set(key, val) {
    localStorage.setItem(this._ns + key, JSON.stringify(val));
  },

  // ── Templates (postagens) ──
  getTemplates() {
    return this._get('templates') || [];
  },

  saveTemplates(arr) {
    this._set('templates', arr);
  },

  addTemplate(tpl) {
    const list = this.getTemplates();
    const item = {
      id: Date.now().toString(),
      type: tpl.type || 'text',
      content: tpl.content || '',
      mediaUrl: tpl.mediaUrl || '',
      mediaName: tpl.mediaName || '',
      active: tpl.active !== undefined ? tpl.active : true,
      order: list.length + 1,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    this._set('templates', list);
    return item;
  },

  updateTemplate(id, data) {
    const list = this.getTemplates();
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    this._set('templates', list);
    return list[idx];
  },

  deleteTemplate(id) {
    const list = this.getTemplates().filter(t => t.id !== id);
    this._set('templates', list);
  },

  // ── Grupos ──
  getGroups() {
    return this._get('groups') || [];
  },

  addGroup(group) {
    const list = this.getGroups();
    if (list.find(g => g.jid === group.jid)) return null;
    const item = {
      id: Date.now().toString(),
      jid: group.jid,
      name: group.name || group.jid,
      active: true,
      addedAt: new Date().toISOString(),
    };
    list.push(item);
    this._set('groups', list);
    return item;
  },

  updateGroup(id, data) {
    const list = this.getGroups();
    const idx = list.findIndex(g => g.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data };
    this._set('groups', list);
    return list[idx];
  },

  deleteGroup(id) {
    const list = this.getGroups().filter(g => g.id !== id);
    this._set('groups', list);
  },

  // ── Configurações do bot ──
  getConfig() {
    return this._get('config') || {
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
    };
  },

  saveConfig(cfg) {
    this._set('config', cfg);
  },

  // ── Histórico de disparos ──
  getHistory() {
    return this._get('history') || [];
  },

  addHistory(entry) {
    const list = this.getHistory();
    list.unshift({
      id: Date.now().toString(),
      templateId: entry.templateId || '',
      templateType: entry.templateType || 'text',
      groupJid: entry.groupJid || '',
      groupName: entry.groupName || '',
      status: entry.status || 'success',
      sentAt: new Date().toISOString(),
    });
    if (list.length > 500) list.length = 500;
    this._set('history', list);
  },

  clearHistory() {
    this._set('history', []);
  },

  // ── Stats ──
  getStats() {
    const templates = this.getTemplates();
    const groups = this.getGroups();
    const history = this.getHistory();
    const today = new Date().toDateString();
    const dispatchesToday = history.filter(h => new Date(h.sentAt).toDateString() === today).length;

    return {
      totalTemplates: templates.length,
      activeTemplates: templates.filter(t => t.active).length,
      totalGroups: groups.length,
      activeGroups: groups.filter(g => g.active).length,
      dispatchesToday,
      totalDispatches: history.length,
    };
  },
};
