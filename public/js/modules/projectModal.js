// =======================
// Project modal (optional)
// =======================
export function initProjectModal() {
  // ---- Modal refs
  const overlayEl = document.getElementById('project-overlay');
  if (!overlayEl) return;
  const modalEl = overlayEl.querySelector('.project-modal');
  const closeEl = overlayEl.querySelector('.project-close');

  const modalTitle = document.getElementById('project-modal-title');
  const modalDesc = document.getElementById('project-modal-desc');
  const modalLink = document.getElementById('project-modal-link');

  const rowStars = document.getElementById('meta-stars');
  const rowUpdated = document.getElementById('meta-updated');
  const rowLang = document.getElementById('meta-language');

  // close modal helpers
  function closeProjectModal() {
    overlayEl.classList.remove('visible');
    // allow scroll in body
    document.body.style.overflow = '';
  }

  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closeProjectModal();
  });
  closeEl.addEventListener('click', closeProjectModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlayEl.classList.contains('visible')) closeProjectModal();
  });

  // Enable hover to open modal
  function enableHoverOpenForCards() {
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!canHover) return;

    const cards = document.querySelectorAll('.project-card');
    const HOVER_DELAY = 500;
    const timers = new WeakMap();

    cards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        if (overlayEl.classList.contains('visible')) return;
        const t = setTimeout(() => {
          openProjectModal(card);
        }, HOVER_DELAY);
        timers.set(card, t);
      });

      card.addEventListener('mouseleave', () => {
        const t = timers.get(card);
        if (t) {
          clearTimeout(t);
          timers.delete(card);
        }
      });
    });
  }

  // Open with animations FLIP from "card" to "modal"
  function openProjectModal(card) {
    // Fill modal with data
    modalTitle.textContent = card.dataset.name || '';
    modalDesc.textContent = card.dataset.desc || '';
    modalLink.href = card.dataset.url || '#';

    rowStars.hidden = rowUpdated.hidden = rowLang.hidden = true;
    if (card.dataset.stars) {
      rowStars.hidden = false;
      rowStars.querySelector('span').textContent = card.dataset.stars;
    }
    if (card.dataset.updated) {
      rowUpdated.hidden = false;
      const d = new Date(card.dataset.updated);
      rowUpdated.querySelector('span').textContent = d.toLocaleString();
    }
    if (card.dataset.lang) {
      rowLang.hidden = false;
      rowLang.querySelector('span').textContent = card.dataset.lang;
    }

    // Original card dimensions
    const first = card.getBoundingClientRect();

    // Create visual clone
    const clone = card.cloneNode(true);
    clone.classList.add('project-clone');
    clone.style.top = `${first.top}px`;
    clone.style.left = `${first.left}px`;
    clone.style.width = `${first.width}px`;
    clone.style.height = `${first.height}px`;
    document.body.appendChild(clone);

    // Calculate centered destination
    const targetW = Math.min(720, window.innerWidth * 0.92);
    const targetH = Math.min(Math.max(first.height * 1.85, 340), window.innerHeight * 0.84);
    const targetX = (window.innerWidth - targetW) / 2;
    const targetY = (window.innerHeight - targetH) / 2;

    const scaleX = targetW / first.width;
    const scaleY = targetH / first.height;
    const translateX = targetX - first.left;
    const translateY = targetY - first.top;

    // Show overlay but without fade yet
    overlayEl.classList.add('visible');
    document.body.style.overflow = 'hidden';

    // Clone animation → center with blur and fade
    const DURATION = 450;
    const anim = clone.animate([
      { transform: 'translate(0,0) scale(1,1)', opacity: 1, filter: 'blur(0px)' },
      { offset: 0.5, opacity: 0, filter: 'blur(8px)', transform: `translate(${translateX * 0.5}px, ${translateY * 0.5}px) scale(${1 + (scaleX - 1) * 0.5}, ${1 + (scaleY - 1) * 0.5})` },
      { transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`, opacity: 0, filter: 'blur(8px)' }
    ], {
      duration: DURATION,
      easing: 'cubic-bezier(.22,.61,.36,1)',
      fill: 'forwards'
    });

    // Halfway: fade-in overlay + modal
    setTimeout(() => {
      overlayEl.classList.add('fade-in');
      modalEl.style.opacity = '0';
      modalEl.style.left = `${targetX}px`;
      modalEl.style.top = `${targetY}px`;
      modalEl.style.width = `${targetW}px`;
      modalEl.style.height = `${targetH}px`;
      modalEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards', easing: 'ease-out' });
    }, DURATION / 2);

    anim.onfinish = () => {
      clone.remove();
    };
  }

  // Enable hover to open modal (if function exists):
  // enableHoverOpenForCards();
}
