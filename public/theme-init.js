// Pre-paint theme application. External file (not inline) so the strict
// CSP (script-src 'self') holds. Loaded synchronously in <head>.
(function () {
  // Mark JS availability before first paint: scroll-reveal hides content
  // only under html.js, so the site stays fully visible without JavaScript.
  document.documentElement.classList.add('js');
  // Reload starts at the top: opt out of the browser restoring the previous
  // scroll position, which otherwise lands mid-page and skips the hero.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  try {
    var saved = localStorage.getItem('theme');
    var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = saved || (prefersLight ? 'light' : 'dark');
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch (e) { /* storage blocked — keep dark default */ }
})();
