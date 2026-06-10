// Cookie-less analytics. Raw IPs never persist: visitors are identified by
// sha256(utcDay | ip | ua), unique per day by construction.

const crypto = require('crypto');

const DIMENSIONS = ['country', 'referrer_host', 'device', 'browser', 'os', 'lang'];
const SECTION_KEY_REGEX = /^[a-z-]{1,32}$/;
const RETENTION_DAYS = 90;

function visitorHash(ip, ua, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return crypto.createHash('sha256').update(`${day}|${ip}|${ua}`).digest('hex');
}

// Tiny UA classifier — order matters (edge/opera embed "chrome").
function parseUa(ua = '') {
  const s = ua.toLowerCase();
  const device = /mobile|iphone|android(?!.*tablet)/.test(s)
    ? 'mobile'
    : /tablet|ipad/.test(s) ? 'tablet' : 'desktop';
  const browser = s.includes('edg/') ? 'edge'
    : s.includes('opr/') ? 'opera'
    : s.includes('firefox/') ? 'firefox'
    : s.includes('chrome/') ? 'chrome'
    : s.includes('safari/') ? 'safari'
    : 'other';
  const os = s.includes('windows') ? 'windows'
    : s.includes('android') ? 'android'
    : /iphone|ipad|ios/.test(s) ? 'ios'
    : s.includes('mac os') ? 'macos'
    : s.includes('linux') ? 'linux'
    : 'other';
  return { device, browser, os };
}

function referrerHost(ref) {
  if (!ref || typeof ref !== 'string') return null;
  try {
    return new URL(ref).host.slice(0, 100) || null;
  } catch {
    return null;
  }
}

function rangeFromQuery(query) {
  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  const to = ISO_DAY.test(query.to || '') ? new Date(`${query.to}T23:59:59Z`) : new Date();
  const from = ISO_DAY.test(query.from || '')
    ? new Date(`${query.from}T00:00:00Z`)
    : new Date(to.getTime() - 30 * 86_400_000);
  return { from, to };
}

function createAnalytics(db, geo) {
  if (geo === undefined) geo = require('geoip-lite');

  // Pageview ids handed to the browser are signed so the section-view beacon
  // can't be replayed against arbitrary ids to inflate stats. The key is
  // ephemeral (per process): a restart invalidates outstanding tokens, which
  // is fine since they only need to live for a single page visit.
  const tokenSecret = crypto.randomBytes(32);

  function signPageview(id) {
    const mac = crypto.createHmac('sha256', tokenSecret).update(String(id)).digest('hex').slice(0, 32);
    return `${id}.${mac}`;
  }

  function verifyPageview(token) {
    if (typeof token !== 'string' || !token.includes('.')) return null;
    const dot = token.indexOf('.');
    const idPart = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const id = Number(idPart);
    if (!Number.isInteger(id) || id <= 0) return null;
    const expected = crypto.createHmac('sha256', tokenSecret).update(String(id)).digest('hex').slice(0, 32);
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return id;
  }

  return {
    visitorHash,
    parseUa,
    signPageview,
    verifyPageview,

    async recordPageview({ ip, ua, ref, lang, vw }) {
      const { device, browser, os } = parseUa(ua);
      const location = ip ? geo?.lookup?.(ip) : null;
      const safeLang = typeof lang === 'string' ? lang.slice(0, 16) : null;
      const viewport = Number.isInteger(vw) && vw > 0 && vw < 20000 ? vw : null;
      const { rows } = await db.query(
        `INSERT INTO analytics_pageviews
           (visitor_hash, referrer_host, country, region, device, browser, os, lang, viewport_w)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          visitorHash(ip || '', ua || ''),
          referrerHost(ref),
          location?.country || null,
          location?.region || null,
          device, browser, os, safeLang, viewport
        ]
      );
      // Return a signed token, not the raw row id.
      return signPageview(rows[0].id);
    },

    async recordSections(pageviewToken, sections, scroll) {
      const id = verifyPageview(pageviewToken);
      if (id === null) return { error: 'bad token' };
      if (!Array.isArray(sections) || sections.length > 20) return { error: 'bad sections' };
      const pct = Number.isInteger(scroll) && scroll >= 0 && scroll <= 100 ? scroll : null;
      for (const s of sections) {
        if (typeof s?.k !== 'string' || !SECTION_KEY_REGEX.test(s.k)) return { error: 'bad key' };
        const ms = Number(s.ms);
        if (!Number.isFinite(ms) || ms < 0 || ms > 3_600_000) return { error: 'bad ms' };
      }
      for (const s of sections) {
        await db.query(
          'INSERT INTO analytics_section_views (pageview_id, section_key, time_ms, max_scroll_pct) VALUES ($1, $2, $3, $4)',
          [id, s.k, Math.round(Number(s.ms)), pct]
        );
      }
      return { ok: true };
    },

    async summary(query) {
      const { from, to } = rangeFromQuery(query);
      const [pvRes, timeRes] = await Promise.all([
        db.query(
          `SELECT COUNT(*)::int AS views, COUNT(DISTINCT visitor_hash)::int AS uniques
           FROM analytics_pageviews WHERE ts BETWEEN $1 AND $2`,
          [from, to]
        ),
        db.query(
          `SELECT COALESCE(AVG(sv.time_ms), 0)::int AS avg_section_ms
           FROM analytics_section_views sv
           JOIN analytics_pageviews pv ON pv.id = sv.pageview_id
           WHERE pv.ts BETWEEN $1 AND $2`,
          [from, to]
        )
      ]);
      return { ...pvRes.rows[0], avgSectionMs: timeRes.rows[0].avg_section_ms, from, to };
    },

    async timeseries(query) {
      const { from, to } = rangeFromQuery(query);
      const { rows } = await db.query(
        `SELECT date_trunc('day', ts) AS day,
                COUNT(*)::int AS views,
                COUNT(DISTINCT visitor_hash)::int AS uniques
         FROM analytics_pageviews WHERE ts BETWEEN $1 AND $2
         GROUP BY day ORDER BY day`,
        [from, to]
      );
      return rows;
    },

    async hourHistogram(query) {
      const { from, to } = rangeFromQuery(query);
      const { rows } = await db.query(
        `SELECT EXTRACT(HOUR FROM ts)::int AS hour, COUNT(*)::int AS views
         FROM analytics_pageviews WHERE ts BETWEEN $1 AND $2
         GROUP BY hour ORDER BY hour`,
        [from, to]
      );
      return rows;
    },

    async topDimension(dim, query) {
      if (!DIMENSIONS.includes(dim)) return { error: 'Unknown dimension' };
      const { from, to } = rangeFromQuery(query);
      // dim is whitelist-validated above — safe to interpolate.
      const { rows } = await db.query(
        `SELECT COALESCE(${dim}::text, 'unknown') AS value, COUNT(*)::int AS views
         FROM analytics_pageviews WHERE ts BETWEEN $1 AND $2
         GROUP BY value ORDER BY views DESC LIMIT 20`,
        [from, to]
      );
      return rows;
    },

    async sectionStats(query) {
      const { from, to } = rangeFromQuery(query);
      const { rows } = await db.query(
        `SELECT sv.section_key,
                COUNT(*)::int AS views,
                COALESCE(AVG(sv.time_ms), 0)::int AS avg_ms
         FROM analytics_section_views sv
         JOIN analytics_pageviews pv ON pv.id = sv.pageview_id
         WHERE pv.ts BETWEEN $1 AND $2
         GROUP BY sv.section_key ORDER BY views DESC`,
        [from, to]
      );
      return rows;
    },

    async purgeOld() {
      await db.query(
        'DELETE FROM analytics_pageviews WHERE ts < now() - make_interval(days => $1)',
        [RETENTION_DAYS]
      );
    }
  };
}

module.exports = { createAnalytics, visitorHash, parseUa, DIMENSIONS };
