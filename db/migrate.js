require('@dotenvx/dotenvx').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id         SERIAL PRIMARY KEY,
        name       TEXT        NOT NULL,
        email      TEXT        NOT NULL,
        message    TEXT        NOT NULL,
        ip         TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS scores (
        id         SERIAL PRIMARY KEY,
        player     TEXT        NOT NULL CHECK (char_length(player) BETWEEN 1 AND 32),
        score      INTEGER     NOT NULL CHECK (score >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_scores_score_desc  ON scores(score DESC);
      CREATE INDEX IF NOT EXISTS idx_scores_created_at  ON scores(created_at DESC);

      CREATE TABLE IF NOT EXISTS stats (
        id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        visits      BIGINT NOT NULL DEFAULT 0,
        last_commit TEXT
      );

      INSERT INTO stats (id, visits) VALUES (1, 0) ON CONFLICT DO NOTHING;
    `);
    console.log('Migration complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
