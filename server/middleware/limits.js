const rateLimit = require('express-rate-limit');

const base = {
  standardHeaders: true,
  legacyHeaders: false
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

    // Brute-force shield on admin basic auth.
    admin: rateLimit({
      ...base,
      windowMs: 60 * 1000,
      limit: 10,
      message: { error: 'Too many attempts' }
    })
  };
}

module.exports = { createLimiters };
