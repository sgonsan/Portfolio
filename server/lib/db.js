const { Pool } = require('pg');

// TLS always verifies certificates. For servers with a private CA, supply it
// via DATABASE_CA_CERT instead of disabling verification.
function buildSslConfig(env = process.env) {
  const flag = String(env.DATABASE_SSL ?? '').trim().toLowerCase();
  if (!['true', '1', 'require', 'on', 'yes'].includes(flag)) return false;
  return env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT } : true;
}

function createPool(env = process.env) {
  return new Pool({
    connectionString: env.DATABASE_URL,
    ssl: buildSslConfig(env),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  });
}

module.exports = { createPool, buildSslConfig };
