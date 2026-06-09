const express = require('express');
const { asyncWrap } = require('../middleware/errors');
const { requireSession } = require('../middleware/session');

function createAdminAnalyticsRouter({ analytics, authService }) {
  const router = express.Router();
  router.use(requireSession(authService));

  router.get('/summary', asyncWrap(async (req, res) => {
    res.json(await analytics.summary(req.query));
  }));

  router.get('/timeseries', asyncWrap(async (req, res) => {
    res.json(await analytics.timeseries(req.query));
  }));

  router.get('/hours', asyncWrap(async (req, res) => {
    res.json(await analytics.hourHistogram(req.query));
  }));

  router.get('/top', asyncWrap(async (req, res) => {
    const result = await analytics.topDimension(String(req.query.dim || ''), req.query);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  }));

  router.get('/sections', asyncWrap(async (req, res) => {
    res.json(await analytics.sectionStats(req.query));
  }));

  return router;
}

module.exports = { createAdminAnalyticsRouter };
