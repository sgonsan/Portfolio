const { fetchStatsData } = require('./statsController');
const { fetchZenQuoteData } = require('./zenController');

exports.getCombinedData = async (req, res) => {
  const [statsResult, zenResult] = await Promise.allSettled([
    fetchStatsData(),
    fetchZenQuoteData()
  ]);

  const payload = {
    stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
    zen: zenResult.status === 'fulfilled' ? zenResult.value : null,
  };

  if (!payload.stats && !payload.zen) {
    console.error('Combined data error: both stats and zen failed');
    return res.status(500).json({ error: 'Failed to load data' });
  }

  res.json(payload);
};
