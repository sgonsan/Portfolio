// =======================
// Zen quote
// =======================
import { fetchSiteData } from './siteData.js';

export function initZenQuote() {
  fetchSiteData()
    .then(data => {
      const quote = data?.zen?.quote;
      if (!quote) throw new Error('Missing zen quote');

      const zenElement = document.getElementById('zen-quote');
      zenElement.textContent = `"${quote}"`;
      zenElement.classList.add('visible');
    })
    .catch(err => {
      console.error('Error loading zen quote:', err);
    });
}
