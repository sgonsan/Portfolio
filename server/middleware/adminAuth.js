const crypto = require('crypto');

// Hash both sides before comparing: timingSafeEqual requires equal-length
// buffers, and hashing removes any length leak.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function adminAuth(req, res, next) {
  const { ADMIN_USER, ADMIN_PASS } = process.env;
  // Refuse to run with credentials unset rather than comparing against undefined.
  if (!ADMIN_USER || !ADMIN_PASS) {
    return res.status(503).json({ error: 'Admin endpoints disabled' });
  }

  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return res
      .set('WWW-Authenticate', 'Basic realm="admin", charset="UTF-8"')
      .status(401)
      .json({ error: 'Authentication required' });
  }

  // Split on the FIRST colon only — passwords may contain ':'.
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  const user = idx < 0 ? decoded : decoded.slice(0, idx);
  const pass = idx < 0 ? '' : decoded.slice(idx + 1);

  // Bitwise & so both comparisons always run (no early-exit timing signal).
  const ok = safeEqual(user, ADMIN_USER) & safeEqual(pass, ADMIN_PASS);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  next();
}

module.exports = { adminAuth, safeEqual };
