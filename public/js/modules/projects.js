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

      projects.forEach((proj, idx) => {
        const card = document.createElement('div');
        card.className = 'project-card';

        // build elements inside card
        const title = document.createElement('h3');
        const desc = document.createElement('p');
        const link = document.createElement('a');

        // save data
        const titleText = proj.name || '';
        const descText = proj.description || 'No description available.';

        // visible link text
        link.href = proj.html_url;
        link.target = '_blank';
        link.textContent = 'View on GitHub';

        // Append elements to card
        card.appendChild(title);
        card.appendChild(desc);
        card.appendChild(link);

        // Dataset (for modal or other uses)
        card.dataset.name = titleText;
        card.dataset.desc = descText;
        card.dataset.url = proj.html_url;

        // If available:
        // card.addEventListener('click', () => openProjectModal(card));

        container.appendChild(card);

        // Fill content without typewriter effect
        title.textContent = titleText;
        desc.textContent = descText;
      });

      // Enable hover to open modal (if function exists):
      if (typeof enableHoverOpenForCards === 'function') {
        // enableHoverOpenForCards();
      }
    })
    .catch(err => {
      console.error('Error loading projects:', err);
      container.removeAttribute('aria-busy');
      container.innerHTML = `
          <div class="project-card">
            <h3>Couldn’t load projects</h3>
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
          <div class="skel-text short"></div>
          <div class="skel-link"></div>
        `;
      container.appendChild(skel);
    }
  }
}
