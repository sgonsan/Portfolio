// =======================
// Contact form
// =======================

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

export function initContactForm() {
  const form = document.getElementById('contact-form');
  const submitButton = form.querySelector('button');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();
    const website = document.getElementById('website').value.trim(); // honeypot

    if (!name || !email || !message) return showToast('Please fill in all fields', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('Please enter a valid email address', 'error');
    if (message.length > 5000) return showToast('Message is too long (max 5000 characters)', 'error');
    if (website) return showToast('Error sending: Please try again later', 'error');

    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, website })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Message sent successfully!', 'success');
        form.reset();
      } else {
        showToast('Error sending: ' + (data.error || 'Please try again later'), 'error');
      }
    } catch {
      showToast('Error sending message. Please try again later.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Send';
    }
  });
}
