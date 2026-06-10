// Public tracking beacons. Tolerant by design: tracking failures must
// never surface to visitors.
const express = require('express');
const { asyncWrap } = require('../middleware/errors');

function createTrackRouter({ analytics, limiter }) {
  const router = express.Router();
  router.use(limiter);

  router.post('/pv', asyncWrap(async (req, res) => {
    const { lang, vw, ref } = req.body || {};
    const id = await analytics.recordPageview({
      ip: req.clientIp || req.ip || '',
      ua: req.headers['user-agent'] || '',
      ref,
      lang,
      vw
    });
    res.json({ id: String(id) });
  }));

  router.post('/sv', asyncWrap(async (req, res) => {
    const { id, sections, scroll } = req.body || {};
    const result = await analytics.recordSections(Number(id), sections, scroll);
    if (result.error) console.warn('Rejected section beacon:', result.error);
    res.status(204).end();
  }));

  return router;
}

module.exports = { createTrackRouter };
