// Panel data APIs: content editing, section ordering, account management,
// contact messages, photo upload. Everything behind requireSession.

const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const sharp = require('sharp');
const { asyncWrap } = require('../middleware/errors');
const { requireSession } = require('../middleware/session');
const { csvCell } = require('../lib/sanitize');
const { generatePreview } = require('../../scripts/gen-preview');

const ALLOWED_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ASSETS_DIR = path.join(__dirname, '../../public/assets');

// Validate magic bytes so Content-Type can't be spoofed.
function validImageMagic(buf, mime) {
  if (buf.length < 12) return false;
  if (mime === 'image/jpeg') return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  if (mime === 'image/png')  return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  if (mime === 'image/webp') return buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
                                    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  return false;
}

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

  // ----- photo -----
  router.post('/photo',
    express.raw({
      type: (req) => ALLOWED_PHOTO_MIME.includes((req.headers['content-type'] || '').split(';')[0].trim()),
      limit: '8mb'
    }),
    asyncWrap(async (req, res) => {
      const mime = (req.headers['content-type'] || '').split(';')[0].trim();
      if (!ALLOWED_PHOTO_MIME.includes(mime)) return res.status(415).json({ error: 'JPEG, PNG or WebP only' });
      if (!Buffer.isBuffer(req.body) || req.body.length < 16) return res.status(400).json({ error: 'empty or corrupt file' });
      if (!validImageMagic(req.body, mime)) return res.status(400).json({ error: 'file content does not match declared type' });

      const destTmp = path.join(ASSETS_DIR, 'personal-foto.tmp.jpg');
      const lowTmp  = path.join(ASSETS_DIR, 'personal-foto-low-res.tmp.jpg');
      const dest = path.join(ASSETS_DIR, 'personal-foto.jpg');
      const low  = path.join(ASSETS_DIR, 'personal-foto-low-res.jpg');

      // Re-encode rather than store the upload verbatim: .rotate() bakes in the
      // EXIF orientation and sharp drops all other metadata by default, so no
      // GPS/camera EXIF survives. Output is normalized JPEG at the two widths
      // the page's srcset requests (800w full, 400w low-res placeholder).
      try {
        await sharp(req.body)
          .rotate()
          .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82, mozjpeg: true })
          .toFile(destTmp);
        await sharp(req.body)
          .rotate()
          .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 50, mozjpeg: true })
          .toFile(lowTmp);
      } catch {
        await Promise.allSettled([fs.rm(destTmp, { force: true }), fs.rm(lowTmp, { force: true })]);
        return res.status(400).json({ error: 'could not process image' });
      }

      await fs.rename(destTmp, dest);
      await fs.rename(lowTmp, low);

      // Refresh the OG card so its photo matches the new upload (best-effort).
      generatePreview().catch((err) => console.error('Preview regen failed:', err.message));

      res.json({ ok: true });
    })
  );

  // ----- og preview -----
  // Regenerate assets/preview.png on demand. Surfaces the real error (e.g.
  // EACCES on the persistent volume) instead of failing silently on boot.
  router.post('/preview', asyncWrap(async (req, res) => {
    try {
      await generatePreview();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
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
