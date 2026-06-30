/* ================================================
   Motor de disparo — porta de DPGP-API/utils/scheduler.js + sender.js
   Processa UM grupo por chamada (tick), para caber no timeout de uma
   serverless function. O espaçamento entre grupos vem do delay
   configurado (sleep dentro do tick) e/ou da cadência do cron externo.
   ================================================ */

const db     = require('./db');
const uazapi = require('./uazapi');

const ZW_CHARS  = ['​', '‌', '‍'];
const MAX_SLEEP_MS = 50000; // headroom de segurança sob o maxDuration da function

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function embaralhar(arr) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function variarTexto(texto) {
  if (!texto || texto.length < 5) return texto;
  const quantidade = 1 + Math.floor(Math.random() * 2);
  const posicoes = new Set();
  while (posicoes.size < quantidade) {
    posicoes.add(1 + Math.floor(Math.random() * (texto.length - 1)));
  }
  const chars = texto.split('');
  [...posicoes].sort((a, b) => b - a).forEach(pos => {
    chars.splice(pos, 0, ZW_CHARS[Math.floor(Math.random() * ZW_CHARS.length)]);
  });
  return chars.join('');
}

function agoraSP(timezone = 'America/Sao_Paulo') {
  const agora = new Date();
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(agora);
  const get = (tipo) => parseInt(partes.find(p => p.type === tipo)?.value || '0');
  return {
    dataStr: `${get('year')}-${String(get('month')).padStart(2, '0')}-${String(get('day')).padStart(2, '0')}`,
    minAtual: get('hour') * 60 + get('minute'),
    timestamp: agora,
  };
}

function proximoTemplate(templates, filaIds) {
  const idsAtivos = new Set(templates.map(t => t.id));
  let fila = filaIds.filter(id => idsAtivos.has(id));
  if (fila.length === 0) fila = embaralhar([...idsAtivos]);
  const id = fila.shift();
  return { template: templates.find(t => t.id === id) || null, filaIds: fila };
}

function defaultDispatchState() {
  return { filaIds: [], postagensFeitasHoje: 0, ultimaDataReset: '', ultimoDisparo: null, emExecucao: null };
}

async function buildMentionsCsv(token, groupJid, content) {
  if (!content || !content.includes('{menção}')) return undefined;
  try {
    const { groups } = await uazapi.listGroups(token);
    const g = (groups || []).find(g => g.JID === groupJid);
    const phones = (g?.Participants || []).map(p => p.PhoneNumber).filter(Boolean);
    return phones.length ? phones.join(',') : undefined;
  } catch {
    return undefined;
  }
}

function digitacaoDelayMs(texto) {
  const comprimento = texto ? texto.length : 0;
  const base = Math.min(Math.max(comprimento * 40, 1500), 4000);
  return base + Math.floor(Math.random() * 1000);
}

async function enviarTemplate(token, template, group) {
  const jid = group.jid;
  const textoOriginal = (template.content || '').replace('{menção}', '');
  const texto = variarTexto(textoOriginal);
  const mentions = await buildMentionsCsv(token, jid, template.content);
  const delay = digitacaoDelayMs(textoOriginal);

  switch (template.type) {
    case 'text':
      await uazapi.sendText(token, jid, texto, { mentions, delay });
      break;

    case 'image': {
      const urls = Array.isArray(template.mediaUrls) && template.mediaUrls.length
        ? template.mediaUrls : (template.mediaUrl ? [template.mediaUrl] : []);
      if (!urls.length) throw new Error('mediaUrl não definida para imagem');
      for (let i = 0; i < urls.length; i++) {
        await uazapi.sendMedia(token, jid, 'image', urls[i], {
          text: i === 0 ? (texto || undefined) : undefined,
          mentions: i === 0 ? mentions : undefined,
          delay: i === 0 ? delay : undefined,
        });
        if (i < urls.length - 1) await sleep(1500);
      }
      break;
    }

    case 'video':
      if (!template.mediaUrl) throw new Error('mediaUrl não definida para vídeo');
      await uazapi.sendMedia(token, jid, 'video', template.mediaUrl, { text: texto || undefined, mentions, delay });
      break;

    case 'audio':
      if (!template.mediaUrl) throw new Error('mediaUrl não definida para áudio');
      await uazapi.sendMedia(token, jid, 'audio', template.mediaUrl, {});
      break;

    default:
      if (texto) await uazapi.sendText(token, jid, texto, { mentions, delay });
  }
}

// ── Tick principal ──────────────────────────────────────────────────────────
async function tick({ force = false } = {}) {
  const cfg = await db.getConfig();
  const instanceToken = cfg.uazapiInstanceToken;
  if (!instanceToken) return { skipped: 'instância não conectada' };
  if (!force && !cfg.ativo) return { skipped: 'automação desativada' };

  const groups    = await db.getActiveGroups();
  const templates = await db.getActiveTemplates();
  if (!groups.length || !templates.length) return { skipped: 'sem grupos/templates ativos' };

  const tz = cfg.timezone || 'America/Sao_Paulo';
  const { dataStr, minAtual, timestamp } = agoraSP(tz);

  const state = { ...defaultDispatchState(), ...(cfg.dispatchState || {}) };
  let postagensFeitasHoje = state.ultimaDataReset !== dataStr ? 0 : (state.postagensFeitasHoje || 0);

  // ── Ciclo em andamento: processa o próximo grupo da fila ──────────────────
  if (state.emExecucao) {
    const template = templates.find(t => t.id === state.emExecucao.templateId);
    const queue = state.emExecucao.groupsQueue || [];

    if (!template || !queue.length) {
      state.emExecucao = null;
      await db.saveConfig({ ...cfg, dispatchState: { ...state, ultimaDataReset: dataStr, postagensFeitasHoje } });
      return { skipped: 'ciclo cancelado (template removido ou fila vazia)' };
    }

    const [group, ...resto] = queue;
    const delaySec = Math.min(
      (cfg.delayMin || 30) + Math.random() * ((cfg.delayMax || 60) - (cfg.delayMin || 30)),
      MAX_SLEEP_MS / 1000
    );
    await sleep(delaySec * 1000);

    let status = 'success';
    try {
      await enviarTemplate(instanceToken, template, group);
    } catch (err) {
      status = 'failed';
      if (err.status === 403) {
        await db.updateGroup(group.id, { active: false }).catch(() => {});
      }
    }

    await db.addHistory({
      templateId: template.id, templateType: template.type,
      groupJid: group.jid, groupName: group.name, status,
    }).catch(() => {});

    const cicloFinalizado = resto.length === 0;
    const novoState = {
      ...state,
      filaIds: state.filaIds,
      emExecucao: cicloFinalizado ? null : { templateId: template.id, groupsQueue: resto },
      ultimaDataReset: dataStr,
      postagensFeitasHoje: cicloFinalizado ? postagensFeitasHoje + 1 : postagensFeitasHoje,
      ultimoDisparo: cicloFinalizado ? timestamp.toISOString() : state.ultimoDisparo,
    };
    await db.saveConfig({ ...cfg, dispatchState: novoState });
    return { sent: group.jid, status, remaining: resto.length };
  }

  // ── Nenhum ciclo em andamento: decide se inicia um novo ────────────────────
  if (!force) {
    const [hIni, mIni] = (cfg.horarioInicio || '08:00').split(':').map(Number);
    const [hFim, mFim] = (cfg.horarioFim || '21:00').split(':').map(Number);
    if (minAtual < (hIni * 60 + mIni) || minAtual > (hFim * 60 + mFim)) return { skipped: 'fora da janela horária' };
    if (postagensFeitasHoje >= (cfg.postagensPorDia || 12)) return { skipped: 'limite diário atingido' };
    if (state.ultimoDisparo) {
      const diffMs = timestamp - new Date(state.ultimoDisparo);
      const intervaloMs = ((cfg.intervaloHoras || 1) * 60 + (cfg.intervaloMinutos || 0)) * 60 * 1000;
      if (diffMs < intervaloMs) return { skipped: 'aguardando intervalo entre disparos' };
    }
  }

  const { template, filaIds } = proximoTemplate(templates, state.filaIds);
  if (!template) return { skipped: 'nenhum template disponível' };

  const groupsQueue = groups.map(g => ({ id: g.id, jid: g.jid, name: g.name }));
  const [firstGroup, ...resto] = groupsQueue;

  let status = 'success';
  try {
    await enviarTemplate(instanceToken, template, firstGroup);
  } catch (err) {
    status = 'failed';
    if (err.status === 403) {
      await db.updateGroup(firstGroup.id, { active: false }).catch(() => {});
    }
  }

  await db.addHistory({
    templateId: template.id, templateType: template.type,
    groupJid: firstGroup.jid, groupName: firstGroup.name, status,
  }).catch(() => {});

  const cicloFinalizado = resto.length === 0;
  const novoState = {
    filaIds,
    emExecucao: cicloFinalizado ? null : { templateId: template.id, groupsQueue: resto },
    ultimaDataReset: dataStr,
    postagensFeitasHoje: cicloFinalizado ? postagensFeitasHoje + 1 : postagensFeitasHoje,
    ultimoDisparo: cicloFinalizado ? timestamp.toISOString() : state.ultimoDisparo,
  };
  await db.saveConfig({ ...cfg, dispatchState: novoState });
  return { sent: firstGroup.jid, status, remaining: resto.length, novoCiclo: true };
}

module.exports = { tick };
