// =======================
// Mouse and scroll effects
// =======================
export function initEffects() {
  // Scroll tilt effect (mobile)
  let lastScrollY = window.scrollY;
  let lastTime = Date.now();

  function handleScrollTilt() {
    if (window.innerWidth >= 768) return;

    const now = Date.now();
    const deltaY = window.scrollY - lastScrollY;
    const deltaTime = now - lastTime;
    const velocity = deltaY / deltaTime;

    const maxTiltSmall = 1500;
    const maxTiltLarge = 10;
    const tiltSmall = Math.max(Math.min(velocity * 500, maxTiltSmall), -maxTiltSmall);
    const tiltLarge = Math.max(Math.min(velocity * 10, maxTiltLarge), -maxTiltLarge);

    document.querySelectorAll('.skill-card').forEach(card => {
      card.classList.add('tilt');
      card.style.transform = `rotateX(${tiltSmall * -1}deg)`;
    });

    document.querySelectorAll('.project-card').forEach(card => {
      card.classList.add('tilt');
      card.style.transform = `rotateX(${tiltLarge * -1}deg)`;
    });

    lastScrollY = window.scrollY;
    lastTime = now;

    clearTimeout(handleScrollTilt.resetTimeout);
    handleScrollTilt.resetTimeout = setTimeout(() => {
      document.querySelectorAll('.skill-card, .project-card').forEach(card => {
        card.style.transform = `rotateX(0deg)`;
        card.classList.remove('tilt');
      });
    }, 150);
  }

  window.addEventListener('scroll', handleScrollTilt);

  // Mouse move effect on project cards
  const container = document.getElementById('projects-grid');
  if (container) {
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
}
