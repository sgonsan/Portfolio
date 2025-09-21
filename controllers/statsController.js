const fs = require('fs');
const path = require('path');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const statsPath = path.join(__dirname, '../json/stats.json');

if (!fs.existsSync(statsPath)) {
  fs.writeFileSync(statsPath, JSON.stringify({ visits: 0 }), 'utf8');
}

exports.getStats = async (req, res) => {
  const now = Date.now();

  try {
    // Update visit count
    let stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    stats.visits += 1;
    res.json({
      visits: stats.visits,
      lastCommit: stats.lastCommit,
    });

    // Last commit
    const repoPath = 'sgonsan/portfolio'; // Adjust this to your repo path
    const apiUrl = `https://api.github.com/repos/${repoPath}/commits?per_page=1`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'portfolio-app'
      }
    });

    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
    const commits = await response.json();
    const lastCommit = commits[0]?.commit?.author?.date || 'Unknown';
    stats.lastCommit = new Date(lastCommit).toLocaleDateString('es-ES');
    fs.writeFileSync(statsPath, JSON.stringify(stats), 'utf8');
    console.log(`Stats updated (${Date.now() - now} ms)`);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};
