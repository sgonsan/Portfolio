// Project cards from /api/projects. Built exclusively with createElement
// and textContent so API data can never inject markup.

function skeletonCard() {
  const card = document.createElement('div');
  card.className = 'skeleton-card';
  for (const width of ['w-60', 'w-90', 'w-75', 'w-40']) {
    const line = document.createElement('div');
    line.className = `skeleton-line ${width}`;
    card.appendChild(line);
  }
  return card;
}

function relativeTime(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return '';
  if (days === 0) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function projectCard(project) {
  const card = document.createElement('a');
  card.className = 'project-card';
  card.href = project.url;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';

  const title = document.createElement('h3');
  title.textContent = project.name;

  const desc = document.createElement('p');
  desc.textContent = project.description || 'No description yet.';

  const meta = document.createElement('div');
  meta.className = 'project-meta';

  if (project.lang) {
    const lang = document.createElement('span');
    const dot = document.createElement('span');
    dot.className = 'lang-dot';
    dot.dataset.lang = project.lang;
    lang.append(dot, project.lang);
    meta.appendChild(lang);
  }

  const stars = document.createElement('span');
  stars.textContent = `★ ${project.stars ?? 0}`;
  meta.appendChild(stars);

  const updated = relativeTime(project.updated);
  if (updated) {
    const time = document.createElement('span');
    time.textContent = `updated ${updated}`;
    meta.appendChild(time);
  }

  card.append(title, desc, meta);
  return card;
}

export async function initProjects() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  grid.replaceChildren(...Array.from({ length: 6 }, skeletonCard));

  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const projects = await res.json();
    if (!Array.isArray(projects) || projects.length === 0) throw new Error('empty');

    const sorted = [...projects].sort((a, b) => new Date(b.updated) - new Date(a.updated));
    grid.replaceChildren(...sorted.map(projectCard));
  } catch {
    const error = document.createElement('p');
    error.className = 'projects-error';
    error.textContent = 'could not load projects — find them on github.com/sgonsan';
    grid.replaceChildren(error);
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}
