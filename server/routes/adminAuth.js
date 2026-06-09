const express = require('express');
const { asyncWrap } = require('../middleware/errors');
const { requireSession, readSidCookie } = require('../middleware/session');

function cookieValue(token, { secure, maxAgeSeconds }) {
  const parts = [
    `sid=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function createAdminAuthRouter({ authService, limiter, env = process.env }) {
  const router = express.Router();
  const secure = env.NODE_ENV === 'production';

  router.post('/login', limiter, asyncWrap(async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Missing credentials' });
    }
    const result = await authService.login(username, password, req.ip || null);
    if (result?.locked) {
      return res.status(423).json({ error: 'Account temporarily locked' });
    }
    if (!result) return res.status(401).json({ error: 'Invalid credentials' });

    res.set('Set-Cookie', cookieValue(result.token, { secure, maxAgeSeconds: 86400 }));
    res.json({ user: result.user });
  }));

  router.post('/logout', requireSession(authService), asyncWrap(async (req, res) => {
    await authService.logout(readSidCookie(req));
    res.set('Set-Cookie', cookieValue('', { secure, maxAgeSeconds: 0 }));
    res.json({ ok: true });
  }));

  router.get('/me', requireSession(authService), (req, res) => {
    res.json({ user: req.adminUser });
  });

  return router;
}

module.exports = { createAdminAuthRouter };
