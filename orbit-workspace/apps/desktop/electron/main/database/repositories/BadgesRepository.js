/**
 * BadgesRepository - Manages badges and user badge assignments
 */
class BadgesRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get all available badges
   */
  findAll() {
    const stmt = this.db.prepare('SELECT * FROM badges ORDER BY created_at ASC');
    return stmt.all();
  }

  /**
   * Find badge by ID
   */
  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM badges WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Find badge by name
   */
  findByName(name) {
    const stmt = this.db.prepare('SELECT * FROM badges WHERE name = ?');
    return stmt.get(name);
  }

  /**
   * Get badges for a user
   */
  findByUserId(userId) {
    const stmt = this.db.prepare(`
      SELECT b.*, ub.assigned_by, ub.assigned_at
      FROM badges b
      INNER JOIN user_badges ub ON b.id = ub.badge_id
      WHERE ub.user_id = ?
      ORDER BY ub.assigned_at DESC
    `);
    return stmt.all(userId);
  }

  /**
   * Assign badge to user
   */
  assign(userId, badgeId, assignedBy) {
    const now = Math.floor(Date.now() / 1000);

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO user_badges (user_id, badge_id, assigned_by, assigned_at)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(userId, badgeId, assignedBy, now);
    return result.changes > 0; // Returns true if badge was newly assigned
  }

  /**
   * Revoke badge from user
   */
  revoke(userId, badgeId) {
    const stmt = this.db.prepare('DELETE FROM user_badges WHERE user_id = ? AND badge_id = ?');
    const result = stmt.run(userId, badgeId);
    return result.changes > 0; // Returns true if badge was removed
  }

  /**
   * Check if user has badge
   */
  hasBadge(userId, badgeId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM user_badges WHERE user_id = ? AND badge_id = ?');
    return stmt.get(userId, badgeId).count > 0;
  }

  /**
   * Get all users who have a specific badge
   */
  getUsersWithBadge(badgeId) {
    const stmt = this.db.prepare(`
      SELECT u.id, u.username, u.email, ub.assigned_at
      FROM users u
      INNER JOIN user_badges ub ON u.id = ub.user_id
      WHERE ub.badge_id = ?
      ORDER BY ub.assigned_at DESC
    `);
    return stmt.all(badgeId);
  }

  /**
   * Count badges for a user
   */
  count(userId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM user_badges WHERE user_id = ?');
    return stmt.get(userId).count;
  }
}

module.exports = BadgesRepository;
