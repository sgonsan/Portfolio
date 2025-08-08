// controllers/contactController.js
const nodemailer = require('nodemailer');
const dns = require('dns').promises;

// ---------------------- Mail Transport ----------------------
// Use Zoho (or your SMTP provider) via environment variables.
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,                   // e.g. 'smtp.zoho.com'
  port: Number(process.env.MAIL_PORT),           // 465 (SSL) or 587 (STARTTLS)
  secure: process.env.MAIL_SECURE === 'true',    // true for 465, false otherwise
  auth: {
    user: process.env.MAIL_USER,                 // e.g. 'contact@elbiti.com'
    pass: process.env.MAIL_PASS                  // password or app password
  }
});

// Verify SMTP connection on startup (optional but helpful)
transporter.verify()
  .then(() => console.log('SMTP ready'))
  .catch(err => console.error('SMTP error:', err));

// ---------------------- Utils ----------------------
// Lightweight email format check (client already validates, but never trust client)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory DNS cache (avoid hitting DNS on every request)
const dnsCache = new Map();
const DNS_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cacheGet(key) {
  const item = dnsCache.get(key);
  if (!item) return null;
  if (Date.now() > item.exp) { dnsCache.delete(key); return null; }
  return item.val;
}

function cacheSet(key, val) {
  dnsCache.set(key, { val, exp: Date.now() + DNS_TTL_MS });
}

/**
 * Check if the given domain seems to accept mail.
 * Strategy:
 *  - Prefer MX records.
 *  - Fallback to A/AAAA (RFC allows delivery to host when no MX present).
 * Returns true/false.
 */
async function domainAcceptsMail(domain) {
  const cached = cacheGet(`mx:${domain}`);
  if (cached !== null) return cached;

  let ok = false;

  try {
    const mx = await dns.resolveMx(domain);
    ok = Array.isArray(mx) && mx.length > 0;
  } catch { /* ignore */ }

  if (!ok) {
    try { ok = (await dns.resolve4(domain)).length > 0; } catch { }
    if (!ok) { try { ok = (await dns.resolve6(domain)).length > 0; } catch { } }
  }

  cacheSet(`mx:${domain}`, ok);
  return ok;
}

// ---------------------- Controller ----------------------
/**
 * Handle contact form submission.
 * - Validates input (server-side).
 * - Honeypot to catch bots.
 * - DNS MX/A check: if the email's domain does not accept mail -> 400.
 * - Sends one email to admin (always, if validation passes).
 * - Sends auto-reply to the user only if domain check passed.
 */
exports.handleContact = async (req, res) => {
  // Expecting body: { name, email, message, website? }
  // "website" is a hidden honeypot field (should be empty)
  const {
    name = '',
    email = '',
    message = '',
    website = ''
  } = req.body || {};

  // --- Basic validations ---
  // Honeypot: if filled, it's likely a bot
  if (website) return res.status(400).json({ error: 'Invalid submission' });

  if (!name.trim() || !email.trim() || !message.trim()) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Hard caps to prevent abuse / extremely large payloads
  if (name.length > 200) {
    return res.status(400).json({ error: 'Name is too long' });
  }
  if (email.length > 320) {
    return res.status(400).json({ error: 'Email is too long' });
  }
  if (message.length > 5000) {
    return res.status(400).json({ error: 'Message is too long' });
  }

  // Optional mild sanitization (trim, collapse excessive whitespace)
  const safeName = name.trim().replace(/\s{2,}/g, ' ');
  const safeEmail = email.trim();
  const safeMessage = message.trim();

  // Extract domain safely
  const atIndex = safeEmail.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === safeEmail.length - 1) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  const domain = safeEmail.slice(atIndex + 1).toLowerCase();

  try {
    // --- DNS MX/A check: block if domain likely won't accept mail ---
    const domainOk = await domainAcceptsMail(domain);
    if (!domainOk) {
      return res.status(400).json({ error: 'Email domain does not accept mail' });
    }

    // --- Send email to admin (you) ---
    await transporter.sendMail({
      // "from" must be your verified sender (your domain), not the user's email
      from: `"Portfolio Contact" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_ADMIN_USER || process.env.MAIL_USER,
      subject: `New message from ${safeName}`,
      // Use replyTo so you can reply directly to the user in your email client
      replyTo: `${safeName} <${safeEmail}>`,
      text:
        `Name: ${safeName}
Email: ${safeEmail}

${safeMessage}`
    });

    // --- Auto-reply to the user (optional) ---
    // We only rely on DNS checks (no SMTP probe here).
    // If you'd like to skip auto-replies entirely, remove this block.
    await transporter.sendMail({
      from: `"Sergio - elbiti.com" <${process.env.MAIL_USER}>`,
      to: safeEmail,
      subject: 'Thanks for contacting me!',
      text:
        `Hi ${safeName},

Thanks for your message. I'll get back to you soon.

Best,
Sergio`
    });

    return res.json({ success: true, message: 'Message sent!' });

  } catch (err) {
    // Do not leak internal details to the client
    console.error('Error sending contact message:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};
