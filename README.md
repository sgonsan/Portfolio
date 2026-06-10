<div align="center">
  <img src="public/assets/icon.svg" alt="Project Icon" width="120"/>
  <h1>Portfolio</h1>
  <p>Personal portfolio — Astro static frontend served by a hardened Express API.</p>
</div>

---

## Stack

- **Frontend:** Astro 6 SSR (Node adapter in middleware mode), vanilla JS, no UI framework
- **Backend:** Node 22, Express 5, helmet, express-rate-limit
- **Database:** PostgreSQL (CMS content, section order, admin accounts/sessions, analytics, contacts, leaderboard)
- **Mail:** nodemailer 8 (contact form)
- **Tests:** vitest + supertest (dependency-injected fakes, no real DB/SMTP needed)

## Admin panel (`/admin`)

Every visible text on the site, the order and visibility of sections, contact
messages, analytics and panel accounts are managed from `/admin`:

- **Content:** edit any text field or structured list (timeline, skills,
  achievements). Saving invalidates the SSR cache — changes are live on the
  next visit.
- **Sections:** reorder with ↑/↓ and enable/disable whole sections.
- **Dashboard:** cookie-less analytics — pageviews, daily uniques
  (sha256(day|ip|ua), raw IPs never stored), per-section visible time,
  countries (offline geoip), referrers, devices, browsers, OS, languages,
  hour histogram; all date-ranged. Raw data is purged after 90 days.
- **Accounts:** DB-backed users with bcrypt hashes; sessions are random
  tokens stored hashed, HttpOnly + SameSite=Strict cookies, 24 h sliding
  expiry, 5-failure lockout. Bootstrap the first account with:

```bash
npm run admin:create -- <username>
```

## Project structure

```text
server/
  index.js        # bootstrap (env, real dependencies, listen)
  app.js          # createApp({ db, mailer, github }) — DI factory used by tests
  middleware/     # adminAuth (timing-safe), rate limits, error handling
  routes/         # contact, scores, site data (stats/zen/projects), admin
  lib/            # pg pool (strict TLS), github client (cached), mailer, sanitize
src/              # Astro frontend (components, styles, scripts, content)
public/           # static assets (photo, fonts, icons, theme-init.js)
db/migrate.js     # idempotent schema migration
tests/            # API test suite
```

## Development

```bash
npm install
cp .env.example .env   # fill in values
npm run migrate        # create tables
npm run dev            # API on :3000, Astro dev server on :4321 (proxies /api)
```

## Production

```bash
npm run build && npm start   # or use the Dockerfile (non-root, healthcheck on /healthz)
```

## Testing

```bash
npm test
```

## Security properties

- Strict CSP (`script-src 'self'`) — the page ships **zero inline scripts**;
  all dynamic DOM is built with `textContent`/`createElement`, never `innerHTML`.
- Panel auth: bcrypt password hashes, hashed session tokens, HttpOnly +
  SameSite=Strict cookies, login rate limit + account lockout, same-origin
  check on mutations. No credentials in environment variables.
- CSV export escapes spreadsheet formula injection.
- Mail headers are stripped of CR/LF; `replyTo` carries the bare address only.
- `TRUST_PROXY_HOPS` controls `X-Forwarded-For` trust so rate limits can't be spoofed.
- Postgres TLS verification is always on (`DATABASE_CA_CERT` for private CAs).
- Per-endpoint rate limits; strict input validation on every mutating route.

## Environment variables

See [.env.example](.env.example) for the full annotated list.

## License

MIT — see [LICENSE](LICENSE).
