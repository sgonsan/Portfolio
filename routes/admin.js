const express = require('express');
const db = require('../db');
const router = express.Router();

function basicAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return res.set('WWW-Authenticate', 'Basic').status(401).send('Auth required');
  }
  const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) return next();
  return res.status(403).send('Forbidden');
}

router.get('/contacts', basicAuth, (req, res) => {
  const rows = db.prepare('SELECT id, name, email, message, ip, user_agent, created_at FROM contacts ORDER BY id DESC').all();
  res.json(rows);
});

router.get('/contacts.csv', basicAuth, (req, res) => {
  const rows = db.prepare('SELECT id, name, email, message, ip, user_agent, created_at FROM contacts ORDER BY id DESC').all();
  const header = 'id,name,email,message,ip,user_agent,created_at';
  const csv = [header, ...rows.map(r => (
    [r.id, r.name, r.email, (r.message || '').replace(/\n/g, ' '), r.ip || '', (r.user_agent || '').replace(/,/g, ';'), r.created_at]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ))].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
  res.send(csv);
});

module.exports = router;
