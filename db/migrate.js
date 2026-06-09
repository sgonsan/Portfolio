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
`;

async function migrate() {
  const pool = createPool();
  try {
    await pool.query(SCHEMA);
    console.log('Migration complete');
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
