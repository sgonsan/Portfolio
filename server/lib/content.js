// Versioned content service. The whole site's editable text flows through
// here: SSR reads get(), the panel writes via saveSection/saveOrder, every
// write bumps the version and drops the cache so the next visit re-renders.

const { DEFAULT_CONTENT, DEFAULT_ORDER } = require('./defaults');

const KNOWN_SECTIONS = new Set(Object.keys(DEFAULT_CONTENT));

function isPlainString(v) {
  return typeof v === 'string' && v.length <= 10000;
}

// Validate a value against the default of the same field: strings stay
// strings; lists must be arrays whose items carry the same string/array-of-
// string properties as the default item.
function valueMatchesShape(value, defaultValue) {
  if (typeof defaultValue === 'string') return isPlainString(value);
  if (Array.isArray(defaultValue)) {
    if (!Array.isArray(value) || value.length > 100) return false;
    const proto = defaultValue[0];
    if (!proto) return true;
    return value.every((item) => {
      if (typeof item !== 'object' || item === null) return false;
      return Object.entries(proto).every(([k, pv]) => {
        if (typeof pv === 'string') return isPlainString(item[k]);
        if (Array.isArray(pv)) {
          return Array.isArray(item[k]) && item[k].length <= 50 && item[k].every(isPlainString);
        }
        return false;
      });
    });
  }
  return false;
}

function createContentService(db) {
  let cache = null;
  let version = 1;

  function invalidate() {
    version += 1;
    cache = null;
  }

  async function load() {
    // Deep-copy defaults, then let DB rows win. Defaults guarantee every
    // field exists even if the DB is missing rows.
    const content = structuredClone(DEFAULT_CONTENT);
    const { rows } = await db.query('SELECT section_key, field_key, value FROM site_content');
    for (const row of rows) {
      if (content[row.section_key] && row.field_key in content[row.section_key]) {
        content[row.section_key][row.field_key] = row.value;
      }
    }
    const orderRes = await db.query(
      'SELECT section_key, position, enabled FROM section_order ORDER BY position'
    );
    const order = orderRes.rows.length
      ? orderRes.rows
          .filter((r) => KNOWN_SECTIONS.has(r.section_key))
          .map((r) => ({ section: r.section_key, enabled: r.enabled }))
      : DEFAULT_ORDER.map((s) => ({ section: s, enabled: true }));
    return { version, order, content };
  }

  return {
    async get() {
      if (cache) return cache;
      try {
        cache = await load();
        return cache;
      } catch (err) {
        console.error('Content load failed, serving defaults:', err.message);
        return {
          version: 0,
          order: DEFAULT_ORDER.map((s) => ({ section: s, enabled: true })),
          content: DEFAULT_CONTENT
        };
      }
    },

    async saveSection(sectionKey, fields, username) {
      const defaults = DEFAULT_CONTENT[sectionKey];
      if (!defaults) return { error: `Unknown section: ${sectionKey}` };
      if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
        return { error: 'Invalid fields payload' };
      }
      for (const [field, value] of Object.entries(fields)) {
        if (!(field in defaults)) return { error: `Unknown field: ${sectionKey}.${field}` };
        if (!valueMatchesShape(value, defaults[field])) {
          return { error: `Invalid value for ${sectionKey}.${field}` };
        }
      }
      for (const [field, value] of Object.entries(fields)) {
        await db.query(
          `INSERT INTO site_content (section_key, field_key, value, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (section_key, field_key)
           DO UPDATE SET value = $3, updated_by = $4, updated_at = now()`,
          [sectionKey, field, JSON.stringify(value), username]
        );
      }
      invalidate();
      return { ok: true, version };
    },

    async saveOrder(rows) {
      if (!Array.isArray(rows)) return { error: 'Invalid order payload' };
      const keys = rows.map((r) => r?.section_key);
      const expected = [...DEFAULT_ORDER].sort();
      if (JSON.stringify([...keys].sort()) !== JSON.stringify(expected)) {
        return { error: 'Order must contain exactly the known sections' };
      }
      for (const [i, row] of rows.entries()) {
        await db.query(
          `INSERT INTO section_order (section_key, position, enabled) VALUES ($1, $2, $3)
           ON CONFLICT (section_key) DO UPDATE SET position = $2, enabled = $3`,
          [row.section_key, i, row.enabled !== false]
        );
      }
      invalidate();
      return { ok: true, version };
    }
  };
}

module.exports = { createContentService, KNOWN_SECTIONS };
