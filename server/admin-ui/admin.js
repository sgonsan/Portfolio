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
const routes = {
  '#/dashboard': renderDashboard,
  '#/content': renderContent,
  '#/sections': renderSections,
  '#/contacts': renderContacts,
  '#/accounts': renderAccounts,
  '#/photo': renderPhoto
};

function route() {
  const hash = routes[location.hash] ? location.hash : '#/dashboard';
  document.querySelectorAll('#tabs a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === hash);
  });
  view().replaceChildren(el('p', { class: 'dim', text: 'loading...' }));
  routes[hash]().catch((err) => {
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

function barList(title, rows, valueKey = 'views', labelKey = 'value') {
  const max = Math.max(1, ...rows.map((r) => r[valueKey]));
  return el('div', { class: 'panel' },
    el('h3', { text: title }),
    ...(rows.length ? rows : [{ [labelKey]: '—', [valueKey]: 0 }]).map((r) =>
      el('div', { class: 'bar-row' },
        el('span', { class: 'bar-label', text: String(r[labelKey]) }),
        el('div', { class: 'bar-track' },
          el('div', { class: 'bar-fill', style: `width:${(r[valueKey] / max) * 100}%` })
        ),
        el('span', { class: 'bar-val', text: String(r[valueKey]) })
      )
    )
  );
}

function lineChart(rows) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('viewBox', '0 0 400 140');
  svg.setAttribute('preserveAspectRatio', 'none');
  const max = Math.max(1, ...rows.map((r) => r.views));
  const baseline = document.createElementNS(svg.namespaceURI, 'line');
  Object.entries({ x1: 0, y1: 130, x2: 400, y2: 130 }).forEach(([k, v]) => baseline.setAttribute(k, v));
  svg.appendChild(baseline);
  if (rows.length) {
    const pts = rows.map((r, i) => {
      const x = rows.length === 1 ? 200 : (i / (rows.length - 1)) * 390 + 5;
      const y = 125 - (r.views / max) * 110;
      return `${x},${y}`;
    });
    const line = document.createElementNS(svg.namespaceURI, 'polyline');
    line.setAttribute('points', pts.join(' '));
    svg.appendChild(line);
  }
  return svg;
}

async function renderDashboard() {
  const [summary, series, hours, sections, countries, referrers, devices, browsers, oses, langs] =
    await Promise.all([
      api(`/analytics/summary${qs()}`),
      api(`/analytics/timeseries${qs()}`),
      api(`/analytics/hours${qs()}`),
      api(`/analytics/sections${qs()}`),
      api(`/analytics/top${qs()}&dim=country`),
      api(`/analytics/top${qs()}&dim=referrer_host`),
      api(`/analytics/top${qs()}&dim=device`),
      api(`/analytics/top${qs()}&dim=browser`),
      api(`/analytics/top${qs()}&dim=os`),
      api(`/analytics/top${qs()}&dim=lang`)
    ]);

  const fromInput = el('input', { type: 'date', value: range.from });
  const toInput = el('input', { type: 'date', value: range.to });

  view().replaceChildren(
    el('h2', { text: 'dashboard' }),
    el('div', { class: 'range-bar' },
      el('div', {}, el('label', { text: 'from' }), fromInput),
      el('div', {}, el('label', { text: 'to' }), toInput),
      el('button', {
        class: 'ghost', text: 'apply',
        onclick: () => {
          if (fromInput.value) range.from = fromInput.value;
          if (toInput.value) range.to = toInput.value;
          route();
        }
      })
    ),
    el('div', { class: 'cards' },
      el('div', { class: 'stat-card' }, el('div', { class: 'num', text: String(summary.views) }), el('div', { class: 'lbl', text: 'pageviews' })),
      el('div', { class: 'stat-card' }, el('div', { class: 'num', text: String(summary.uniques) }), el('div', { class: 'lbl', text: 'unique visitors' })),
      el('div', { class: 'stat-card' }, el('div', { class: 'num', text: `${Math.round(summary.avgSectionMs / 1000)}s` }), el('div', { class: 'lbl', text: 'avg time per section' }))
    ),
    el('div', { class: 'panels' },
      el('div', { class: 'panel' }, el('h3', { text: 'daily views' }), lineChart(series)),
      barList('hours (UTC)', hours, 'views', 'hour'),
      barList('sections by views', sections, 'views', 'section_key'),
      barList('sections by avg time (ms)', sections.map((s) => ({ ...s })), 'avg_ms', 'section_key'),
      barList('countries', countries),
      barList('referrers', referrers),
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

async function renderContent() {
  contentCache = await api('/content');
  const sections = Object.keys(contentCache.content);
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
async function renderSections() {
  const data = await api('/content');
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
async function renderContacts() {
  const rows = await api('/contacts');
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
async function renderAccounts() {
  const users = await api('/users');
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

// ---------------- photo ----------------
async function renderPhoto() {
  const bust = Date.now();
  const img = el('img', { src: `/assets/personal-foto.jpg?v=${bust}`, alt: 'profile photo', class: 'photo-preview' });
  const fileInput = el('input', { type: 'file', id: 'photo-file', accept: 'image/jpeg,image/png,image/webp' });
  const status = el('p', { class: 'error' });

  view().replaceChildren(
    el('h2', { text: 'photo' }),
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
            status.className = 'error';
            status.textContent = '';
            const file = fileInput.files[0];
            if (!file) { status.textContent = 'select a file first'; return; }
            try {
              const res = await fetch('/api/admin/photo', {
                method: 'POST',
                headers: { 'Content-Type': file.type },
                body: file
              });
              if (res.status === 401) { showLogin(); return; }
              const data = await res.json();
              if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
              status.className = 'ok';
              status.textContent = 'uploaded — live now';
              img.src = `/assets/personal-foto.jpg?v=${Date.now()}`;
            } catch (err) {
              status.textContent = err.message;
            }
          }
        }),
        status
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
