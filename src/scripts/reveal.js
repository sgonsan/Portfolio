// Scroll-triggered CRT boot per pane. Plain scrolling — reveals fire once
// as panes enter the viewport; no scroll hijacking.
export function initReveal() {
  const panes = [...document.querySelectorAll('main .pane:not(.hero-pane)')];

  if (!('IntersectionObserver' in window)) {
    panes.forEach((pane) => pane.classList.add('revealed'));
    document.documentElement.classList.add('past-hero');
    return;
  }

  // Header chrome (logo + nav) only exists once the hero is mostly gone.
  const hero = document.querySelector('.hero-pane');
  if (hero) {
    const heroWatcher = new IntersectionObserver(
      ([entry]) => {
        document.documentElement.classList.toggle('past-hero', entry.intersectionRatio < 0.15);
      },
      { threshold: [0, 0.15] }
    );
    heroWatcher.observe(hero);
  } else {
    document.documentElement.classList.add('past-hero');
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );

  panes.forEach((pane) => observer.observe(pane));
}
