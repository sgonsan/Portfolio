import { describe, it, expect } from 'vitest';
import { createAnalytics } from '../server/lib/analytics';

// Analytics needs only a db with .query; token sign/verify never touch it.
const noopDb = { query: async () => ({ rows: [] }) };
const make = () => createAnalytics(noopDb, null);

describe('signed pageview token', () => {
  it('verifies a token it just signed and recovers the id', () => {
    const a = make();
    const token = a.signPageview(42);
    expect(token).toMatch(/^42\.[0-9a-f]{32}$/);
    expect(a.verifyPageview(token)).toBe(42);
  });

  it('rejects a token with a forged-but-correct-length MAC (timing-safe path)', () => {
    const a = make();
    const [id, mac] = a.signPageview(7).split('.');
    const flipped = (mac[0] === 'a' ? 'b' : 'a') + mac.slice(1);
    expect(flipped).toHaveLength(mac.length);
    expect(a.verifyPageview(`${id}.${flipped}`)).toBeNull();
  });

  it('rejects a truncated MAC (length mismatch)', () => {
    const a = make();
    const [id, mac] = a.signPageview(7).split('.');
    expect(a.verifyPageview(`${id}.${mac.slice(0, 16)}`)).toBeNull();
  });

  it('rejects a tampered id with a stale MAC', () => {
    const a = make();
    const [, mac] = a.signPageview(7).split('.');
    expect(a.verifyPageview(`8.${mac}`)).toBeNull();
  });

  it('rejects tokens with no separator', () => {
    const a = make();
    expect(a.verifyPageview('deadbeef')).toBeNull();
  });

  it('rejects non-string and non-positive ids', () => {
    const a = make();
    expect(a.verifyPageview(undefined)).toBeNull();
    expect(a.verifyPageview(123)).toBeNull();
    expect(a.verifyPageview('0.' + 'a'.repeat(32))).toBeNull();
    expect(a.verifyPageview('-1.' + 'a'.repeat(32))).toBeNull();
  });

  it('does not verify a token signed by a different instance (ephemeral key)', () => {
    const a = make();
    const b = make();
    const token = a.signPageview(99);
    expect(a.verifyPageview(token)).toBe(99);
    expect(b.verifyPageview(token)).toBeNull();
  });
});
