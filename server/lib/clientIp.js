// Real client IP behind Cloudflare -> Traefik -> Express.
//
// `trust proxy` (configured from TRUST_PROXY_HOPS) only walks the
// X-Forwarded-For chain, which at best yields Cloudflare's edge IP — not the
// visitor. Cloudflare puts the true client in CF-Connecting-IP, so that header
// is authoritative when present and parseable. We only trust it because the
// app is exclusively reachable through Cloudflare; a direct hit on Traefik
// could forge it, which is why it is validated as a real IP before use and
// falls back to req.ip otherwise.
const net = require('net');

function clientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string') {
    const candidate = cf.trim();
    if (net.isIP(candidate)) return candidate;
  }
  return req.ip;
}

module.exports = { clientIp };
