const fs = require('fs');
const path = require('path');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const projectsPath = path.join(__dirname, '../json/projects.json');

let projectsCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

exports.getProjects = async (req, res) => {
  const now = Date.now();

  if (projectsCache.data && now - projectsCache.timestamp < CACHE_DURATION) {
    console.log('Serving projects from cache');
    return res.json(projectsCache.data);
  }

  try {
    const raw = fs.readFileSync(projectsPath, 'utf8');
    const repos = JSON.parse(raw);
    const urls = repos.map(repo => "https://github.com/sgonsan/" + repo);

    const fetchRepoData = async (url) => {
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

      return {
        name: data.name,
        description: data.description,
        html_url: data.html_url,
        stars: data.stargazers_count,
        updated: data.pushed_at,
        lang: data.language
      };
    };

    const fetchPromises = urls.map(fetchRepoData);
    const results = await Promise.all(fetchPromises);

    projectsCache = { data: results, timestamp: now };

    console.log(`Fetched projects from GitHub API (${Date.now() - now} ms)`);
    res.json(results);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};
