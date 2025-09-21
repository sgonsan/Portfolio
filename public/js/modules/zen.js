// =======================
// Zen quote
// =======================
export function initZenQuote() {
  fetch('/api/zen')
    .then(res => res.json())
    .then(data => {
      const zenElement = document.getElementById('zen-quote');
      zenElement.textContent = `"${data.quote}"`;
      zenElement.classList.add('visible');
    })
    .catch(err => console.error('Error loading zen quote:', err));
}
