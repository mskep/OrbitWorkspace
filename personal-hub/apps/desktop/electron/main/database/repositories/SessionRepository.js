const crypto = require('crypto');

/**
 * Generate unique ID
 */
function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate session token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * SessionRepository - Manages user sessions
 */
class SessionRepository {
  constructor(db) {
    this.db = db;
    this.defaultTTL = 30 * 24 * 60 * 60; // 30 days in seconds
  }

  /**
   * Create new session
   */
  create(userId, ttl = null) {
    const now = Math.floor(Date.now() / 1000);
    const id = generateId();
    const token = generateToken();
    const expiresAt = now + (ttl || this.defaultTTL);

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, token, created_at, expires_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, userId, token, now, expiresAt, now);

    return { id, userId, token, createdAt: now, expiresAt, lastActivityAt: now };
  }

  /**
   * Find session by token
   */
  findByToken(token) {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE token = ?');
    return stmt.get(token);
  }

  /**
   * Find session by ID
   */
  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Find all sessions for a user
   */
  findByUserId(userId) {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE user_id = ?');
    return stmt.all(userId);
  }

  /**
   * Update last activity time
   */
  updateActivity(token) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE sessions SET last_activity_at = ? WHERE token = ?');
    stmt.run(now, token);
  }

  /**
   * Delete session by token
   */
  deleteByToken(token) {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE token = ?');
    stmt.run(token);
  }

  /**
   * Delete session by ID
   */
  deleteById(id) {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Delete all sessions for a user
   */
  deleteByUserId(userId) {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE user_id = ?');
    stmt.run(userId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpired() {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('DELETE FROM sessions WHERE expires_at < ?');
    const result = stmt.run(now);
    return result.changes;
  }

  /**
   * Verify session is valid (not expired)
   */
  isValid(session) {
    if (!session) return false;
    const now = Math.floor(Date.now() / 1000);
    return session.expires_at > now;
  }

  /**
   * Extend session expiration
   */
  extend(token, additionalSeconds = null) {
    const now = Math.floor(Date.now() / 1000);
    const extension = additionalSeconds || this.defaultTTL;
    const newExpiry = now + extension;

    const stmt = this.db.prepare('UPDATE sessions SET expires_at = ?, last_activity_at = ? WHERE token = ?');
    stmt.run(newExpiry, now, token);
  }
}

module.exports = SessionRepository;
