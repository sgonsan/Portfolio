// =======================
// Stats footer
// =======================
import { fetchSiteData } from './siteData.js';

export function initStatsFooter() {
  fetchSiteData()
    .then(data => {
      const stats = document.getElementById('site-stats');
      const visits = data?.stats?.visits ?? '—';
      const lastCommit = data?.stats?.lastCommit ?? '—';
      stats.textContent = `Visits: ${visits} | Last update: ${lastCommit}`;
    })
    .catch(err => {
      console.error('Error loading stats:', err);
    });
}
