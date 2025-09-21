const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../json/timeline.json');
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

let cache = { data: null, ts: 0 };

function readTimelineFromDisk() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

/**
 * GET /api/timeline
 * Query params (optional):
 *  - sort=asc|desc (by date, default=desc)
 *  - limit=N
 *  - tag=Music (filter by exact tag)
 */
exports.getTimeline = (req, res) => {
  try {
    const now = Date.now();
    if (!cache.data || now - cache.ts > CACHE_TTL_MS) {
      cache.data = readTimelineFromDisk();
      cache.ts = now;
      console.log('Timeline cache refreshed');
    }

    // clone to avoid mutating cache
    let items = Array.isArray(cache.data) ? [...cache.data] : [];

    // filter by tag (optional)
    const { tag, sort = 'desc', limit } = req.query;
    if (tag) {
      items = items.filter(
        it => Array.isArray(it.tags) && it.tags.includes(tag)
      );
    }

    // sort by date (YYYY-MM o YYYY-MM-DD)
    items.sort((a, b) => {
      const da = String(a.date || '');
      const db = String(b.date || '');
      return sort === 'asc'
        ? da.localeCompare(db)
        : db.localeCompare(da);
    });

    // limit results (optional)
    const lim = Number(limit);
    if (!Number.isNaN(lim) && lim > 0) {
      items = items.slice(0, lim);
    }

    console.log(`Timeline served (${Date.now() - now} ms)`);
    res.json({ items, meta: { count: items.length, cachedAt: cache.ts } });
  } catch (err) {
    console.error('Timeline error:', err);
    res.status(500).json({ error: 'Failed to load timeline' });
  }
};
