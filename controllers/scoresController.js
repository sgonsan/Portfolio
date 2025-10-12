const db = require('../db');

const listTopScores = (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 50);
  const stmt = db.prepare(`
    SELECT player, score
    FROM scores
    ORDER BY score DESC
    LIMIT ?
  `);
  const rows = stmt.all(limit);
  res.json({ items: rows });
};

const createScore = (req, res) => {
  const { player, score } = req.body || {};
  if (typeof player !== 'string' || !player.trim() || player.length > 32) {
    return res.status(400).json({ error: 'Invalid player name' });
  }
  const s = Number(score);
  if (!Number.isFinite(s) || s < 0 || s > 1e8) {
    return res.status(400).json({ error: 'Invalid score' });
  }

  const insert = db.prepare(`INSERT INTO scores (player, score) VALUES (?, ?)`);
  insert.run(player.trim(), Math.floor(s));
  return res.status(201).json({ ok: true });
};

module.exports = { listTopScores, createScore };
