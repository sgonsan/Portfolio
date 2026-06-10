const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SLIDING_REFRESH_MS = 12 * 60 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const BCRYPT_COST = 11;

// Burned on unknown usernames so missing and wrong-password cases cost
// the same bcrypt time (no user-enumeration timing signal).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_COST);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function createAuthService(db) {
  return {
    async login(username, password, ip) {
      const { rows } = await db.query(
        'SELECT id, username, password_hash, disabled, failed_attempts, locked_until FROM admin_users WHERE username = $1',
        [username]
      );
      const user = rows[0];
      const ok = await bcrypt.compare(String(password), user?.password_hash ?? DUMMY_HASH);

      if (!user || user.disabled) return null;
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return { locked: true };
      }
      if (!ok) {
        const fails = user.failed_attempts + 1;
        await db.query(
          'UPDATE admin_users SET failed_attempts = $1, locked_until = $2 WHERE id = $3',
          [fails, fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS) : null, user.id]
        );
        return null;
      }

      await db.query(
        'UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login = now() WHERE id = $1',
        [user.id]
      );
      const token = crypto.randomBytes(32).toString('hex');
      await db.query(
        'INSERT INTO admin_sessions (user_id, token_hash, expires_at, ip) VALUES ($1, $2, $3, $4)',
        [user.id, hashToken(token), new Date(Date.now() + SESSION_TTL_MS), ip]
      );
      return { token, user: { id: user.id, username: user.username } };
    },

    async validateSession(token) {
      if (!token) return null;
      const { rows } = await db.query(
        `SELECT s.id AS session_id, s.expires_at, u.id, u.username, u.disabled
         FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
         WHERE s.token_hash = $1`,
        [hashToken(token)]
      );
      const row = rows[0];
      if (!row || row.disabled) return null;
      const expires = new Date(row.expires_at);
      if (expires <= new Date()) {
        await db.query('DELETE FROM admin_sessions WHERE id = $1', [row.session_id]);
        return null;
      }
      // Sliding expiry: refresh when less than half the TTL remains.
      if (expires - Date.now() < SLIDING_REFRESH_MS) {
        await db.query('UPDATE admin_sessions SET expires_at = $1 WHERE id = $2', [
          new Date(Date.now() + SESSION_TTL_MS),
          row.session_id
        ]);
      }
      return { id: row.id, username: row.username };
    },

    async logout(token) {
      if (!token) return;
      await db.query('DELETE FROM admin_sessions WHERE token_hash = $1', [hashToken(token)]);
    },

    async createUser(username, password) {
      if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username || '')) {
        return { error: 'Username must be 3-32 chars (letters, digits, _ -)' };
      }
      if (typeof password !== 'string' || password.length < 10) {
        return { error: 'Password must be at least 10 characters' };
      }
      const hash = await bcrypt.hash(password, BCRYPT_COST);
      try {
        const { rows } = await db.query(
          'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
          [username, hash]
        );
        return { user: rows[0] };
      } catch (err) {
        if (err.code === '23505') return { error: 'Username already exists' };
        throw err;
      }
    },

    async setPassword(userId, password) {
      if (typeof password !== 'string' || password.length < 10) {
        return { error: 'Password must be at least 10 characters' };
      }
      const hash = await bcrypt.hash(password, BCRYPT_COST);
      await db.query(
        'UPDATE admin_users SET password_hash = $1, failed_attempts = 0, locked_until = NULL WHERE id = $2',
        [hash, userId]
      );
      // Password change kills existing sessions for that user.
      await db.query('DELETE FROM admin_sessions WHERE user_id = $1', [userId]);
      return { ok: true };
    },

    async setDisabled(userId, disabled) {
      await db.query('UPDATE admin_users SET disabled = $1 WHERE id = $2', [!!disabled, userId]);
      if (disabled) {
        await db.query('DELETE FROM admin_sessions WHERE user_id = $1', [userId]);
      }
      return { ok: true };
    },

    async listUsers() {
      const { rows } = await db.query(
        'SELECT id, username, disabled, last_login, created_at FROM admin_users ORDER BY id'
      );
      return rows;
    }
  };
}

module.exports = { createAuthService, SESSION_TTL_MS };
