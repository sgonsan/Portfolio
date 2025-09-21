const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

let zenCache = { text: null, timestamp: 0 };
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

exports.getZenQuote = async (req, res) => {
  const now = Date.now();

  if (zenCache.text && now - zenCache.timestamp < CACHE_DURATION) {
    console.log('Serving Zen quote from cache');
    return res.json({ quote: zenCache.text });
  }

  try {
    const response = await fetch('https://api.github.com/zen', {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'portfolio-app'
      }
    });

    if (!response.ok) throw new Error(`GitHub Zen API error: ${response.status}`);
    const text = await response.text();

    zenCache = { text, timestamp: now };

    console.log(`Fetched new Zen quote from GitHub API (${Date.now() - now} ms)`);
    res.json({ quote: text });
  } catch (err) {
    console.error('Error fetching Zen quote:', err);
    res.status(500).json({ error: 'Failed to fetch Zen quote' });
  }
};
