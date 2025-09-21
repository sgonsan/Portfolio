// =======================
// Theme toggle
// =======================
export function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  const currentTheme = localStorage.getItem('theme');
  const githubLogo = document.getElementById('github-logo');
  const linkedinLogo = document.getElementById('linkedin-logo');

  if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    toggleBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    githubLogo.src = currentTheme === 'dark' ? 'assets/github-logo-dark.png' : 'assets/github-logo.png';
    linkedinLogo.src = currentTheme === 'dark' ? 'assets/linkedin-logo-dark.png' : 'assets/linkedin-logo.png';
  }

  toggleBtn.addEventListener('click', () => {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    githubLogo.src = theme === 'dark' ? 'assets/github-logo-dark.png' : 'assets/github-logo.png';
    linkedinLogo.src = theme === 'dark' ? 'assets/linkedin-logo-dark.png' : 'assets/linkedin-logo.png';
  });
}
