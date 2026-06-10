// One request feeds the zen quote (hero) and the footer stats.
// Everything is rendered with textContent — API data never becomes markup.
export async function initSiteData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { stats, zen } = await res.json();

    const quoteEl = document.getElementById('zen-quote');
    if (quoteEl && zen?.quote) {
      quoteEl.textContent = zen.quote;
      quoteEl.classList.add('visible');
    }

    const statsEl = document.getElementById('site-stats');
    if (statsEl && stats) {
      const visits = document.createElement('span');
      const visitsValue = document.createElement('b');
      visitsValue.textContent = String(stats.visits);
      visits.append('visits: ', visitsValue);

      const commit = document.createElement('span');
      const commitValue = document.createElement('b');
      commitValue.textContent = stats.lastCommit || 'n/a';
      commit.append('last commit: ', commitValue);

      statsEl.replaceChildren(visits, commit);
    }
  } catch {
    // Page works fine without stats — stay silent.
  }
}
