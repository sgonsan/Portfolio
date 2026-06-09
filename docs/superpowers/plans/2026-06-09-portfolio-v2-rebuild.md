# Portfolio v2 Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the portfolio from scratch eliminating all known vulnerabilities and refreshing UI/UX, keeping only the color palette and personal photo.

**Architecture:** Astro 5 static frontend served by an Express 5 API server (single Node deployment). `createApp({ db, mailer, github })` factory enables dependency-injected tests with vitest + supertest. Postgres for contacts/scores/stats.

**Tech Stack:** Node 22, Express 5, helmet, express-rate-limit, pg, nodemailer, Astro 5, vitest, supertest.

---

### Task 1: Wipe old code, scaffold v2 skeleton

**Files:**
- Delete: `server.js`, `routes/`, `controllers/`, `src/` (old), `json/`, `public/assets/fonts/Bitcount/`
- Create: `server/` tree, new `package.json`

- [ ] `git rm -r server.js routes controllers json src` (keep `db/`, `public/`, configs)
- [ ] Delete Bitcount fonts (unused)
- [ ] New `package.json`: deps `express@^5 helmet express-rate-limit pg nodemailer compression dotenv`; dev `astro@^5 vitest supertest concurrently nodemon`; scripts `start/dev/build/test/migrate`
- [ ] `npm install`; commit scaffold

### Task 2: Backend lib layer (`server/lib/`)

**Files:** `server/lib/db.js`, `server/lib/github.js`, `server/lib/mailer.js`, `server/lib/sanitize.js`

- [ ] `db.js`: pg Pool, strict TLS by default:

```js
// TLS always verifies. Self-signed servers: provide the CA, never disable verification.
const ssl = process.env.DATABASE_SSL === 'true'
  ? (process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT } : true)
  : false;
```

- [ ] `github.js`: `createGithubClient(token)` with in-memory TTL cache; `zen()` (10 min), `repos(names)` (30 min), `lastCommit()` (30 min); 5 s timeout via `AbortSignal.timeout`
- [ ] `mailer.js`: `createMailer(env)` returns `{ sendContactMail, sendAutoReply }`; strips `[\r\n]` from all header-bound values; replyTo = bare email only
- [ ] `sanitize.js`: `stripCrlf`, `csvCell` (quote + prefix `'` when cell starts with `=+-@\t\r`)

### Task 3: Middleware (`server/middleware/`)

**Files:** `server/middleware/errors.js`, `server/middleware/adminAuth.js`, `server/middleware/limits.js`

- [ ] `errors.js`: `asyncWrap(fn)`, `notFound` (404 JSON for `/api/*`), `errorHandler` (logs, returns `{error:'Internal server error'}`, no stack)
- [ ] `adminAuth.js` — timing-safe, first-colon split, refuses when env unset:

```js
const crypto = require('crypto');
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
module.exports = function adminAuth(req, res, next) {
  const { ADMIN_USER, ADMIN_PASS } = process.env;
  if (!ADMIN_USER || !ADMIN_PASS) return res.status(503).json({ error: 'Admin disabled' });
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return res.set('WWW-Authenticate', 'Basic realm="admin"').status(401).json({ error: 'Auth required' });
  }
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  const user = decoded.slice(0, idx < 0 ? decoded.length : idx);
  const pass = idx < 0 ? '' : decoded.slice(idx + 1);
  const ok = safeEqual(user, ADMIN_USER) & safeEqual(pass, ADMIN_PASS);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  next();
};
```

- [ ] `limits.js`: factories — `apiLimiter` 120/min, `contactLimiter` 1/min, `scoresWriteLimiter` 5/min, `adminLimiter` 10/min; `standardHeaders: true, legacyHeaders: false`

### Task 4: Routes + app factory

**Files:** `server/routes/{contact,scores,stats,zen,data,projects,admin}.js`, `server/app.js`, `server/index.js`

- [ ] Validation inline per route (no extra dep): contact `{name<=200, email regex + <=320, message<=5000, honeypot}`; scores `player /^[A-Za-z0-9_-]{1,16}$/`, score int 0..1e8
- [ ] `app.js`: helmet (CSP `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'`, HSTS prod-only), `express.json({limit:'32kb'})`, `trust proxy` from `TRUST_PROXY_HOPS`, static serving (hashed `_astro` 1y immutable), routes, healthz, notFound, errorHandler
- [ ] `index.js`: load dotenv, build real deps, listen on `PORT` (8080 prod / 3000 dev)

### Task 5: Tests

**Files:** `tests/api.test.js` (split if >300 lines)

- [ ] vitest + supertest against `createApp` with fake db/mailer/github
- [ ] Cases: contact happy path; honeypot 400; CRLF in name stripped from mail subject; oversized fields 400; scores invalid player 400 (`<img>` payload rejected); scores happy path; admin 503 without env; admin 401/403/200; password containing `:` works; CSV formula cell escaped; zen/stats/data shapes; 404 JSON; healthz 200
- [ ] `npm test` green; commit

### Task 6: DB migrate

**Files:** `db/migrate.js`, `db/index.js` removed (superseded by `server/lib/db.js`)

- [ ] Idempotent `CREATE TABLE IF NOT EXISTS contacts/scores/stats`; seed stats row id=1

### Task 7: Frontend rebuild (use frontend-design skill)

**Files:** `astro.config.mjs`, `src/layouts/Base.astro`, `src/components/{Header,Hero,Skills,Projects,Timeline,Achievements,Contact,Footer,Terminal}.astro`, `src/styles/{global,sections}.css`, `src/scripts/*.js`, `public/theme-init.js`, `src/content/timeline/items.json`, `src/content.config.ts`

- [ ] Keep palette variables VERBATIM from old `global.css` `:root` and `[data-theme="light"]`; keep `personal-foto.jpg` in hero
- [ ] `public/theme-init.js` external pre-paint theme script (CSP `script-src 'self'` compatible — no inline scripts anywhere)
- [ ] Header: sticky, nav links (about/skills/projects/timeline/achievements/contact), scroll-spy via IntersectionObserver, accessible disclosure menu on mobile, theme toggle
- [ ] Hero: photo + `$ whoami` greeting + name with blinking cursor + zen quote (aria-live polite)
- [ ] Skills: three groups (languages/tools/practices) as bordered list grid
- [ ] Projects: fetched from `/api/projects`, skeletons, safe DOM building only (`textContent`), language color dot, stars, relative time
- [ ] Timeline: content collection rendered at build
- [ ] Contact: inline validation + counter + aria-live status; posts JSON
- [ ] Terminal: lazy module, `Ctrl+\`` or footer link; virtual FS object in JS; commands help/ls/cd/cat/whoami/zen/stats/top/game/theme/clear/exit; snake game posts score; ALL rendering `textContent`
- [ ] Skip link, landmarks, reduced-motion, focus-visible
- [ ] `npm run build` green; commit

### Task 8: Deployment + docs

**Files:** `Dockerfile`, `.dockerignore`, `.env.example`, `README.md`

- [ ] Dockerfile: node:22-alpine, `npm ci`, non-root `USER node`, HEALTHCHECK `/healthz`
- [ ] README: structure, env vars, security notes
- [ ] Final: `npm test` + `npm run build` green; request code review; merge to main
