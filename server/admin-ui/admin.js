// elbiti admin panel. Vanilla SPA, hash routing.
// All rendering via createElement/textContent — API data never becomes markup.

const $ = (id) => document.getElementById(id);
const view = () => $('view');

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

async function api(path, options = {}) {
  const res = await fetch(`/api/admin${path}`, {
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (res.status === 401) {
    showLogin();
    throw new Error('unauthorized');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// ---------------- auth shell ----------------
function showLogin() {
  $('app-view').hidden = true;
  $('login-view').hidden = false;
}

function showApp(user) {
  $('login-view').hidden = true;
  $('app-view').hidden = false;
  $('who').textContent = `${user.username}@elbiti`;
  route();
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  try {
    const data = await api('/login', {
      method: 'POST',
      body: {
        username: $('lg-user').value.trim(),
        password: $('lg-pass').value
      }
    });
    $('lg-pass').value = '';
    showApp(data.user);
  } catch (err) {
    $('login-error').textContent = err.message;
  }
});

$('logout').addEventListener('click', async () => {
  try { await api('/logout', { method: 'POST' }); } catch { /* session gone anyway */ }
  showLogin();
});

// ---------------- router ----------------
// stale() is a closure: returns true if a newer route() call has superseded this one.
// Each render function receives stale and must call it before touching the DOM after any await.
const routes = {
  '#/dashboard': renderDashboard,
  '#/content': renderContent,
  '#/sections': renderSections,
  '#/contacts': renderContacts,
  '#/accounts': renderAccounts,
  '#/site': renderSite
};

let routeGen = 0;

function route() {
  const hash = routes[location.hash] ? location.hash : '#/dashboard';
  const gen = ++routeGen;
  const stale = () => gen !== routeGen;
  document.querySelectorAll('#tabs a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === hash);
  });
  view().replaceChildren(el('p', { class: 'dim', text: 'loading...' }));
  routes[hash](stale).catch((err) => {
    if (stale()) return;
    if (err.message !== 'unauthorized') {
      view().replaceChildren(el('p', { class: 'error', text: err.message }));
    }
  });
}
addEventListener('hashchange', route);

// ---------------- dashboard ----------------
const day = (d) => d.toISOString().slice(0, 10);
let range = {
  from: day(new Date(Date.now() - 29 * 86_400_000)),
  to: day(new Date())
};

function qs() { return `?from=${range.from}&to=${range.to}`; }

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const fmtSecs = (ms) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};

// Compact top-N list with proportional bars and a share-of-total label.
function barList(title, rows, opts = {}) {
  const { valueKey = 'views', labelKey = 'value', limit = 8, note } = opts;
  const total = rows.reduce((a, r) => a + r[valueKey], 0);
  const max = Math.max(1, ...rows.map((r) => r[valueKey]));
  const shown = rows.slice(0, limit);
  return el('div', { class: 'panel' },
    el('h3', { text: title }),
    note ? el('p', { class: 'hint', text: note }) : '',
    shown.length
      ? el('div', { class: 'bars' }, ...shown.map((r) =>
          el('div', { class: 'bar-row' },
            el('span', { class: 'bar-label', title: String(r[labelKey]), text: String(r[labelKey]) }),
            el('div', { class: 'bar-track' },
              el('div', { class: 'bar-fill', style: `width:${(r[valueKey] / max) * 100}%` })
            ),
            el('span', { class: 'bar-val', text: String(r[valueKey]) }),
            el('span', { class: 'bar-pct', text: total ? `${Math.round((r[valueKey] / total) * 100)}%` : '' })
          )
        ))
      : el('p', { class: 'empty', text: 'no data yet' })
  );
}

// Daily views as a filled area, with uniques as a second line.
function areaChart(rows) {
  const W = 400, H = 140, pad = 6, floor = H - 8;
  const svg = svgEl('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' });
  const max = Math.max(1, ...rows.map((r) => Math.max(r.views, r.uniques)));
  // horizontal gridlines at 50% / 100%
  for (const f of [0.5, 1]) {
    const y = floor - (floor - pad) * f;
    svg.appendChild(svgEl('line', { class: 'grid', x1: 0, y1: y, x2: W, y2: y }));
  }
  svg.appendChild(svgEl('line', { x1: 0, y1: floor, x2: W, y2: floor }));
  if (!rows.length) return svg;

  const x = (i) => rows.length === 1 ? W / 2 : (i / (rows.length - 1)) * (W - 2 * pad) + pad;
  const y = (v) => floor - (v / max) * (floor - pad);
  const viewsPts = rows.map((r, i) => `${x(i)},${y(r.views)}`);
  // area = views line closed down to the baseline
  svg.appendChild(svgEl('polygon', {
    class: 'area',
    points: `${pad},${floor} ${viewsPts.join(' ')} ${x(rows.length - 1)},${floor}`
  }));
  svg.appendChild(svgEl('polyline', { class: 'line-views', points: viewsPts.join(' ') }));
  svg.appendChild(svgEl('polyline', { class: 'line-uniques', points: rows.map((r, i) => `${x(i)},${y(r.uniques)}`).join(' ') }));
  return svg;
}

// Slim 24-slot activity strip (UTC) — replaces the old wall of 24 bars.
function hourStrip(hours) {
  const counts = Array.from({ length: 24 }, () => 0);
  hours.forEach((h) => { if (h.hour >= 0 && h.hour < 24) counts[h.hour] = h.views; });
  const max = Math.max(1, ...counts);
  return el('div', { class: 'panel' },
    el('h3', { text: 'activity by hour (UTC)' }),
    el('div', { class: 'spark' }, ...counts.map((v, h) =>
      el('div', {
        class: 'spark-bar', title: `${String(h).padStart(2, '0')}:00 — ${v} views`,
        style: `height:${Math.max(3, (v / max) * 100)}%`
      })
    )),
    el('div', { class: 'spark-axis' }, ...['00', '06', '12', '18'].map((t) => el('span', { text: t })))
  );
}

// Engagement: views + avg dwell per section in one table (merges two panels).
function sectionTable(sections) {
  const max = Math.max(1, ...sections.map((s) => s.views));
  return el('div', { class: 'panel wide' },
    el('h3', { text: 'sections — views & dwell time' }),
    sections.length
      ? el('table', { class: 'sec-table' },
          el('thead', {}, el('tr', {},
            el('th', { text: 'section' }), el('th', { text: 'views' }), el('th', { text: 'avg time' })
          )),
          el('tbody', {}, ...sections.map((s) =>
            el('tr', {},
              el('td', {},
                el('div', { class: 'sec-bar' },
                  el('div', { class: 'bar-fill', style: `width:${(s.views / max) * 100}%` }),
                  el('span', { text: s.section_key })
                )
              ),
              el('td', { text: String(s.views) }),
              el('td', { text: fmtSecs(s.avg_ms) })
            )
          ))
        )
      : el('p', { class: 'empty', text: 'no section data yet' })
  );
}

function peakHourLabel(hours) {
  if (!hours.length) return '—';
  const top = hours.reduce((a, b) => (b.views > a.views ? b : a));
  return `${String(top.hour).padStart(2, '0')}:00`;
}

function statCard(num, lbl) {
  return el('div', { class: 'stat-card' },
    el('div', { class: 'num', text: String(num) }),
    el('div', { class: 'lbl', text: lbl })
  );
}

async function renderDashboard(stale) {
  const { summary, series, hours, sections, countries, referrers, devices, browsers, oses, langs } =
    await api(`/analytics/dashboard${qs()}`);

  if (stale()) return;
  const fromInput = el('input', { type: 'date', value: range.from });
  const toInput = el('input', { type: 'date', value: range.to });
  const apply = () => {
    if (fromInput.value) range.from = fromInput.value;
    if (toInput.value) range.to = toInput.value;
    route();
  };
  const preset = (days, label) => el('button', {
    class: 'ghost', text: label,
    onclick: () => {
      range.to = day(new Date());
      range.from = day(new Date(Date.now() - (days - 1) * 86_400_000));
      route();
    }
  });

  const perVisitor = summary.uniques ? (summary.views / summary.uniques).toFixed(1) : '0';
  const geoEmpty = !countries.length || (countries.length === 1 && countries[0].value === 'unknown');

  view().replaceChildren(
    el('h2', { text: 'dashboard' }),
    el('div', { class: 'range-bar' },
      el('div', { class: 'range-presets' }, preset(7, '7d'), preset(30, '30d'), preset(90, '90d')),
      el('div', {}, el('label', { text: 'from' }), fromInput),
      el('div', {}, el('label', { text: 'to' }), toInput),
      el('button', { text: 'apply', onclick: apply })
    ),
    el('div', { class: 'cards' },
      statCard(summary.views, 'pageviews'),
      statCard(summary.uniques, 'unique visitors'),
      statCard(perVisitor, 'views / visitor'),
      statCard(fmtSecs(summary.avgSectionMs), 'avg time / section'),
      statCard(peakHourLabel(hours), 'peak hour (UTC)')
    ),
    el('div', { class: 'panels' },
      el('div', { class: 'panel wide' },
        el('h3', { text: 'daily traffic' }),
        el('div', { class: 'legend' },
          el('span', { class: 'k-views', text: '■ views' }),
          el('span', { class: 'k-uniques', text: '■ uniques' })
        ),
        areaChart(series)
      ),
      hourStrip(hours),
      sectionTable(sections),
      barList('referrers', referrers),
      barList('countries', countries, {
        note: geoEmpty ? 'no geo resolved — needs real client IP (set CF_ORIGIN_SECRET)' : undefined
      }),
      barList('devices', devices),
      barList('browsers', browsers),
      barList('os', oses),
      barList('languages', langs)
    )
  );
}

// ---------------- content editor ----------------
let contentCache = null;

function fieldEditor(section, field, value) {
  // string field
  if (typeof value === 'string') {
    const long = value.length > 80;
    const input = el(long ? 'textarea' : 'input', { 'data-field': field });
    input.value = value;
    return el('div', { class: 'field-block' },
      el('label', { text: `${section}.${field}` }),
      input
    );
  }
  // list field
  const wrap = el('div', { class: 'field-block', 'data-list-field': field });
  wrap.append(el('label', { text: `${section}.${field} (list)` }));
  const itemsBox = el('div');
  const proto = value[0] ?? {};

  const addItem = (item) => {
    const itemEl = el('div', { class: 'list-item' });
    const tools = el('div', { class: 'tools' },
      el('button', { class: 'ghost', text: '↑', type: 'button', onclick: () => itemEl.previousElementSibling?.before(itemEl) }),
      el('button', { class: 'ghost', text: '↓', type: 'button', onclick: () => itemEl.nextElementSibling?.after(itemEl) }),
      el('button', { class: 'danger', text: '×', type: 'button', onclick: () => itemEl.remove() })
    );
    itemEl.append(el('div', { class: 'list-item-head' }, el('span', { class: 'dim', text: '·' }), tools));
    for (const [k, propProto] of Object.entries(proto)) {
      const isArray = Array.isArray(propProto);
      const input = el(String(item[k] ?? '').length > 80 ? 'textarea' : 'input', {
        'data-prop': k, 'data-kind': isArray ? 'array' : 'string'
      });
      input.value = isArray ? (item[k] ?? []).join(', ') : (item[k] ?? '');
      itemEl.append(el('label', { text: isArray ? `${k} (comma-separated)` : k }), input);
    }
    itemsBox.append(itemEl);
  };

  value.forEach(addItem);
  wrap.append(
    itemsBox,
    el('button', {
      class: 'ghost', text: '+ add item', type: 'button',
      onclick: () => addItem(Object.fromEntries(Object.keys(proto).map((k) => [k, Array.isArray(proto[k]) ? [] : ''])))
    })
  );
  return wrap;
}

function collectFields(container) {
  const fields = {};
  container.querySelectorAll('[data-field]').forEach((input) => {
    fields[input.dataset.field] = input.value;
  });
  container.querySelectorAll('[data-list-field]').forEach((listEl) => {
    const items = [...listEl.querySelectorAll('.list-item')].map((itemEl) => {
      const item = {};
      itemEl.querySelectorAll('[data-prop]').forEach((input) => {
        item[input.dataset.prop] = input.dataset.kind === 'array'
          ? input.value.split(',').map((s) => s.trim()).filter(Boolean)
          : input.value;
      });
      return item;
    });
    fields[listEl.dataset.listField] = items;
  });
  return fields;
}

async function renderContent(stale) {
  contentCache = await api('/content');
  if (stale()) return;
  // meta (SEO/site metadata) is edited in the [site] tab, not here.
  const sections = Object.keys(contentCache.content).filter((s) => s !== 'meta');
  const current = sections.includes(location.hash.split('?sec=')[1]) ? location.hash.split('?sec=')[1] : sections[0];

  const editor = el('div');
  const status = el('p', { class: 'error' });

  const renderEditor = (section) => {
    editor.replaceChildren(
      ...Object.entries(contentCache.content[section]).map(([field, value]) =>
        fieldEditor(section, field, value)
      ),
      el('div', { class: 'save-bar' },
        el('button', {
          text: `save ${section}`,
          onclick: async () => {
            status.className = 'error';
            status.textContent = '';
            try {
              await api(`/content/${section}`, { method: 'PUT', body: { fields: collectFields(editor) } });
              status.className = 'ok';
              status.textContent = `saved — live on next visit`;
            } catch (err) {
              status.textContent = err.message;
            }
          }
        }),
        status
      )
    );
  };

  view().replaceChildren(
    el('h2', { text: 'content' }),
    el('div', { class: 'section-picker' },
      ...sections.map((s) => el('button', {
        class: 'ghost', text: s,
        onclick: (e) => {
          document.querySelectorAll('.section-picker button').forEach((b) => b.classList.add('ghost'));
          e.target.classList.remove('ghost');
          renderEditor(s);
        }
      }))
    ),
    editor
  );
  document.querySelectorAll('.section-picker button')[sections.indexOf(current)]?.classList.remove('ghost');
  renderEditor(current);
}

// ---------------- sections order ----------------
async function renderSections(stale) {
  const data = await api('/content');
  if (stale()) return;
  let order = data.order.map((o) => ({ section_key: o.section, enabled: o.enabled }));
  const status = el('p', { class: 'error' });
  const list = el('div');

  const redraw = () => {
    list.replaceChildren(...order.map((row, i) =>
      el('div', { class: `order-row${row.enabled ? '' : ' disabled'}` },
        el('span', { class: 'dim', text: String(i + 1).padStart(2, '0') }),
        el('span', { class: 'name', text: row.section_key }),
        el('button', {
          class: 'ghost', text: '↑',
          onclick: () => { if (i > 0) { [order[i - 1], order[i]] = [order[i], order[i - 1]]; redraw(); } }
        }),
        el('button', {
          class: 'ghost', text: '↓',
          onclick: () => { if (i < order.length - 1) { [order[i + 1], order[i]] = [order[i], order[i + 1]]; redraw(); } }
        }),
        el('button', {
          class: row.enabled ? 'ghost' : 'danger',
          text: row.enabled ? 'enabled' : 'disabled',
          onclick: () => { row.enabled = !row.enabled; redraw(); }
        })
      )
    ));
  };
  redraw();

  view().replaceChildren(
    el('h2', { text: 'sections' }),
    list,
    el('div', { class: 'save-bar' },
      el('button', {
        text: 'save order',
        onclick: async () => {
          status.className = 'error';
          status.textContent = '';
          try {
            await api('/sections', { method: 'PUT', body: { order } });
            status.className = 'ok';
            status.textContent = 'saved — live on next visit';
          } catch (err) {
            status.textContent = err.message;
          }
        }
      }),
      status
    )
  );
}

// ---------------- contacts ----------------
async function renderContacts(stale) {
  const rows = await api('/contacts');
  if (stale()) return;
  view().replaceChildren(
    el('h2', { text: 'contacts' }),
    el('p', {}, el('a', { href: '/api/admin/contacts.csv', text: 'download csv' })),
    el('table', {},
      el('thead', {}, el('tr', {},
        ...['id', 'date', 'name', 'email', 'message', 'ip'].map((h) => el('th', { text: h }))
      )),
      el('tbody', {}, ...rows.map((r) => el('tr', {},
        el('td', { text: String(r.id) }),
        el('td', { text: new Date(r.created_at).toLocaleString() }),
        el('td', { text: r.name }),
        el('td', { text: r.email }),
        el('td', { class: 'msg', text: r.message }),
        el('td', { text: r.ip || '' })
      )))
    )
  );
}

// ---------------- accounts ----------------
async function renderAccounts(stale) {
  const users = await api('/users');
  if (stale()) return;
  const status = el('p', { class: 'error' });

  const userRow = (u) => el('tr', {},
    el('td', { text: String(u.id) }),
    el('td', { text: u.username }),
    el('td', { text: u.disabled ? 'disabled' : 'active' }),
    el('td', { text: u.last_login ? new Date(u.last_login).toLocaleString() : 'never' }),
    el('td', {},
      el('button', {
        class: u.disabled ? 'ghost' : 'danger',
        text: u.disabled ? 'enable' : 'disable',
        onclick: async () => {
          try {
            await api(`/users/${u.id}`, { method: 'PATCH', body: { disabled: !u.disabled } });
            route();
          } catch (err) { status.textContent = err.message; }
        }
      }),
      el('button', {
        class: 'ghost', text: 'reset password',
        onclick: async () => {
          const password = prompt(`New password for ${u.username} (min 10 chars):`);
          if (!password) return;
          try {
            await api(`/users/${u.id}`, { method: 'PATCH', body: { password } });
            status.className = 'ok';
            status.textContent = `password updated for ${u.username} (their sessions were closed)`;
          } catch (err) {
            status.className = 'error';
            status.textContent = err.message;
          }
        }
      })
    )
  );

  const newUser = el('input', { placeholder: 'username' });
  const newPass = el('input', { placeholder: 'password (min 10)', type: 'password' });

  view().replaceChildren(
    el('h2', { text: 'accounts' }),
    el('table', {},
      el('thead', {}, el('tr', {}, ...['id', 'user', 'status', 'last login', 'actions'].map((h) => el('th', { text: h })))),
      el('tbody', {}, ...users.map(userRow))
    ),
    el('div', { class: 'panel', style: 'margin-top:1.2rem; max-width:420px' },
      el('h3', { text: 'create account' }),
      el('label', { text: 'username' }), newUser,
      el('label', { text: 'password' }), newPass,
      el('div', { class: 'save-bar' },
        el('button', {
          text: 'create',
          onclick: async () => {
            status.className = 'error';
            status.textContent = '';
            try {
              await api('/users', { method: 'POST', body: { username: newUser.value.trim(), password: newPass.value } });
              route();
            } catch (err) { status.textContent = err.message; }
          }
        }),
        status
      )
    )
  );
}

// ---------------- site (photo + SEO) ----------------
async function renderSite(stale) {
  const contentData = await api('/content');
  if (stale()) return;

  const bust = Date.now();
  const img = el('img', { src: `/assets/personal-foto.jpg?v=${bust}`, alt: 'profile photo', class: 'photo-preview' });
  const fileInput = el('input', { type: 'file', id: 'photo-file', accept: 'image/jpeg,image/png,image/webp' });
  const photoStatus = el('p', { class: 'error' });

  const metaEditor = el('div');
  const metaStatus = el('p', { class: 'error' });

  const ogImg = el('img', { src: `/assets/preview.png?v=${bust}`, alt: 'social preview', class: 'photo-preview' });
  const ogStatus = el('p', { class: 'error' });

  metaEditor.replaceChildren(
    ...Object.entries(contentData.content.meta).map(([field, value]) =>
      fieldEditor('meta', field, value)
    )
  );

  view().replaceChildren(
    el('h2', { text: 'site' }),

    el('h3', { text: 'profile photo' }),
    el('div', { class: 'panel' },
      el('p', { class: 'dim', text: 'current profile photo' }),
      img
    ),
    el('div', { class: 'panel' },
      el('label', { for: 'photo-file', text: 'replace photo — JPEG / PNG / WebP, max 8 MB' }),
      fileInput,
      el('div', { class: 'save-bar' },
        el('button', {
          text: 'upload',
          onclick: async () => {
            photoStatus.className = 'error';
            photoStatus.textContent = '';
            const file = fileInput.files[0];
            if (!file) { photoStatus.textContent = 'select a file first'; return; }
            try {
              const res = await fetch('/api/admin/photo', {
                method: 'POST',
                headers: { 'Content-Type': file.type },
                body: file
              });
              if (res.status === 401) { showLogin(); return; }
              const data = await res.json();
              if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
              photoStatus.className = 'ok';
              photoStatus.textContent = 'uploaded — live now';
              img.src = `/assets/personal-foto.jpg?v=${Date.now()}`;
            } catch (err) {
              photoStatus.textContent = err.message;
            }
          }
        }),
        photoStatus
      )
    ),

    el('h3', { text: 'seo & metadata' }),
    el('div', { class: 'panel' },
      metaEditor,
      el('div', { class: 'save-bar' },
        el('button', {
          text: 'save meta',
          onclick: async () => {
            metaStatus.className = 'error';
            metaStatus.textContent = '';
            try {
              await api('/content/meta', { method: 'PUT', body: { fields: collectFields(metaEditor) } });
              metaStatus.className = 'ok';
              metaStatus.textContent = 'saved — live on next visit';
            } catch (err) {
              metaStatus.textContent = err.message;
            }
          }
        }),
        metaStatus
      )
    ),

    el('h3', { text: 'social preview (og:image)' }),
    el('div', { class: 'panel' },
      el('p', { class: 'dim', text: 'auto-generated card from your name, skills and photo — regenerate after changing them' }),
      ogImg,
      el('div', { class: 'save-bar' },
        el('button', {
          text: 'regenerate preview',
          onclick: async () => {
            ogStatus.className = 'error';
            ogStatus.textContent = 'generating…';
            try {
              await api('/preview', { method: 'POST' });
              ogStatus.className = 'ok';
              ogStatus.textContent = 'regenerated — live now';
              ogImg.src = `/assets/preview.png?v=${Date.now()}`;
            } catch (err) {
              ogStatus.className = 'error';
              ogStatus.textContent = err.message;
            }
          }
        }),
        ogStatus
      )
    )
  );
}

// ---------------- boot ----------------
(async () => {
  try {
    const data = await api('/me');
    showApp(data.user);
  } catch {
    showLogin();
  }
})();
