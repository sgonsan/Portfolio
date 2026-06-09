const express = require('express');
const dns = require('dns').promises;
const { asyncWrap } = require('../middleware/errors');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// DNS results cached so repeated submissions don't hammer the resolver.
const dnsCache = new Map();
const DNS_TTL = 10 * 60 * 1000;

async function domainAcceptsMail(domain, resolver = dns) {
  const hit = dnsCache.get(domain);
  if (hit && Date.now() < hit.exp) return hit.ok;

  let ok = false;
  try {
    const mx = await resolver.resolveMx(domain);
    ok = Array.isArray(mx) && mx.length > 0;
  } catch { /* fall through to A/AAAA */ }
  if (!ok) {
    try { ok = (await resolver.resolve4(domain)).length > 0; } catch { /* try AAAA */ }
  }
  if (!ok) {
    try { ok = (await resolver.resolve6(domain)).length > 0; } catch { /* unresolvable */ }
  }

  dnsCache.set(domain, { ok, exp: Date.now() + DNS_TTL });
  return ok;
}

function validateContact(body) {
  const { name = '', email = '', message = '', website = '' } = body || {};
  if (typeof name !== 'string' || typeof email !== 'string' ||
      typeof message !== 'string' || typeof website !== 'string') {
    return { error: 'Invalid submission' };
  }
  if (website) return { error: 'Invalid submission' }; // honeypot
  const trimmed = {
    name: name.trim().replace(/\s{2,}/g, ' '),
    email: email.trim(),
    message: message.trim()
  };
  if (!trimmed.name || !trimmed.email || !trimmed.message) return { error: 'Missing fields' };
  if (trimmed.name.length > 200) return { error: 'Name is too long' };
  if (trimmed.email.length > 320) return { error: 'Email is too long' };
  if (trimmed.message.length > 5000) return { error: 'Message is too long' };
  if (!EMAIL_REGEX.test(trimmed.email)) return { error: 'Invalid email format' };
  return { value: trimmed };
}

function createContactRouter({ db, mailer, resolver, limiter }) {
  const router = express.Router();

  router.post('/', limiter, asyncWrap(async (req, res) => {
    const { error, value } = validateContact(req.body);
    if (error) return res.status(400).json({ error });

    const domain = value.email.slice(value.email.lastIndexOf('@') + 1).toLowerCase();
    if (!(await domainAcceptsMail(domain, resolver))) {
      return res.status(400).json({ error: 'Email domain does not accept mail' });
    }

    // Log to DB; a DB failure must not block the mail.
    try {
      const ip = req.ip || null;
      const userAgent = (req.headers['user-agent'] || '').slice(0, 500) || null;
      await db.query(
        'INSERT INTO contacts (name, email, message, ip, user_agent) VALUES ($1, $2, $3, $4, $5)',
        [value.name, value.email, value.message, ip, userAgent]
      );
    } catch (dbErr) {
      console.error('DB insert error (contacts):', dbErr);
    }

    await mailer.sendContactMail(value);
    // Auto-reply failures are non-fatal: the owner already got the message.
    try {
      await mailer.sendAutoReply(value);
    } catch (replyErr) {
      console.error('Auto-reply failed:', replyErr);
    }

    res.json({ success: true, message: 'Message sent!' });
  }));

  return router;
}

module.exports = { createContactRouter, validateContact };
