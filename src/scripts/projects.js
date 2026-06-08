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
        const card = document.createElement('div');
        card.className = 'project-card';

        const title = document.createElement('h3');
        const desc = document.createElement('p');
        const link = document.createElement('a');

        const titleText = proj.name || '';
        const descText = proj.description || 'No description available.';

        link.href = proj.html_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'view repo';

        title.textContent = titleText;
        desc.textContent = descText;

        card.dataset.name = titleText;
        card.dataset.desc = descText;
        card.dataset.url = proj.html_url;

        card.appendChild(title);
        card.appendChild(desc);
        card.appendChild(link);
        container.appendChild(card);
      });
    })
    .catch(err => {
      console.error('Error loading projects:', err);
      container.removeAttribute('aria-busy');
      container.innerHTML = `
        <div class="project-card">
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
