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

  // Aggregated endpoint: replaces 10 individual calls with 1 round trip.
  router.get('/dashboard', asyncWrap(async (req, res) => {
    const [summary, series, hours, sections, countries, referrers, devices, browsers, oses, langs] =
      await Promise.all([
        analytics.summary(req.query),
        analytics.timeseries(req.query),
        analytics.hourHistogram(req.query),
        analytics.sectionStats(req.query),
        analytics.topDimension('country', req.query),
        analytics.topDimension('referrer_host', req.query),
        analytics.topDimension('device', req.query),
        analytics.topDimension('browser', req.query),
        analytics.topDimension('os', req.query),
        analytics.topDimension('lang', req.query),
      ]);
    res.json({ summary, series, hours, sections, countries, referrers, devices, browsers, oses, langs });
  }));

  return router;
}

module.exports = { createAdminAnalyticsRouter };
