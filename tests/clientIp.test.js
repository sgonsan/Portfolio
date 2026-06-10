import { describe, it, expect } from 'vitest';
import { createClientIp } from '../server/lib/clientIp';

// Minimal req stub: clientIp only reads headers + req.ip.
const req = (headers = {}, ip = '10.0.0.1') => ({ headers, ip });
const cfHeader = (cf, extra = {}) => ({ 'cf-connecting-ip': cf, ...extra });

describe('clientIp — fail closed by default', () => {
  const clientIp = createClientIp({}); // no trust config

  it('ignores CF-Connecting-IP entirely and returns req.ip', () => {
    expect(clientIp(req(cfHeader('203.0.113.7')))).toBe('10.0.0.1');
  });

  it('returns req.ip when no header is present', () => {
    expect(clientIp(req())).toBe('10.0.0.1');
  });
});

describe('clientIp — TRUST_CF_CONNECTING_IP (operator asserts CF-locked origin)', () => {
  const clientIp = createClientIp({ TRUST_CF_CONNECTING_IP: 'true' });

  it('honors a valid IPv4 / IPv6 from the header', () => {
    expect(clientIp(req(cfHeader('203.0.113.7')))).toBe('203.0.113.7');
    expect(clientIp(req(cfHeader('2001:db8::1')))).toBe('2001:db8::1');
  });

  it('trims surrounding whitespace before validating', () => {
    expect(clientIp(req(cfHeader('  198.51.100.4  ')))).toBe('198.51.100.4');
  });

  it('falls back to req.ip for a missing header', () => {
    expect(clientIp(req())).toBe('10.0.0.1');
  });

  it('falls back to req.ip when the header is not a valid IP (spoof guard)', () => {
    expect(clientIp(req(cfHeader('not-an-ip')))).toBe('10.0.0.1');
    expect(clientIp(req(cfHeader('999.999.999.999')))).toBe('10.0.0.1');
    expect(clientIp(req(cfHeader('1.2.3.4; DROP')))).toBe('10.0.0.1');
  });

  it('falls back to req.ip for empty or non-string header values', () => {
    expect(clientIp(req(cfHeader('')))).toBe('10.0.0.1');
    expect(clientIp(req(cfHeader(['203.0.113.7', '1.1.1.1'])))).toBe('10.0.0.1');
  });
});

describe('clientIp — CF_ORIGIN_SECRET (self-verifying, no firewall trust)', () => {
  const clientIp = createClientIp({ CF_ORIGIN_SECRET: 's3cr3t-from-cf-worker' });

  it('honors the header only when the origin secret matches', () => {
    const headers = cfHeader('203.0.113.7', { 'x-cf-origin-secret': 's3cr3t-from-cf-worker' });
    expect(clientIp(req(headers))).toBe('203.0.113.7');
  });

  it('ignores a spoofed header when the secret is wrong or missing (fail closed)', () => {
    expect(clientIp(req(cfHeader('203.0.113.7', { 'x-cf-origin-secret': 'wrong' })))).toBe('10.0.0.1');
    expect(clientIp(req(cfHeader('203.0.113.7')))).toBe('10.0.0.1'); // no secret header at all
  });

  it('the secret cannot be bypassed even with TRUST flag also set off', () => {
    // secret mode takes precedence; a valid IP with no secret stays untrusted.
    expect(clientIp(req(cfHeader('8.8.8.8')))).toBe('10.0.0.1');
  });
});
