const crypto = require('crypto');

/**
 * Generate unique ID
 */
function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * UserRepository - Manages user data in database
 */
class UserRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create new user
   */
  create({ username, email, passwordHash, role = 'USER', status = 'active' }) {
    const now = Math.floor(Date.now() / 1000);
    const id = generateId();

    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, status, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `);

    stmt.run(id, username, email.toLowerCase(), passwordHash, role, status, now);

    return this.findById(id);
  }

  /**
   * Find user by ID
   */
  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Find user by email
   */
  findByEmail(email) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email.toLowerCase());
  }

  /**
   * Find user by username
   */
  findByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username.toLowerCase());
  }

  /**
   * Find user by email OR username
   */
  findByIdentifier(identifier) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ? OR username = ?');
    const lower = identifier.toLowerCase();
    return stmt.get(lower, lower);
  }

  /**
   * Update last login time
   */
  updateLastLogin(userId) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?');
    stmt.run(now, userId);
  }

  /**
   * Update user role
   */
  updateRole(userId, role) {
    const stmt = this.db.prepare('UPDATE users SET role = ? WHERE id = ?');
    stmt.run(role, userId);
  }

  /**
   * Update user status (active/disabled)
   */
  updateStatus(userId, status) {
    const stmt = this.db.prepare('UPDATE users SET status = ? WHERE id = ?');
    stmt.run(status, userId);
  }

  /**
   * Update password hash
   */
  updatePassword(userId, passwordHash) {
    const stmt = this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    stmt.run(passwordHash, userId);
  }

  /**
   * Get all users (admin only)
   */
  findAll() {
    const stmt = this.db.prepare('SELECT id, username, email, role, status, created_at, last_login_at FROM users');
    return stmt.all();
  }

  /**
   * Count total users
   */
  count() {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
    return stmt.get().count;
  }

  /**
   * Count active users (logged in within last 30 days)
   */
  countActive(days = 30) {
    const threshold = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE last_login_at > ?');
    return stmt.get(threshold).count;
  }

  /**
   * Count disabled users
   */
  countDisabled() {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE status = ?');
    return stmt.get('disabled').count;
  }

  /**
   * Get users created per month (last N months)
   */
  getUsersPerMonth(months = 12) {
    const threshold = Math.floor(Date.now() / 1000) - (months * 30 * 24 * 60 * 60);

    const stmt = this.db.prepare(`
      SELECT
        strftime('%Y-%m', created_at, 'unixepoch') as month,
        COUNT(*) as count
      FROM users
      WHERE created_at > ?
      GROUP BY month
      ORDER BY month ASC
    `);

    return stmt.all(threshold);
  }
}

module.exports = UserRepository;
