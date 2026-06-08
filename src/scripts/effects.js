// =======================
// Mouse effects on project cards (radial highlight)
// Scroll tilt 3D removed — not consistent with the brutalist redesign.
// =======================
export function initEffects() {
  const container = document.getElementById('projects-grid');
  if (!container) return;

  container.addEventListener('mousemove', (e) => {
    const card = e.target.closest('.project-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mouse-x', `${mouseX}%`);
    card.style.setProperty('--mouse-y', `${mouseY}%`);
  });

  container.addEventListener('mouseleave', (e) => {
    const card = e.target.closest('.project-card');
    if (!card) return;
    card.style.setProperty('--mouse-x', `50%`);
    card.style.setProperty('--mouse-y', `50%`);
  });
}
