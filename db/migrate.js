// Idempotent schema migration. Run with: npm run migrate
require('dotenv').config();
const { createPool } = require('../server/lib/db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  player VARCHAR(16) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scores_score_idx ON scores (score DESC);

CREATE TABLE IF NOT EXISTS stats (
  id INTEGER PRIMARY KEY,
  visits BIGINT NOT NULL DEFAULT 0,
  last_commit TEXT
);

INSERT INTO stats (id, visits) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS site_content (
  section_key TEXT NOT NULL,
  field_key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  PRIMARY KEY (section_key, field_key)
);

CREATE TABLE IF NOT EXISTS section_order (
  section_key TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  disabled BOOLEAN NOT NULL DEFAULT false,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_pageviews (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  visitor_hash TEXT NOT NULL,
  referrer_host TEXT,
  country TEXT,
  region TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  lang TEXT,
  viewport_w INTEGER
);

CREATE INDEX IF NOT EXISTS analytics_pageviews_ts_idx ON analytics_pageviews (ts);

CREATE TABLE IF NOT EXISTS analytics_section_views (
  id BIGSERIAL PRIMARY KEY,
  pageview_id BIGINT NOT NULL REFERENCES analytics_pageviews(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  time_ms INTEGER NOT NULL,
  max_scroll_pct INTEGER
);

CREATE INDEX IF NOT EXISTS analytics_section_views_pv_idx ON analytics_section_views (pageview_id);
`;

const { DEFAULT_CONTENT, DEFAULT_ORDER } = require('../server/lib/defaults');

async function seedDefaults(pool) {
  for (const [section, fields] of Object.entries(DEFAULT_CONTENT)) {
    for (const [field, value] of Object.entries(fields)) {
      await pool.query(
        `INSERT INTO site_content (section_key, field_key, value, updated_by)
         VALUES ($1, $2, $3, 'seed') ON CONFLICT DO NOTHING`,
        [section, field, JSON.stringify(value)]
      );
    }
  }
  for (const [i, section] of DEFAULT_ORDER.entries()) {
    await pool.query(
      'INSERT INTO section_order (section_key, position, enabled) VALUES ($1, $2, true) ON CONFLICT DO NOTHING',
      [section, i]
    );
  }
}

async function migrate() {
  const pool = createPool();
  try {
    await pool.query(SCHEMA);
    await seedDefaults(pool);
    console.log('Migration complete');
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
