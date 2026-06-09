// Pre-paint theme application. External file (not inline) so the strict
// CSP (script-src 'self') holds. Loaded synchronously in <head>.
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = saved || (prefersLight ? 'light' : 'dark');
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch (e) { /* storage blocked — keep dark default */ }
})();
