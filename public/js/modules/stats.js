// =======================
// Stats footer
// =======================
export function initStatsFooter() {
  fetch('/api/stats')
    .then(res => res.json())
    .then(data => {
      const stats = document.getElementById('site-stats');
      stats.textContent = `Visits: ${data.visits} | Last update: ${data.lastCommit}`;
    })
    .catch(err => console.error('Error loading stats:', err));
}
