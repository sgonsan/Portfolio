// Session gate for panel APIs. Cookie parsed manually (single known name,
// no dependency). Mutations additionally require a same-origin Origin
// header — defense in depth alongside SameSite=Strict.

function readSidCookie(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'sid') return decodeURIComponent(rest.join('='));
  }
  return null;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients / same-origin GET-initiated
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function requireSession(authService) {
  return async (req, res, next) => {
    try {
      const user = await authService.validateSession(readSidCookie(req));
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
        return res.status(403).json({ error: 'Cross-origin request rejected' });
      }
      req.adminUser = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireSession, readSidCookie, sameOrigin };
