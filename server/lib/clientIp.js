// Real client IP behind Cloudflare -> Traefik -> Express.
//
// CF-Connecting-IP carries the true visitor, but it is an unauthenticated
// request header: anyone who can reach the origin directly (bypassing
// Cloudflare) can forge it and rotate it per request to evade rate limiting,
// account lockout and audit logging. Peer-checking the socket against
// Cloudflare's IP ranges does NOT work in this topology — the immediate peer
// is always Traefik, never a Cloudflare edge — so trust is gated two ways and
// FAILS CLOSED by default (falls back to req.ip, derived from the hardened
// `trust proxy` chain):
//
//   1. CF_ORIGIN_SECRET (preferred): a secret value injected as a request
//      header by a Cloudflare Transform Rule / Worker on our zone. A direct
//      hit on the origin can't supply it, so a spoofed CF-Connecting-IP is
//      ignored. Self-verifying — needs no firewall trust.
//   2. TRUST_CF_CONNECTING_IP=true: the operator asserts the origin only
//      accepts Cloudflare ingress (firewall allowlist / Authenticated Origin
//      Pulls). Spoofable unless that lockdown is real, so it must be opted in.
//
// With neither set, CF-Connecting-IP is never trusted for IP-keyed decisions.
const net = require('net');
const crypto = require('crypto');

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const truthy = (v) => /^(true|1|on|yes)$/i.test(String(v ?? '').trim());

// Factory: binds the trust policy from env once at startup.
function createClientIp(env = process.env) {
  const secret = (env.CF_ORIGIN_SECRET || '').trim();
  const assertLocked = truthy(env.TRUST_CF_CONNECTING_IP);

  return function clientIp(req) {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf !== 'string') return req.ip;
    const candidate = cf.trim();
    if (!net.isIP(candidate)) return req.ip;

    // Mode 1: verify the CF-injected secret proves the request came through us.
    if (secret) {
      const got = req.headers['x-cf-origin-secret'];
      return (typeof got === 'string' && safeEqual(got, secret)) ? candidate : req.ip;
    }

    // Mode 2: operator asserts the origin is locked to Cloudflare ingress.
    if (assertLocked) return candidate;

    // Default: fail closed — don't trust an unauthenticated header.
    return req.ip;
  };
}

module.exports = { createClientIp };
