const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  // Key on the real visitor IP (set by the clientIp middleware) rather than
  // the proxy IP. ipKeyGenerator normalizes IPv6 into a stable /64 key.
  keyGenerator: (req) => ipKeyGenerator(req.clientIp || req.ip)
};

// Factory so each app instance gets independent counters (and tests stay isolated).
function createLimiters() {
  return {
    // Broad safety net over the whole API surface.
    api: rateLimit({
      ...base,
      windowMs: 60 * 1000,
      limit: 120,
      message: { error: 'Too many requests, slow down' }
    }),

    // Contact form: one ACCEPTED submission per minute per IP. Validation
    // failures don't burn the slot, so users can correct mistakes.
    contact: rateLimit({
      ...base,
      windowMs: 60 * 1000,
      limit: 1,
      skipFailedRequests: true,
      message: { error: 'Please wait before sending another message' }
    }),

    // Leaderboard writes.
    scoresWrite: rateLimit({
      ...base,
      windowMs: 60 * 1000,
      limit: 5,
      message: { error: 'Too many score submissions' }
    }),

    // Brute-force shield on panel login.
    adminLogin: rateLimit({
      ...base,
      windowMs: 60 * 1000,
      limit: 5,
      message: { error: 'Too many attempts' }
    }),

    // Tracking beacons.
    track: rateLimit({
      ...base,
      windowMs: 60 * 1000,
      limit: 30,
      message: { error: 'Too many requests' }
    })
  };
}

module.exports = { createLimiters };
