// Read-mostly site data: stats, zen quote, combined payload, project cards.
const express = require('express');
const { asyncWrap } = require('../middleware/errors');

const STATS_REPO = 'portfolio';

function createSiteRouter({ db, github, contentService }) {
  const router = express.Router();

  async function fetchStats() {
    const { rows } = await db.query(
      'UPDATE stats SET visits = visits + 1 WHERE id = 1 RETURNING visits, last_commit'
    );
    const { visits, last_commit: storedCommit } = rows[0];

    // Refresh last commit in the background; serve the stored value now.
    github.lastCommit(STATS_REPO)
      .then((date) => {
        if (!date) return;
        const formatted = new Date(date).toLocaleDateString('es-ES');
        return db.query('UPDATE stats SET last_commit = $1 WHERE id = 1', [formatted]);
      })
      .catch((err) => console.error('Last commit refresh failed:', err));

    return { visits, lastCommit: storedCommit };
  }

  router.get('/stats', asyncWrap(async (req, res) => {
    res.json(await fetchStats());
  }));

  router.get('/zen', asyncWrap(async (req, res) => {
    res.json({ quote: await github.zen() });
  }));

  router.get('/data', asyncWrap(async (req, res) => {
    const [stats, zen] = await Promise.allSettled([fetchStats(), github.zen()]);
    const payload = {
      stats: stats.status === 'fulfilled' ? stats.value : null,
      zen: zen.status === 'fulfilled' ? { quote: zen.value } : null
    };
    if (!payload.stats && !payload.zen) {
      return res.status(500).json({ error: 'Failed to load data' });
    }
    res.json(payload);
  }));

  router.get('/projects', asyncWrap(async (req, res) => {
    const siteData = await contentService.get();
    const names = (siteData.content.projects.repos || [])
      .map((r) => r.name)
      .filter(Boolean);
    res.json(await github.repos(names));
  }));

  return router;
}

module.exports = { createSiteRouter };
