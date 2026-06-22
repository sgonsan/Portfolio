// GitHub API client with per-key in-memory TTL caching.
// All requests carry a 5s abort timeout so a slow upstream never
// stalls page-critical endpoints.

const ZEN_TTL = 10 * 60 * 1000;
const REPOS_TTL = 30 * 60 * 1000;
const COMMIT_TTL = 30 * 60 * 1000;
const REQUEST_TIMEOUT = 5_000;

function createGithubClient({ token, owner, fetchImpl = fetch } = {}) {
  const cache = new Map();

  function cacheGet(key) {
    const hit = cache.get(key);
    if (!hit || Date.now() > hit.exp) return null;
    return hit.val;
  }

  function cacheSet(key, val, ttl) {
    cache.set(key, { val, exp: Date.now() + ttl });
  }

  async function request(path, accept = 'application/vnd.github+json') {
    const headers = {
      Accept: accept,
      'User-Agent': 'portfolio-app'
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchImpl(`https://api.github.com${path}`, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    });
    if (!res.ok) throw new Error(`GitHub API ${path} responded ${res.status}`);
    return res;
  }

  return {
    async zen() {
      const cached = cacheGet('zen');
      if (cached) return cached;
      const res = await request('/zen', 'text/plain');
      const quote = await res.text();
      cacheSet('zen', quote, ZEN_TTL);
      return quote;
    },

    async repos(names) {
      const cacheKey = 'repos:' + [...names].sort().join(',');
      const cached = cacheGet(cacheKey);
      if (cached) return cached;
      const settled = await Promise.allSettled(
        names.map(async (name) => {
          const res = await request(`/repos/${owner}/${encodeURIComponent(name)}`);
          const data = await res.json();
          return {
            name: data.name,
            description: data.description,
            url: data.html_url,
            stars: data.stargazers_count,
            updated: data.pushed_at,
            lang: data.language
          };
        })
      );
      const ok = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      if (ok.length === 0) throw new Error('All GitHub repo requests failed');
      cacheSet(cacheKey, ok, REPOS_TTL);
      return ok;
    },

    async lastCommit(repo) {
      const cached = cacheGet('lastCommit');
      if (cached) return cached;
      const res = await request(`/repos/${owner}/${encodeURIComponent(repo)}/commits?per_page=1`);
      const commits = await res.json();
      const date = commits[0]?.commit?.author?.date ?? null;
      cacheSet('lastCommit', date, COMMIT_TTL);
      return date;
    }
  };
}

module.exports = { createGithubClient };
