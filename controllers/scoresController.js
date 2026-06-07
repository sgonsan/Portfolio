const db = require('../db');

const listTopScores = async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 50);
  try {
    const { rows } = await db.query(
      'SELECT player, score FROM scores ORDER BY score DESC LIMIT $1',
      [limit]
    );
    res.json({ items: rows });
  } catch (err) {
    console.error('Error fetching scores:', err);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
};

const createScore = async (req, res) => {
  const { player, score } = req.body || {};
  if (typeof player !== 'string' || !player.trim() || player.length > 32) {
    return res.status(400).json({ error: 'Invalid player name' });
  }
  const s = Number(score);
  if (!Number.isFinite(s) || s < 0 || s > 1e8) {
    return res.status(400).json({ error: 'Invalid score' });
  }
  try {
    await db.query(
      'INSERT INTO scores (player, score) VALUES ($1, $2)',
      [player.trim(), Math.floor(s)]
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Error saving score:', err);
    return res.status(500).json({ error: 'Failed to save score' });
  }
};

module.exports = { listTopScores, createScore };
