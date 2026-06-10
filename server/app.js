const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

const { createClientIp } = require('./lib/clientIp');
const { createLimiters } = require('./middleware/limits');
const { notFound, errorHandler } = require('./middleware/errors');
const { createContactRouter } = require('./routes/contact');
const { createScoresRouter } = require('./routes/scores');
const { createSiteRouter } = require('./routes/site');
const { createContentRouter } = require('./routes/content');
const { createAdminAuthRouter } = require('./routes/adminAuth');
const { createAdminPanelRouter } = require('./routes/adminPanel');
const { createAdminAnalyticsRouter } = require('./routes/adminAnalytics');
const { createTrackRouter } = require('./routes/track');

const ROOT = path.join(__dirname, '..');

function createApp({
  db,
  mailer,
  github,
  contentService,
  authService,
  analytics,
  ssrHandler,
  resolver,
  env = process.env
}) {
  const app = express();

  // Behind a reverse proxy (Coolify/Traefik) req.ip must come from
  // X-Forwarded-For, but only for the configured number of hops —
  // otherwise rate limits are trivially spoofable.
  const hops = parseInt(env.TRUST_PROXY_HOPS ?? '0', 10);
  app.set('trust proxy', Number.isInteger(hops) && hops > 0 ? hops : false);
  app.disable('x-powered-by');

  // Resolve the real visitor IP once (verified CF-Connecting-IP, else req.ip)
  // so rate limiting, contact logging and analytics all key on the same value.
  const clientIp = createClientIp(env);
  app.use((req, res, next) => {
    req.clientIp = clientIp(req);
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"]
        }
      },
      strictTransportSecurity: env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true }
        : false
    })
  );

  app.use(compression());
  app.use(express.json({ limit: '32kb' }));

  // Liveness probe — no DB side effects.
  app.get('/healthz', (req, res) => res.json({ ok: true }));

  const limiters = createLimiters();
  app.use('/api', limiters.api);
  app.use('/api/contact', createContactRouter({ db, mailer, resolver, limiter: limiters.contact }));
  app.use('/api/scores', createScoresRouter({ db, limiter: limiters.scoresWrite }));
  app.use('/api/content', createContentRouter({ contentService }));
  app.use('/api/t', createTrackRouter({ analytics, limiter: limiters.track }));
  app.use('/api', createSiteRouter({ db, github }));
  app.use('/api/admin/analytics', createAdminAnalyticsRouter({ analytics, authService }));
  app.use('/api/admin', createAdminAuthRouter({ authService, limiter: limiters.adminLogin, env }));
  app.use('/api/admin', createAdminPanelRouter({ db, authService, contentService }));
  app.use('/api', notFound);

  // Admin panel SPA shell (static; every data call is session-gated).
  app.use('/admin', express.static(path.join(__dirname, 'admin-ui')));
  app.get('/admin/{*splat}', (req, res) =>
    res.sendFile(path.join(__dirname, 'admin-ui', 'index.html'))
  );

  // Astro build output: hashed assets are immutable.
  app.use('/_astro', express.static(path.join(ROOT, 'dist/client/_astro'), {
    maxAge: '1y',
    immutable: true
  }));
  app.use('/assets', express.static(path.join(ROOT, 'public/assets'), { maxAge: '30d' }));
  app.use(express.static(path.join(ROOT, 'dist/client')));
  app.use(express.static(path.join(ROOT, 'public')));

  // SSR: Astro renders the page with live content from the service.
  if (ssrHandler) {
    app.use(async (req, res, next) => {
      try {
        const siteData = await contentService.get();
        ssrHandler(req, res, next, { siteData });
      } catch (err) {
        next(err);
      }
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
