const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

const { createLimiters } = require('./middleware/limits');
const { notFound, errorHandler } = require('./middleware/errors');
const { createContactRouter } = require('./routes/contact');
const { createScoresRouter } = require('./routes/scores');
const { createSiteRouter } = require('./routes/site');
const { createAdminRouter } = require('./routes/admin');

const ROOT = path.join(__dirname, '..');

function createApp({ db, mailer, github, resolver, env = process.env }) {
  const app = express();

  // Behind a reverse proxy (Coolify/Traefik) req.ip must come from
  // X-Forwarded-For, but only for the configured number of hops —
  // otherwise rate limits are trivially spoofable.
  const hops = parseInt(env.TRUST_PROXY_HOPS ?? '0', 10);
  app.set('trust proxy', Number.isInteger(hops) && hops > 0 ? hops : false);
  app.disable('x-powered-by');

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
  app.use('/api', createSiteRouter({ db, github }));
  app.use('/api/admin', createAdminRouter({ db, limiter: limiters.admin }));
  app.use('/api', notFound);

  // Astro build output: hashed assets are immutable.
  app.use('/_astro', express.static(path.join(ROOT, 'dist/_astro'), {
    maxAge: '1y',
    immutable: true
  }));
  app.use('/assets', express.static(path.join(ROOT, 'public/assets'), { maxAge: '30d' }));
  app.use(express.static(path.join(ROOT, 'dist')));
  app.use(express.static(path.join(ROOT, 'public')));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
