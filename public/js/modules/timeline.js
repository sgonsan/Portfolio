// =======================
// Timeline
// =======================
export function initTimeline() {
  const listEl = document.getElementById('timeline-list');
  if (!listEl) return;

  fetch('/api/timeline?sort=desc')
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(({ items }) => {
      listEl.setAttribute('aria-busy', 'false');
      listEl.innerHTML = '';

      items.forEach((item) => {
        const art = document.createElement('article');
        art.className = 'timeline-item';
        art.innerHTML = `
          <div class="timeline-dot" aria-hidden="true"></div>
          <div class="timeline-content">
            <div class="timeline-date">${escapeHtml(item.date || '')}</div>
            <h3>${escapeHtml(item.title || '')}</h3>
            <p>${escapeHtml(item.description || '')}</p>
            ${Array.isArray(item.tags) && item.tags.length
            ? `<div class="timeline-tags">${item.tags.map(t => `<span class="timeline-tag">${escapeHtml(t)}</span>`).join('')}</div>`
            : ''
          }
          </div>
        `;
        listEl.appendChild(art);
      });

      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('revealed');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.1 });

      listEl.querySelectorAll('.timeline-item').forEach(el => io.observe(el));
    })
    .catch(err => {
      console.error('Timeline load error:', err);
      listEl.setAttribute('aria-busy', 'false');
      listEl.innerHTML = `
        <article class="timeline-item revealed">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-date">—</div>
            <h3>Timeline unavailable</h3>
            <p>Please try again later.</p>
          </div>
        </article>
      `;
    });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]|'/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }
}
