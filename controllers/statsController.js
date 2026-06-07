const db = require('../db');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function updateLastCommit(startTs) {
  try {
    const apiUrl = 'https://api.github.com/repos/sgonsan/portfolio/commits?per_page=1';
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'portfolio-app'
      }
    });
    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
    const commits = await response.json();
    const date = commits[0]?.commit?.author?.date;
    if (!date) return;
    const formatted = new Date(date).toLocaleDateString('es-ES');
    await db.query('UPDATE stats SET last_commit = $1 WHERE id = 1', [formatted]);
    console.log(`Last commit updated (${Date.now() - startTs} ms)`);
  } catch (err) {
    console.error('Error fetching last commit:', err);
  }
}

async function fetchStatsData() {
  const startTs = Date.now();
  const { rows } = await db.query(
    'UPDATE stats SET visits = visits + 1 WHERE id = 1 RETURNING visits, last_commit'
  );
  const { visits, last_commit } = rows[0];
  updateLastCommit(startTs); // fire-and-forget
  return { visits, lastCommit: last_commit };
}

exports.fetchStatsData = fetchStatsData;

exports.getStats = async (req, res) => {
  try {
    const data = await fetchStatsData();
    res.json(data);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};
