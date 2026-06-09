const express = require('express');
const { asyncWrap } = require('../middleware/errors');
const { adminAuth } = require('../middleware/adminAuth');
const { csvCell } = require('../lib/sanitize');

const CONTACTS_SQL =
  'SELECT id, name, email, message, ip, user_agent, created_at FROM contacts ORDER BY id DESC';

function createAdminRouter({ db, limiter }) {
  const router = express.Router();
  router.use(limiter, adminAuth);

  router.get('/contacts', asyncWrap(async (req, res) => {
    const { rows } = await db.query(CONTACTS_SQL);
    res.json(rows);
  }));

  router.get('/contacts.csv', asyncWrap(async (req, res) => {
    const { rows } = await db.query(CONTACTS_SQL);
    const header = 'id,name,email,message,ip,user_agent,created_at';
    const lines = rows.map((r) =>
      [r.id, r.name, r.email, (r.message || '').replace(/\r?\n/g, ' '), r.ip, r.user_agent, r.created_at]
        .map(csvCell)
        .join(',')
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.send([header, ...lines].join('\n'));
  }));

  return router;
}

module.exports = { createAdminRouter };
