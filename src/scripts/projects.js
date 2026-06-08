// =======================
// Projects section
// =======================

export function initProjectsSection() {
  const container = document.getElementById('projects-grid');
  showProjectPlaceholders(6);

  fetch('/api/projects')
    .then(res => res.json())
    .then(projects => {
      container.removeAttribute('aria-busy');
      container.innerHTML = "";

      projects.forEach((proj) => {
        const card = document.createElement('a');
        card.className = 'project-card';
        card.href = proj.html_url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

        const title = document.createElement('h3');
        title.textContent = proj.name || '';

        const desc = document.createElement('p');
        desc.textContent = proj.description || 'No description available.';

        card.appendChild(title);
        card.appendChild(desc);

        const metaParts = [];
        if (proj.lang) metaParts.push(proj.lang);
        if (typeof proj.stars === 'number') metaParts.push(`★ ${proj.stars}`);
        if (proj.updated) {
          const d = new Date(proj.updated);
          if (!isNaN(d)) metaParts.push(`upd ${d.toISOString().slice(0, 10)}`);
        }
        if (metaParts.length) {
          const meta = document.createElement('div');
          meta.className = 'project-meta-inline';
          meta.textContent = metaParts.join(' · ');
          card.appendChild(meta);
        }

        container.appendChild(card);
      });
    })
    .catch(err => {
      console.error('Error loading projects:', err);
      container.removeAttribute('aria-busy');
      container.innerHTML = `
        <div class="project-card project-card--error">
          <h3>couldn't load projects</h3>
          <p>Please try again later.</p>
        </div>
      `;
    });

  function showProjectPlaceholders(count = 6) {
    container.innerHTML = "";
    container.setAttribute('aria-busy', 'true');
    for (let i = 0; i < count; i++) {
      const skel = document.createElement('div');
      skel.className = 'project-card skeleton';
      skel.innerHTML = `
        <div class="skel-title"></div>
        <div class="skel-text"></div>
        <div class="skel-text"></div>
        <div class="skel-text"></div>
        <div class="skel-text short"></div>
        <div class="skel-link"></div>
      `;
      container.appendChild(skel);
    }
  }
}
