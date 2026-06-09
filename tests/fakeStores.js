// In-memory implementation of exactly the SQL the services issue.
// Each handler is a [regex, fn(params)] pair; first match wins.
// State is plain JS so tests can inspect and pre-seed it.

export function createStatefulDb() {
  const state = {
    users: [],          // {id, username, password_hash, disabled, failed_attempts, locked_until, last_login, created_at}
    sessions: [],       // {id, user_id, token_hash, expires_at, ip}
    content: new Map(), // "section|field" -> value (parsed)
    order: [],          // {section_key, position, enabled}
    pageviews: [],      // {id, ...}
    sectionViews: [],   // {pageview_id, section_key, time_ms, max_scroll_pct}
    contacts: [],
    aggregates: {}      // canned responses for analytics SELECTs
  };
  let nextUserId = 1;
  let nextSessionId = 1;
  let nextPvId = 1;

  const handlers = [
    [/SELECT id, username, password_hash.*FROM admin_users WHERE username/s, ([u]) => ({
      rows: state.users.filter((x) => x.username === u)
    })],
    [/UPDATE admin_users SET failed_attempts = \$1, locked_until/s, ([fails, lock, id]) => {
      const u = state.users.find((x) => x.id === id);
      if (u) { u.failed_attempts = fails; u.locked_until = lock; }
      return { rows: [] };
    }],
    [/UPDATE admin_users SET failed_attempts = 0/s, ([id]) => {
      const u = state.users.find((x) => x.id === id);
      if (u) { u.failed_attempts = 0; u.locked_until = null; u.last_login = new Date(); }
      return { rows: [] };
    }],
    [/INSERT INTO admin_sessions/s, ([userId, tokenHash, expires, ip]) => {
      state.sessions.push({ id: nextSessionId++, user_id: userId, token_hash: tokenHash, expires_at: expires, ip });
      return { rows: [] };
    }],
    [/SELECT s\.id AS session_id/s, ([tokenHash]) => {
      const s = state.sessions.find((x) => x.token_hash === tokenHash);
      if (!s) return { rows: [] };
      const u = state.users.find((x) => x.id === s.user_id);
      return { rows: [{ session_id: s.id, expires_at: s.expires_at, id: u.id, username: u.username, disabled: u.disabled }] };
    }],
    [/DELETE FROM admin_sessions WHERE id = \$1/s, ([id]) => {
      state.sessions = state.sessions.filter((x) => x.id !== id);
      return { rows: [] };
    }],
    [/UPDATE admin_sessions SET expires_at/s, ([expires, id]) => {
      const s = state.sessions.find((x) => x.id === id);
      if (s) s.expires_at = expires;
      return { rows: [] };
    }],
    [/DELETE FROM admin_sessions WHERE token_hash/s, ([tokenHash]) => {
      state.sessions = state.sessions.filter((x) => x.token_hash !== tokenHash);
      return { rows: [] };
    }],
    [/DELETE FROM admin_sessions WHERE user_id/s, ([userId]) => {
      state.sessions = state.sessions.filter((x) => x.user_id !== userId);
      return { rows: [] };
    }],
    [/INSERT INTO admin_users \(username, password_hash\)/s, ([username, hash]) => {
      if (state.users.some((x) => x.username === username)) {
        const err = new Error('duplicate');
        err.code = '23505';
        throw err;
      }
      const user = {
        id: nextUserId++, username, password_hash: hash, disabled: false,
        failed_attempts: 0, locked_until: null, last_login: null, created_at: new Date()
      };
      state.users.push(user);
      return { rows: [{ id: user.id, username }] };
    }],
    [/UPDATE admin_users SET password_hash/s, ([hash, id]) => {
      const u = state.users.find((x) => x.id === id);
      if (u) { u.password_hash = hash; u.failed_attempts = 0; u.locked_until = null; }
      return { rows: [] };
    }],
    [/UPDATE admin_users SET disabled/s, ([disabled, id]) => {
      const u = state.users.find((x) => x.id === id);
      if (u) u.disabled = disabled;
      return { rows: [] };
    }],
    [/SELECT id, username, disabled, last_login, created_at FROM admin_users/s, () => ({
      rows: state.users.map(({ id, username, disabled, last_login, created_at }) =>
        ({ id, username, disabled, last_login, created_at }))
    })],

    [/SELECT section_key, field_key, value FROM site_content/s, () => ({
      rows: [...state.content.entries()].map(([k, value]) => {
        const [section_key, field_key] = k.split('|');
        return { section_key, field_key, value };
      })
    })],
    [/SELECT section_key, position, enabled FROM section_order/s, () => ({
      rows: [...state.order].sort((a, b) => a.position - b.position)
    })],
    [/INSERT INTO site_content/s, ([section, field, json]) => {
      state.content.set(`${section}|${field}`, JSON.parse(json));
      return { rows: [] };
    }],
    [/INSERT INTO section_order/s, ([section, position, enabled]) => {
      const existing = state.order.find((x) => x.section_key === section);
      if (existing) { existing.position = position; existing.enabled = enabled; }
      else state.order.push({ section_key: section, position, enabled });
      return { rows: [] };
    }],

    [/INSERT INTO analytics_pageviews/s, (params) => {
      const id = nextPvId++;
      state.pageviews.push({ id, params });
      return { rows: [{ id }] };
    }],
    [/INSERT INTO analytics_section_views/s, ([pageview_id, section_key, time_ms, max_scroll_pct]) => {
      state.sectionViews.push({ pageview_id, section_key, time_ms, max_scroll_pct });
      return { rows: [] };
    }],
    [/SELECT COUNT\(\*\)::int AS views,\s*COUNT\(DISTINCT visitor_hash\)/s, () => ({
      rows: [state.aggregates.summary ?? { views: 0, uniques: 0 }]
    })],
    [/SELECT COALESCE\(AVG\(sv\.time_ms\), 0\)::int AS avg_section_ms/s, () => ({
      rows: [{ avg_section_ms: state.aggregates.avgMs ?? 0 }]
    })],
    [/date_trunc\('day', ts\)/s, () => ({ rows: state.aggregates.timeseries ?? [] })],
    [/EXTRACT\(HOUR FROM ts\)/s, () => ({ rows: state.aggregates.hours ?? [] })],
    [/GROUP BY value ORDER BY views DESC/s, () => ({ rows: state.aggregates.top ?? [] })],
    [/GROUP BY sv\.section_key/s, () => ({ rows: state.aggregates.sections ?? [] })],
    [/DELETE FROM analytics_pageviews/s, () => ({ rows: [] })],

    [/FROM contacts/s, () => ({ rows: state.contacts })],
    [/UPDATE stats/s, () => ({ rows: [{ visits: 42, last_commit: '01/06/2026' }] })],
    [/SELECT player, score/s, () => ({ rows: [{ player: 'neo', score: 100 }] })],
    [/INSERT INTO (contacts|scores|stats)/s, () => ({ rows: [] })]
  ];

  return {
    state,
    async query(sql, params = []) {
      for (const [regex, fn] of handlers) {
        if (regex.test(sql)) return fn(params);
      }
      throw new Error(`fakeStores: unhandled SQL: ${sql.slice(0, 80)}`);
    }
  };
}
