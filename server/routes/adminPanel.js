// Panel data APIs: content editing, section ordering, account management,
// contact messages. Everything behind requireSession.

const express = require('express');
const { asyncWrap } = require('../middleware/errors');
const { requireSession } = require('../middleware/session');
const { csvCell } = require('../lib/sanitize');

const CONTACTS_SQL =
  'SELECT id, name, email, message, ip, user_agent, created_at FROM contacts ORDER BY id DESC';

function createAdminPanelRouter({ db, authService, contentService }) {
  const router = express.Router();
  router.use(requireSession(authService));

  // ----- content -----
  router.get('/content', asyncWrap(async (req, res) => {
    res.json(await contentService.get());
  }));

  router.put('/content/:section', asyncWrap(async (req, res) => {
    const result = await contentService.saveSection(
      req.params.section,
      req.body?.fields,
      req.adminUser.username
    );
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  }));

  router.put('/sections', asyncWrap(async (req, res) => {
    const result = await contentService.saveOrder(req.body?.order);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  }));

  // ----- accounts -----
  router.get('/users', asyncWrap(async (req, res) => {
    res.json(await authService.listUsers());
  }));

  router.post('/users', asyncWrap(async (req, res) => {
    const { username, password } = req.body || {};
    const result = await authService.createUser(username, password);
    if (result.error) return res.status(400).json({ error: result.error });
    res.status(201).json(result.user);
  }));

  router.patch('/users/:id', asyncWrap(async (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid user id' });
    const { disabled, password } = req.body || {};

    if (disabled !== undefined) {
      if (userId === req.adminUser.id && disabled) {
        return res.status(400).json({ error: 'Cannot disable your own account' });
      }
      await authService.setDisabled(userId, disabled);
    }
    if (password !== undefined) {
      const result = await authService.setPassword(userId, password);
      if (result.error) return res.status(400).json({ error: result.error });
    }
    res.json({ ok: true });
  }));

  // ----- contacts -----
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

module.exports = { createAdminPanelRouter };
