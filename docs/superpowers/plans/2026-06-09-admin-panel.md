# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DB-backed admin panel: edit every site text, reorder/toggle sections (effective next visit via SSR), cookie-less analytics dashboard, panel account management.

**Architecture:** Astro 6 SSR (Node adapter, middleware mode) mounted in the existing Express app; content flows through a versioned in-memory cache. Panel is a vanilla SPA at `/admin` served by Express; all data APIs behind DB-backed sessions. New Postgres tables for content, ordering, users, sessions, analytics.

**Tech Stack:** Express 5, @astrojs/node, bcryptjs, geoip-lite, pg, vitest+supertest.

---

### Task 1: Dependencies + schema + defaults

**Files:** `package.json`, `db/migrate.js`, `server/lib/defaults.js` (create)

- [ ] `npm i bcryptjs geoip-lite @astrojs/node`
- [ ] `server/lib/defaults.js`: exports `DEFAULT_CONTENT` (object `{section: {field: value}}` with ALL current hardcoded texts: meta.title/description, og.description, hero.greeting/name/description, skills.title + skills.groups list, projects.title/error, timeline.title + timeline.items list (move from src/content/timeline.json), achievements.title + achievements.items, contact.title + labels (name/email/message) + button + success/error texts, footer.copyright/session) and `DEFAULT_ORDER` = `['about','skills','projects','timeline','achievements','contact']`
- [ ] `db/migrate.js`: add tables per spec (site_content, section_order, admin_users, admin_sessions, analytics_pageviews, analytics_section_views) + seed content/order from defaults with `ON CONFLICT DO NOTHING`
- [ ] Commit

### Task 2: Content service + public endpoint

**Files:** `server/lib/content.js` (create), `server/routes/content.js` (create), wire in `server/app.js`

- [ ] `content.js`: `createContentService(db)` →
  - `get()`: cached `{version, order, content}`; loads site_content + section_order, deep-merges over `DEFAULT_CONTENT` (DB wins; defaults guarantee completeness)
  - `saveSection(sectionKey, fields, username)`: validates section/field keys exist in `DEFAULT_CONTENT`, type-checks (string fields stay strings, list fields must match item shape), upserts in a transaction, `version++`, cache invalidated
  - `saveOrder(orderRows)`: validates exactly the known section set, upserts, bump
  - on DB error in `get()`: return defaults (site never blank)
- [ ] `routes/content.js`: `GET /api/content` → service.get() (public, cacheable 10 s)
- [ ] Tests: GET shape; saveSection rejects unknown keys/bad list shape; version bumps after save
- [ ] Commit

### Task 3: Session auth

**Files:** `server/lib/authService.js` (create), `server/middleware/session.js` (create), `server/routes/adminAuth.js` (create), `scripts/admin-create.js` (create), `package.json` (script `admin:create`)

- [ ] `authService.js`: `createAuthService(db)`:

```js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

async function login(username, password, ip) {
  const { rows } = await db.query('SELECT * FROM admin_users WHERE username = $1', [username]);
  const user = rows[0];
  // Always burn a bcrypt compare so missing users cost the same time.
  const hash = user?.password_hash ?? '$2b$11$invalidsaltinvalidsaltinvalidsaltinv';
  const ok = await bcrypt.compare(password, hash);
  if (!user || user.disabled) return null;
  if (user.locked_until && new Date(user.locked_until) > new Date()) return { locked: true };
  if (!ok) {
    const fails = user.failed_attempts + 1;
    await db.query(
      'UPDATE admin_users SET failed_attempts = $1, locked_until = $2 WHERE id = $3',
      [fails, fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS) : null, user.id]
    );
    return null;
  }
  await db.query(
    'UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login = now() WHERE id = $1',
    [user.id]
  );
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db.query(
    'INSERT INTO admin_sessions (user_id, token_hash, expires_at, ip) VALUES ($1, $2, $3, $4)',
    [user.id, tokenHash, new Date(Date.now() + SESSION_TTL_MS), ip]
  );
  return { token, user: { id: user.id, username: user.username } };
}
```

  plus `validateSession(token)` (hash lookup, expiry check, sliding refresh when < 12 h left, returns user), `logout(token)`, `createUser`, `setPassword`, `setDisabled`, `listUsers`.
- [ ] `middleware/session.js`: `requireSession(authService)` — parses `sid` from Cookie header (manual split, no dep), 401 JSON when absent/invalid; attaches `req.adminUser`. Mutating methods (non-GET) also require `Origin` header absent-or-same-host, else 403.
- [ ] `routes/adminAuth.js`: `POST /api/admin/login` (rate-limited 5/min via new limiter) sets cookie `sid=...; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400` + `Secure` in prod; `POST /api/admin/logout`; `GET /api/admin/me`.
- [ ] `scripts/admin-create.js`: argv username, password via stdin prompt (readline, muted echo), bcrypt-hash, INSERT.
- [ ] Tests: login ok sets HttpOnly cookie; bad pass 401; 5 fails → locked (even with right pass); disabled user 401; session validates then expires (inject clock via expired row); logout invalidates; non-GET with foreign Origin → 403; /api/admin/me 401 without cookie.
- [ ] Commit

### Task 4: Admin APIs — content, sections, users, contacts

**Files:** `server/routes/adminPanel.js` (create), modify `server/routes/admin.js` (drop basicAuth → requireSession), `server/middleware/adminAuth.js` deleted, `server/app.js` wiring

- [ ] `adminPanel.js` (all behind requireSession):
  - `GET /api/admin/content` → full `{version, order, content}` (same service)
  - `PUT /api/admin/content/:section` body `{fields}` → saveSection
  - `PUT /api/admin/sections` body `{order: [{section_key, position, enabled}]}` → saveOrder
  - `GET /api/admin/users` / `POST /api/admin/users {username,password}` / `PATCH /api/admin/users/:id {disabled?|password?}`; PATCH guards: cannot disable own account
  - existing contacts routes move here (JSON + CSV, keep csvCell escaping)
- [ ] Remove `server/middleware/adminAuth.js` + Basic Auth tests; adapt CSV/contacts tests to session cookie
- [ ] Tests: content PUT bumps version visible in GET /api/content; sections reorder reflected; users CRUD; self-disable 400; all endpoints 401 without session
- [ ] Commit

### Task 5: Analytics — beacons + queries

**Files:** `server/lib/analytics.js` (create), `server/routes/track.js` (create), `server/routes/adminAnalytics.js` (create), `server/app.js`

- [ ] `analytics.js`: `createAnalytics(db, geo = require('geoip-lite'))`:
  - `visitorHash(ip, ua)`: sha256(`${utcDay}|${ip}|${ua}`) hex — deterministic per day
  - `recordPageview({ip, ua, referrer, lang, viewportW})` → INSERT returning id; country/region from `geo.lookup(ip)`; device/browser/os from built-in UA parser (regex: mobile/tablet/desktop; edge→chrome order for browser detection: edg, opr, firefox, chrome, safari; os: windows/android/ios/mac/linux)
  - `recordSections(pageviewId, sections, scroll)` — caps: ≤ 20 sections, key ≤ 32 chars matching `/^[a-z-]+$/`, ms 0..3600000, scroll 0..100
  - `summary/timeseries/topDimension/sectionStats` query helpers (date-ranged, parameterized; dimension column whitelist `['country','referrer_host','device','browser','os','lang']`)
  - `purgeOld()` → delete rows older than 90 days
- [ ] `routes/track.js` (public, rate-limited 30/min):
  - `POST /api/t/pv` body `{lang?, vw?, ref?}` → 200 `{id}`
  - `POST /api/t/sv` body `{id, sections:[{k, ms}], scroll}` → always 204 (errors logged only)
- [ ] `routes/adminAnalytics.js` (requireSession): `GET /api/admin/analytics/summary|timeseries|top?dim=...|sections` with `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default last 30 days; dim validated against whitelist)
- [ ] Tests: pv → id, hash deterministic same day, sv validation rejects 21 sections / bad key, summary shapes, dim whitelist rejects `password_hash`
- [ ] Commit

### Task 6: SSR conversion

**Files:** `astro.config.mjs`, `src/pages/index.astro`, all `src/components/*.astro`, `src/layouts/Base.astro`, `src/lib/content.ts` (create), `server/app.js`, `server/index.js`, `Dockerfile`, delete `src/content/timeline.json`

- [ ] `astro.config.mjs`: `output: 'server'`, `adapter: node({ mode: 'middleware' })`
- [ ] `src/lib/content.ts`: `getSiteData(Astro)` → `Astro.locals.siteData ?? fetch('http://localhost:3000/api/content')` (dev fallback) — returns `{order, content}`
- [ ] Components take their section's content via props (`<Hero c={content.hero} />`); index.astro maps `order` (enabled only) over a component registry; Header nav built from same order
- [ ] Express: `app.js` accepts `ssrHandler` dep; mounts AFTER static/`/api`: `app.use((req,res,next) => ssrHandler(req,res,next,{ siteData }))` where siteData comes from content service per request (cached). `index.js`: `const { handler } = await import('../dist/server/entry.mjs')` at boot (wrap bootstrap in async main()); tests inject a stub ssrHandler.
- [ ] Static serving updated: Astro emits `dist/client/` (serve that + `_astro` from it); `dist/server/` is the SSR bundle
- [ ] Dockerfile: copy `dist` (both client+server) — already copies dist; ensure `node_modules` prod deps include astro adapter runtime (it's bundled in entry.mjs — no extra dep needed at runtime beyond what adapter bundles)
- [ ] Tracking script `src/scripts/track.js`: pv on load (fetch keepalive), IntersectionObserver accumulates per-section visible ms, max scroll %, sendBeacon sv on `pagehide`
- [ ] `npm run build` + smoke: server renders home with DB-less fallback defaults
- [ ] Commit

### Task 7: Panel SPA

**Files:** `server/admin-ui/index.html`, `server/admin-ui/admin.css`, `server/admin-ui/admin.js`, `server/app.js` (serve `/admin`)

- [ ] Express: `app.use('/admin', express.static(path.join(__dirname, 'admin-ui')))` (shell public; data behind APIs)
- [ ] SPA (vanilla, hash routing `#/dashboard #/content #/sections #/contacts #/accounts`):
  - login view → POST login → views unlock
  - dashboard: date range picker (from/to), stat cards (views/uniques/avg time), bar lists (sections, countries, referrers, devices, browsers, os, langs), daily line (SVG), hour histogram
  - content: section selector → field editors (input for text, textarea for long, structured list editor with add/remove/up/down for list fields) → save per section
  - sections: rows with ↑ ↓ buttons + enabled checkbox → save order
  - contacts: table of messages + CSV download link
  - accounts: list users, create form, disable toggle, reset password
  - all rendering via textContent/createElement (no innerHTML with data), terminal aesthetic (reuse palette variables)
- [ ] Commit

### Task 8: Final verify + docs

- [ ] `npm test` green, `npm run build` green, `npm audit` clean
- [ ] README: panel section (setup `admin:create`, what it controls), .env.example unchanged check (ADMIN_USER/PASS env removed — note breaking change)
- [ ] Boot-time `purgeOld()` wired in `server/index.js`
- [ ] Code review (cavecrew-reviewer), fix findings, commit
