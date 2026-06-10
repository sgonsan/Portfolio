import { describe, it, expect } from 'vitest';
import { clientIp } from '../server/lib/clientIp';

// Minimal req stub: clientIp only reads headers + req.ip.
const req = (cf, ip = '10.0.0.1') =>
  ({ headers: cf === undefined ? {} : { 'cf-connecting-ip': cf }, ip });

describe('clientIp', () => {
  it('returns a valid IPv4 from CF-Connecting-IP', () => {
    expect(clientIp(req('203.0.113.7'))).toBe('203.0.113.7');
  });

  it('returns a valid IPv6 from CF-Connecting-IP', () => {
    expect(clientIp(req('2001:db8::1'))).toBe('2001:db8::1');
  });

  it('trims surrounding whitespace before validating', () => {
    expect(clientIp(req('  198.51.100.4  '))).toBe('198.51.100.4');
  });

  it('falls back to req.ip when the header is absent', () => {
    expect(clientIp(req(undefined))).toBe('10.0.0.1');
  });

  it('falls back to req.ip when the header is not a valid IP (spoof guard)', () => {
    expect(clientIp(req('not-an-ip'))).toBe('10.0.0.1');
    expect(clientIp(req('999.999.999.999'))).toBe('10.0.0.1');
    expect(clientIp(req('1.2.3.4; DROP'))).toBe('10.0.0.1');
  });

  it('falls back to req.ip for an empty header value', () => {
    expect(clientIp(req(''))).toBe('10.0.0.1');
  });

  it('ignores a non-string (array) header value', () => {
    // Node would only produce an array for duplicated headers; must not crash
    // and must not trust it.
    expect(clientIp(req(['203.0.113.7', '1.1.1.1']))).toBe('10.0.0.1');
  });
});
