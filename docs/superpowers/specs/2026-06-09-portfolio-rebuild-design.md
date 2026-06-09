# Portfolio v2 — Full Rebuild Design

Date: 2026-06-09
Constraint from user: rebuild everything from scratch; keep ONLY the color scheme and the personal photo. Eliminate all vulnerabilities, improve UI/UX. All other decisions delegated.

## Goals

1. Zero known vulnerabilities in the new codebase.
2. Same visual identity (brutalist terminal, purple accent palette, dark default) but better UI/UX.
3. Testable backend with automated tests.

## Vulnerabilities in the old codebase (all must be absent in v2)

| # | Issue | Fix in v2 |
|---|-------|-----------|
| 1 | Stored XSS: terminal renders `/api/scores` player names (unauthenticated POST) via `innerHTML` | All dynamic rendering uses `textContent` / `createElement`; player names restricted to `[A-Za-z0-9_-]{1,16}` server-side |
| 2 | No security headers | `helmet` with strict CSP (`script-src 'self'`), HSTS in prod, frame-ancestors none |
| 3 | Admin basic auth: non-constant-time compare, breaks on `:` in password | `crypto.timingSafeEqual` over SHA-256 digests, split on first `:` only, rate-limited |
| 4 | CSV formula injection in contacts export | Prefix `=+-@\t\r` cells with `'` |
| 5 | Email header injection via name in subject/replyTo | Strip `[\r\n]`, replyTo uses bare email only |
| 6 | Spoofable `x-forwarded-for`, no `trust proxy` | `app.set('trust proxy', N)` from env `TRUST_PROXY_HOPS` |
| 7 | Undeclared `body-parser` dependency | `express.json({ limit })` built-in |
| 8 | Postgres `rejectUnauthorized: false` | Strict TLS by default; opt-out only via explicit env |
| 9 | Unthrottled scores POST | Rate limits on every mutating endpoint + global API limiter |
| 10 | Outdated Express 4.18 | Express 5 (latest), latest helmet/express-rate-limit/pg/nodemailer |
| 11 | No global error/404 handlers; sync route crashes | Central async wrapper + error middleware, no stack leak |
| 12 | `/api/fs` discloses real filesystem listing | Endpoint removed; terminal uses a curated virtual filesystem shipped in the bundle |

## Architecture

Same proven stack, rebuilt: **Astro 5 static frontend + Express 5 API + Postgres**, single Node deployment (Docker).

```
server/
  index.js          # bootstrap (env, listen)
  app.js            # createApp({ db, mailer, github }) factory — DI for tests
  middleware/        # auth (admin), rateLimits, errors, validate
  routes/            # contact, scores, stats, zen, data, admin
  lib/               # db pool, mailer, github client (zen + repo data), validation helpers
db/migrate.js        # idempotent schema: contacts, scores, stats
src/                 # Astro: layouts/, components/, styles/, scripts/, content/
public/assets/       # photo (kept), fonts (only IntelOneMono + Poppins), icons
tests/               # vitest + supertest, db/mailer/github injected as fakes
```

API surface (reduced from 8 routes to 6):
- `POST /api/contact` — validation, honeypot, MX check, DB log, mail. 1/min/IP.
- `GET/POST /api/scores` — leaderboard. POST 5/min/IP, name `[A-Za-z0-9_-]{1,16}`, score integer 0–1e8.
- `GET /api/stats` — visits + last commit (GitHub, cached 30 min).
- `GET /api/zen` — GitHub zen quote, cached 10 min.
- `GET /api/data` — combined stats+zen for initial page load.
- `GET /api/admin/contacts(.csv)` — hardened basic auth.
- Removed: `/api/fs` (virtual FS in frontend), `/api/projects` stays (GitHub repo cards, cached 30 min).

## UI/UX (keep: color palette variables verbatim, personal photo; everything else new)

- Brutalist terminal aesthetic retained and refined: mono headings with `> section/` markers, 1px borders, no radius.
- Sticky header with section nav + active-section highlight (IntersectionObserver), accessible mobile menu.
- Hero: photo, `$ whoami`-style intro, blinking cursor, zen quote slot.
- Skills: grouped grid (languages / tools / practices) with terminal-style markers.
- Projects: cards from API, loading skeletons, language dot, stars, relative "updated" time, direct links.
- Timeline: Astro content collection, rendered at build time.
- Contact: inline validation, char counter, aria-live status messages, honeypot.
- Terminal easter egg: opened via footer link or `Ctrl+\``; commands `help, ls, cd, cat, whoami, zen, stats, top, game, theme, clear, exit`; snake-style game writes to leaderboard; ALL output rendered safely.
- Theme: dark default, light toggle, respects `prefers-color-scheme`, pre-paint init via tiny external script (CSP-compatible, no inline JS).
- A11y: skip link, landmarks, focus-visible, `prefers-reduced-motion`, aria-live regions, contrast-checked palette usage.
- Fonts: only the two used families; unused Bitcount family deleted.

## Error handling

- Backend: every route async-wrapped; central error middleware logs server-side, returns generic JSON; 404 JSON for unknown `/api/*`, static fallthrough otherwise.
- Frontend: every fetch has try/catch with user-visible fallback (sections degrade gracefully if API down).

## Testing

- `vitest` + `supertest` against `createApp()` with injected fakes (no real DB/SMTP/GitHub in tests).
- Coverage: validation rejections, rate-limit behavior, auth (timing-safe path, missing env refusal), CSV escaping, happy paths.
- `npm test` must pass before merge.

## Deployment

- Multi-stage Dockerfile: `npm ci`, non-root user, only runtime files copied, healthcheck on new `GET /healthz` (no DB write side-effect).
- Env vars unchanged in spirit: `DATABASE_URL`, `GITHUB_TOKEN`, `MAIL_*`, `ADMIN_*`, plus `TRUST_PROXY_HOPS`.
