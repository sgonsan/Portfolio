let dataPromise = null;

function fetchSiteData() {
  if (!dataPromise) {
    dataPromise = fetch('/api/data')
      .then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to load data')))
      .catch(err => {
        dataPromise = null; // allow retry on next call
        throw err;
      });
  }
  return dataPromise;
}

export function initSiteData() {
  fetchSiteData()
    .then(data => {
      const quote = data?.zen?.quote || '';
      const visits = data?.stats?.visits ?? '—';
      const lastCommit = data?.stats?.lastCommit ?? '—';

      const zenElement = document.getElementById('zen-quote');
      if (zenElement && quote) {
        zenElement.textContent = `"${quote}"`;
        zenElement.classList.add('visible');
      }

      const statsEl = document.getElementById('site-stats');
      if (statsEl) {
        statsEl.textContent = `Visits: ${visits} | Last update: ${lastCommit}`;
      }
    })
    .catch(err => {
      console.error('Error loading site data:', err);
    });
}

// Optional export for other modules that may need combined data
export { fetchSiteData };
