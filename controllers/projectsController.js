const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const projectsPath = path.join(__dirname, '../projects.json');

let projectsCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

exports.getProjects = async (req, res) => {
  const now = Date.now();

  if (projectsCache.data && now - projectsCache.timestamp < CACHE_DURATION) {
    console.log('Serving projects from cache');
    return res.json(projectsCache.data);
  }

  try {
    const raw = fs.readFileSync(projectsPath, 'utf8');
    const urls = JSON.parse(raw);

    const results = [];
    for (const url of urls) {
      const repoPath = new URL(url).pathname.slice(1);
      const apiUrl = `https://api.github.com/repos/${repoPath}`;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'portfolio-app'
        }
      });

      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
      const data = await response.json();

      results.push({
        name: data.name,
        description: data.description,
        html_url: data.html_url
      });
    }

    projectsCache = { data: results, timestamp: now };

    console.log('Fetched projects from GitHub API');
    res.json(results);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};
