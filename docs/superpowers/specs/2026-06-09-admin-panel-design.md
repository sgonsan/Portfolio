# Admin Panel — CMS, Section Ordering, Analytics, Accounts

Date: 2026-06-09. Approved by user ("ok, adelante con todo").
Base: branch `v2-rebuild` (hardened Express 5 API + Astro 6 frontend).

## Goals

1. Every visible text on the site is editable from a panel; changes appear on the next visit.
2. Sections can be reordered and enabled/disabled dynamically.
3. Rich cookie-less analytics with a dashboard.
4. Panel accounts live in the production Postgres DB and are manageable from the panel.

## Architecture

- **SSR**: Astro 6 with `@astrojs/node` adapter in middleware mode, `output: 'server'`.
  Express loads the built handler via dynamic `import()` (entry is ESM) and passes
  content through `locals`. Content comes from an in-memory versioned cache
  (`server/lib/content.js`); panel saves bump the version. In `astro dev` (no Express
  locals) the page falls back to fetching `GET /api/content` from the API.
- **Panel**: vanilla SPA served by Express at `/admin` from `server/admin-ui/`
  (login + app shell are public static files with no secrets; every data API
  requires a session). Brutalist terminal styling consistent with the site.
- Single deployment: same Docker image, same Express process.

## Data model (idempotent additions in db/migrate.js)

```sql
site_content (
  section_key TEXT, field_key TEXT, value JSONB,
  updated_at TIMESTAMPTZ, updated_by TEXT,
  PRIMARY KEY (section_key, field_key)
)
section_order (section_key TEXT PRIMARY KEY, position INT, enabled BOOL)
admin_users (id SERIAL PK, username TEXT UNIQUE, password_hash TEXT,
             disabled BOOL DEFAULT false, failed_attempts INT DEFAULT 0,
             locked_until TIMESTAMPTZ, last_login TIMESTAMPTZ, created_at TIMESTAMPTZ)
admin_sessions (id SERIAL PK, user_id INT REFERENCES admin_users,
                token_hash TEXT UNIQUE, expires_at TIMESTAMPTZ, ip TEXT, created_at TIMESTAMPTZ)
analytics_pageviews (id BIGSERIAL PK, ts TIMESTAMPTZ, visitor_hash TEXT,
                     referrer_host TEXT, country TEXT, region TEXT, device TEXT,
                     browser TEXT, os TEXT, lang TEXT, viewport_w INT)
analytics_section_views (id BIGSERIAL PK, pageview_id BIGINT REFERENCES analytics_pageviews,
                         section_key TEXT, time_ms INT, max_scroll_pct INT)
```

Defaults: `db/migrate.js` seeds `site_content` and `section_order` from
`server/lib/defaults.js` (single source shared with SSR fallbacks) using
`ON CONFLICT DO NOTHING`, so existing edits survive re-migration.

## Content model

Field kinds:
- **text** fields: hero.greeting, hero.name, hero.description, meta.title,
  meta.description, og.description, contact labels/button/status texts,
  footer.copyright, section titles, pane-bar paths.
- **list** fields (JSONB arrays edited with add/remove/reorder in the panel):
  skills.groups `[{name, items[]}]`, timeline.items `[{date, title, description, tags[]}]`,
  achievements.items `[{title, description}]`.

`GET /api/content` (public) returns `{ version, order: [...], content: {section: {field: value}} }`.
SSR renders sections in `order` (disabled sections skipped), header nav follows the same order.

## Panel auth

- bcryptjs (cost 11). Session: random 32-byte token, stored as SHA-256 hash,
  cookie `sid` httpOnly + Secure (prod) + SameSite=Strict, 24 h sliding expiry.
- Login rate-limited 5/min/IP; per-account progressive lockout
  (5 fails → 15 min lock via `failed_attempts`/`locked_until`).
- Origin header checked on mutating panel requests (defense in depth alongside SameSite).
- Bootstrap: `npm run admin:create -- <username>` prompts for password (stdin), inserts user.
- Account management: list, create, disable/enable, reset password. No roles.
- Legacy HTTP Basic Auth on `/api/admin/*` is removed; contacts list moves behind sessions.

## Analytics (cookie-less)

- `visitor_hash = sha256(dailySalt + ip + user-agent)`; salt rotates per UTC day; raw IP never stored.
- `POST /api/t/pv` on page load → returns `{ id }`. Server derives: country/region
  (geoip-lite, offline), device/browser/os (small built-in UA parser), referrer host,
  lang, viewport width. Rate-limited; validates field shapes/lengths.
- `POST /api/t/sv` on pagehide (`navigator.sendBeacon`): `{ id, sections: [{key, ms}], scroll }`
  — accumulated visible-time per section from IntersectionObserver + max scroll %.
- Dashboard queries (all date-ranged): totals (views, uniques, avg section time),
  daily timeseries, top sections by views/time, countries, referrers, devices,
  browsers, OS, languages, viewport buckets, hour-of-day histogram.
- Tracking script skipped when panel session cookie present? No — keep simple: track everything.
- Purge: `DELETE FROM analytics_* WHERE ts < now() - interval '90 days'` run at server boot.

## Panel pages (SPA)

`/admin`: login → tabs: **dashboard** (analytics), **content** (per-section field
editors + list editors), **sections** (order/enable), **contacts** (existing messages),
**accounts** (user management). Hash routing, fetch-based, same terminal aesthetic.

## Error handling

API errors follow existing JSON envelope; SSR render failure falls back to defaults
from `server/lib/defaults.js` (site never blank because DB is down). Beacon endpoints
never error to the client (fire-and-forget, 204).

## Testing

vitest + supertest with injected fakes (existing pattern):
- auth: login ok/fail, lockout after 5, session expiry, cookie flags, logout,
  disabled user, origin check on mutation.
- content: GET public shape, PUT saves + cache invalidation (version bump),
  validation (unknown section/field rejected, list shape enforced).
- sections: reorder/enable persisted and reflected in /api/content.
- analytics: pv validation + hash determinism (same ip+ua+day → same hash),
  sv batch validation, summary endpoint shapes.
- accounts: create/disable/reset, last admin cannot disable self.

## Out of scope (YAGNI)

Roles/permissions, media uploads, i18n, draft/publish workflow, real-time updates.
