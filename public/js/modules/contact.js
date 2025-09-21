// =======================
// Contact form
// =======================
export function initContactForm() {
  const form = document.getElementById('contact-form');
  const submitButton = form.querySelector('button');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();
    const website = document.getElementById('website').value.trim(); // honeypot

    if (!name || !email || !message) return alert('Please fill in all fields');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert('Please enter a valid email address');
    if (message.length > 5000) return alert('Message is too long');

    if (website) return alert('Error sending: Please try again later');

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
        alert('Message sent successfully!');
        form.reset();
      } else {
        alert('Error sending: ' + (data.error || 'Please try again later'));
      }
    } catch {
      alert('Error sending message');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Send';
    }
  });
}
