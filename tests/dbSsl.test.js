import { describe, it, expect } from 'vitest';
import { buildSslConfig } from '../server/lib/db';

describe('buildSslConfig', () => {
  it('enables TLS for every accepted truthy variant (case-insensitive, trimmed)', () => {
    for (const v of ['true', '1', 'require', 'on', 'yes', 'TRUE', 'Require', '  yes  ']) {
      expect(buildSslConfig({ DATABASE_SSL: v }), v).toBe(true);
    }
  });

  it('disables TLS for unset, empty or unrecognized values', () => {
    expect(buildSslConfig({})).toBe(false);
    for (const v of ['', 'false', '0', 'no', 'off', 'enabled', 'disable', 'sslmode']) {
      expect(buildSslConfig({ DATABASE_SSL: v }), v).toBe(false);
    }
  });

  it('returns the CA cert object when one is supplied alongside an enabled flag', () => {
    expect(buildSslConfig({ DATABASE_SSL: 'require', DATABASE_CA_CERT: '-----BEGIN CERT-----' }))
      .toEqual({ ca: '-----BEGIN CERT-----' });
  });

  it('ignores a CA cert when TLS is not enabled', () => {
    expect(buildSslConfig({ DATABASE_SSL: 'false', DATABASE_CA_CERT: '-----BEGIN CERT-----' }))
      .toBe(false);
  });
});
