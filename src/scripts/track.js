// Cookie-less tracking: one pageview on load, one section-time batch on
// pagehide via sendBeacon. The server derives everything sensitive
// (geo, device) — the client only reports what it can see.

export function initTracking() {
  let pageviewId = null;
  const sectionTime = new Map(); // section id -> accumulated visible ms
  const visibleSince = new Map();
  let maxScroll = 0;
  let sent = false;

  fetch('/api/t/pv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      lang: navigator.language || null,
      vw: window.innerWidth || null,
      ref: document.referrer || null
    })
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => { pageviewId = data?.id ?? null; })
    .catch(() => {});

  const sections = document.querySelectorAll('main .pane[id]');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const now = performance.now();
        for (const entry of entries) {
          const key = entry.target.id;
          if (entry.isIntersecting) {
            visibleSince.set(key, now);
          } else if (visibleSince.has(key)) {
            sectionTime.set(key, (sectionTime.get(key) || 0) + (now - visibleSince.get(key)));
            visibleSince.delete(key);
          }
        }
      },
      { threshold: 0.4 }
    );
    sections.forEach((s) => observer.observe(s));
  }

  document.addEventListener('scroll', () => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable > 0) {
      maxScroll = Math.max(maxScroll, Math.round((window.scrollY / scrollable) * 100));
    }
  }, { passive: true });

  function flush() {
    if (sent || !pageviewId) return;
    const now = performance.now();
    for (const [key, since] of visibleSince) {
      sectionTime.set(key, (sectionTime.get(key) || 0) + (now - since));
    }
    const payload = {
      id: pageviewId,
      scroll: Math.min(maxScroll, 100),
      sections: [...sectionTime.entries()]
        .map(([k, ms]) => ({ k, ms: Math.round(ms) }))
        .filter((s) => s.ms > 200)
        .slice(0, 20)
    };
    if (!payload.sections.length) return;
    sent = true;
    navigator.sendBeacon?.(
      '/api/t/sv',
      new Blob([JSON.stringify(payload)], { type: 'application/json' })
    );
  }

  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
