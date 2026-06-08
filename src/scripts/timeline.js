// =======================
// Timeline reveal animation
// Items are pre-rendered at build time; we only animate them on scroll.
// =======================
export function initTimeline() {
  const listEl = document.getElementById('timeline-list');
  if (!listEl) return;

  const items = listEl.querySelectorAll('.timeline-item');
  if (!items.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  items.forEach(el => io.observe(el));
}
