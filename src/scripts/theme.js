export function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  const current = () =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

  const render = () => {
    btn.textContent = `[${current()}]`;
    btn.setAttribute('aria-label', `Switch to ${current() === 'light' ? 'dark' : 'light'} theme`);
  };

  btn.addEventListener('click', () => {
    const next = current() === 'light' ? 'dark' : 'light';
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try { localStorage.setItem('theme', next); } catch { /* storage blocked */ }
    render();
  });

  render();
}
