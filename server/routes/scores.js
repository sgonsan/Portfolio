const express = require('express');
const { asyncWrap } = require('../middleware/errors');

// Strict charset: leaderboard names render in the terminal UI, so reject
// anything that could ever read as markup, even though the frontend also
// renders via textContent.
const PLAYER_REGEX = /^[A-Za-z0-9_-]{1,16}$/;

function createScoresRouter({ db, limiter }) {
  const router = express.Router();

  router.get('/', asyncWrap(async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit ?? '10', 10) || 10, 1), 50);
    const { rows } = await db.query(
      'SELECT player, score FROM scores ORDER BY score DESC LIMIT $1',
      [limit]
    );
    res.json({ items: rows });
  }));

  router.post('/', limiter, asyncWrap(async (req, res) => {
    const { player, score } = req.body || {};
    if (typeof player !== 'string' || !PLAYER_REGEX.test(player)) {
      return res.status(400).json({ error: 'Invalid player name' });
    }
    // Strict type check: Number(null) is 0, so coercion would let nulls through.
    const s = score;
    if (typeof s !== 'number' || !Number.isInteger(s) || s < 0 || s > 1e8) {
      return res.status(400).json({ error: 'Invalid score' });
    }
    await db.query('INSERT INTO scores (player, score) VALUES ($1, $2)', [player, s]);
    res.status(201).json({ ok: true });
  }));

  return router;
}

module.exports = { createScoresRouter };
