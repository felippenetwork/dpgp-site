# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DPGP — frontend for a WhatsApp group dispatch tool. Static HTML/CSS/JS site (no build step, no bundler — see exception below) deployed on Vercel. WhatsApp connectivity is handled entirely by **uazapi** (hosted WhatsApp API, same account/server used by the unrelated ERP-RIFAS project): instance create/connect/status/disconnect, group listing, sending, and incoming-message webhooks. There is no separate Node backend anymore — the old DPGP-API (`@whiskeysockets/baileys`/Express on BronxyHost) was fully retired; do not reintroduce it or `botApiUrl`.

### The `/api` folder — the one exception to "no backend"
`/api/*.js` are Vercel Serverless Functions (plain Node, CommonJS, using the global `fetch` — no npm dependencies, no `package.json`, no bundler) that act as the thin backend the uazapi admin token requires: the browser never talks to uazapi directly, only to these same-origin `/api/...` routes.
- `api/_lib/uazapi.js` — fetch wrapper for the uazapi REST API (instance lifecycle, send text/media, group list, webhook config).
- `api/_lib/db.js` — Supabase access via raw PostgREST `fetch` calls (no `@supabase/supabase-js`, to keep this dependency-free) — separate from the browser's `js/store.js`, which uses the Supabase JS SDK.
- `api/_lib/dispatchEngine.js` — the automatic dispatch scheduler (window/daily-limit/interval checks, template queue, anti-ban delay). Processes **one group per invocation** by design — a single call can't loop over many groups with 30-60s delays without risking the serverless function timeout.
- `api/uazapi/{connect,status,disconnect,groups}.js` — connection/QR and group-listing endpoints, called by `connections.js`/`groups.js`.
- `api/dispatch/trigger.js` — manual "disparar agora" (forces one tick, bypassing the schedule gating).
- `api/cron/dispatch-tick.js` — the scheduler's tick, requires `?secret=` matching `CRON_SECRET`. **Not triggered by Vercel's native Cron** (the project is on the Hobby plan, which only allows daily native crons) — an external cron (e.g. cron-job.org) hits this endpoint once a minute instead.
- `api/webhook/uazapi.js` — receives uazapi webhook events; implements the "Mensagem de Ausência" auto-reply to private messages.

Required Vercel env vars (not committed): `UAZAPI_URL`, `UAZAPI_ADMIN_TOKEN`, `CRON_SECRET`.

## Commands

There is no build/lint/test tooling for the static pages — they're served as-is. The `/api` functions need no build either (no dependencies to install).

- **Local preview**: open the HTML files directly, or `vercel dev` to also exercise the `/api` functions locally.
- **Deploy**: `git push` to `main` — Vercel auto-deploys (see `vercel.json` for rewrites/headers/function `maxDuration`; no build command configured).

## Architecture

### Page structure
Every page is a standalone HTML file (`dashboard.html`, `connections.html`, `templates.html`, `groups.html`, `settings.html`, `history.html`, plus `index.html` for login) that loads the same script chain in order:
```
supabase-js (CDN) → js/config.js → js/store.js → js/app.js → js/<page>.js
```
`js/app.js` injects the shared sidebar into `#sidebar-placeholder` and exposes cross-page utilities (`Auth`, `toast()`, date formatters, `TYPE_LABELS`/`TYPE_ICONS`). Every page script calls `Auth.requireAuth()` at the top and, in its `DOMContentLoaded` handler, **must `await Store.init()` before reading any `Store.get*()`** — pages that skip this race against the Supabase fetch and silently read empty cache (this exact bug has recurred — see `connections.js`).

### Data layer (`js/store.js`)
Supabase is the single source of truth, shared by all browsers/users (no per-browser config, no localStorage for app data — only `dpgp_session` uses localStorage, via `Auth`). `Store` is an IIFE singleton with an **in-memory cache pattern**:
- `Store.init()` fetches templates, groups, config, and history from Supabase in parallel and populates `_cache`.
- All `Store.get*()` reads are synchronous, served from `_cache`.
- All mutations (`addTemplate`, `updateTemplate`, `deleteTemplate`, `addGroup`, `updateGroup`, `deleteGroup`, `saveConfig`, `addHistory`, `clearHistory`) are `async`, write to Supabase first, then update `_cache` to match.
- DB rows use snake_case, JS objects use camelCase — conversion happens via `rowToX`/`xToRow` helper pairs in `store.js`.
- `media_url` (templates) stores a **JSON-stringified array** of URLs to support multiple images/videos per template, with fallback parsing for legacy plain-URL strings. `mediaUrls[0]` is mirrored into `mediaUrl` for back-compat with code paths expecting a single URL.
- `Store.uploadFile()` / `Store.deleteFile()` upload directly to a public Supabase Storage bucket named `uploads` from the browser (no backend involved).

Credentials (Supabase URL/anon key, default admin login) are hardcoded in `js/config.js` by design — this app intentionally has no per-deployment env config, so every browser/user shares one Supabase project without setup. The same Supabase URL/anon key is duplicated (hardcoded) in `api/_lib/db.js` since serverless functions can't import a browser-global `CONFIG` object.

### Bot integration boundary
**`config.data` (the same jsonb blob `Store.getConfig()/saveConfig()` read/write) is shared mutable state between the browser and the `/api` functions** — it holds both user-editable settings (automation window, delays, "ausência" messages) *and* server-managed internal state: `uazapiInstanceId`/`uazapiInstanceToken` (the connected instance's credentials), `dispatchState` (scheduler queue/counters), `ausenciaCooldown` (per-contact auto-reply cooldown). Any code that calls `Store.saveConfig()` from a page **must spread the existing `Store.getConfig()` first** rather than building a fresh object — overwriting the whole blob silently disconnects the bot and resets the scheduler (`js/settings.js`'s `saveAll()`/`resetDefaults()` already do this; keep that pattern for any new config-writing code).

The browser never holds a uazapi token — `js/connections.js`, `js/groups.js`, and `js/settings.js`'s `triggerDispatch()` only call same-origin `/api/uazapi/*` and `/api/dispatch/trigger`, which look up the instance token server-side.

### Auth
Trivial and intentional: `CONFIG.adminUser`/`CONFIG.adminPassword` checked client-side in `index.html`, session marked via `localStorage['dpgp_session'] = 'ok'`, checked by `Auth.requireAuth()`/`Auth.isLogged()` in `js/app.js`. Not meant to resist a determined attacker — it's a shared-team gate, not per-user accounts.
