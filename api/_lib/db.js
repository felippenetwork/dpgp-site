/* ================================================
   Helpers Supabase (REST/PostgREST) para as serverless functions
   Mesma URL/anon key hardcoded em js/config.js — mesmo projeto Supabase,
   leitura/escrita compartilhada com o site.
   ================================================ */

const SUPABASE_URL = 'https://lymlhjycpjstkcmumbka.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5bWxoanljcGpzdGtjbXVtYmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MzMyNTIsImV4cCI6MjA5NzIwOTI1Mn0.HxgcRhD5nlVYGxZNZmrMxfYCbQ0TXUB-YhvSBn8-poM';

async function rest(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' || method === 'PATCH' ? 'return=representation' : undefined,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(data?.message || `Supabase ${method} ${path} → HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── Config (jsonb data, id=1) ─────────────────────────────────────────────
async function getConfig() {
  const rows = await rest('/config?id=eq.1&select=data');
  return rows?.[0]?.data || {};
}

async function saveConfig(cfg) {
  await rest('/config', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: { id: 1, data: cfg, updated_at: new Date().toISOString() },
  });
}

// ── Templates ──────────────────────────────────────────────────────────────
function rowToTemplate(r) {
  let mediaUrls = [];
  try {
    const parsed = JSON.parse(r.media_url || '[]');
    mediaUrls = Array.isArray(parsed) ? parsed : (r.media_url ? [r.media_url] : []);
  } catch {
    mediaUrls = r.media_url ? [r.media_url] : [];
  }
  return {
    id: r.id, name: r.name || '', type: r.type || 'text',
    content: r.content || '', mediaUrls, mediaUrl: mediaUrls[0] || '',
    active: r.active !== false, order: r.order || 0,
  };
}

async function getActiveTemplates() {
  const rows = await rest('/templates?active=eq.true&order=created_at.asc&select=*');
  return (rows || []).map(rowToTemplate);
}

// ── Grupos ───────────────────────────────────────────────────────────────
function rowToGroup(r) {
  return { id: r.id, jid: r.jid, name: r.name || r.jid, active: r.active !== false };
}

async function getActiveGroups() {
  const rows = await rest('/groups?active=eq.true&order=added_at.asc&select=*');
  return (rows || []).map(rowToGroup);
}

async function updateGroup(id, data) {
  const updates = {};
  if (data.active !== undefined) updates.active = data.active;
  if (data.name !== undefined) updates.name = data.name;
  await rest(`/groups?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: updates });
}

// ── Histórico ────────────────────────────────────────────────────────────
async function addHistory(entry) {
  await rest('/history', {
    method: 'POST',
    body: {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      template_id: entry.templateId || '',
      template_type: entry.templateType || 'text',
      group_jid: entry.groupJid || '',
      group_name: entry.groupName || '',
      status: entry.status || 'success',
      sent_at: new Date().toISOString(),
    },
  });
}

module.exports = {
  getConfig, saveConfig,
  getActiveTemplates, getActiveGroups, updateGroup,
  addHistory,
};
