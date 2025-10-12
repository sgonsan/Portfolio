const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_DIR = __dirname;
const DB_FILE = path.join(DB_DIR, 'portfolio.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_FILE);

// Create tables (idempotent)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player TEXT NOT NULL CHECK (length(player) BETWEEN 1 AND 32),
    score INTEGER NOT NULL CHECK (score >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_scores_score_desc ON scores(score DESC);
  CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores(created_at DESC);
`);

module.exports = db;
