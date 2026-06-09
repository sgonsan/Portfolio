const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const status = document.getElementById('form-status');
  const counter = document.getElementById('cf-counter');
  const message = form.elements.message;
  const button = form.querySelector('button[type="submit"]');

  const setError = (field, text) => {
    const slot = form.querySelector(`[data-error-for="${field}"]`);
    if (slot) slot.textContent = text;
  };
  const clearErrors = () => ['name', 'email', 'message'].forEach((f) => setError(f, ''));

  message.addEventListener('input', () => {
    counter.textContent = `${message.value.length}/5000`;
  });

  const validate = () => {
    clearErrors();
    let ok = true;
    if (!form.elements.name.value.trim()) { setError('name', 'required'); ok = false; }
    const email = form.elements.email.value.trim();
    if (!email) { setError('email', 'required'); ok = false; }
    else if (!EMAIL_REGEX.test(email)) { setError('email', 'invalid email'); ok = false; }
    if (!message.value.trim()) { setError('message', 'required'); ok = false; }
    return ok;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.className = 'form-status';
    status.textContent = '';
    if (!validate()) return;

    button.disabled = true;
    status.textContent = 'sending...';
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.elements.name.value.trim(),
          email: form.elements.email.value.trim(),
          message: message.value.trim(),
          website: form.elements.website.value
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        status.className = 'form-status ok';
        status.textContent = form.dataset.successText || 'message sent — thanks!';
        form.reset();
        counter.textContent = '0/5000';
      } else {
        status.className = 'form-status err';
        status.textContent = data.error || form.dataset.errorText || 'something went wrong';
      }
    } catch {
      status.className = 'form-status err';
      status.textContent = 'network error, try again later';
    } finally {
      button.disabled = false;
    }
  });
}
