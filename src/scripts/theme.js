// =======================
// Theme toggle (dark / light)
// Default is dark; respects saved preference in localStorage.
// =======================
export function initThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  const saved = localStorage.getItem('theme');
  const initial = saved === 'light' ? 'light' : 'dark';
  applyTheme(initial);

  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('theme', next);
  });

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      toggle.textContent = '[ light ]';
    } else {
      document.documentElement.removeAttribute('data-theme');
      toggle.textContent = '[ dark ]';
    }
  }
}
