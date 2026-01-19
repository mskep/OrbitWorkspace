const crypto = require('crypto');

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * InboxRepository - Manages system messages for users
 */
class InboxRepository {
  constructor(db, encryptionService) {
    this.db = db;
    this.encryption = encryptionService;
  }

  /**
   * Create new inbox message
   */
  create({ userId, type, title, message, metadataJson = null }) {
    const now = Math.floor(Date.now() / 1000);
    const id = generateId();
    const messageEncrypted = this.encryption.encrypt(message);

    const stmt = this.db.prepare(`
      INSERT INTO inbox_messages (id, user_id, type, title, message_encrypted, metadata_json, is_read, created_at, read_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL)
    `);

    stmt.run(id, userId, type, title, messageEncrypted, metadataJson ? JSON.stringify(metadataJson) : null, now);
    return this.findById(id);
  }

  /**
   * Find message by ID
   */
  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM inbox_messages WHERE id = ?');
    const msg = stmt.get(id);
    if (msg) {
      msg.message = this.encryption.decrypt(msg.message_encrypted);
      msg.metadata = msg.metadata_json ? JSON.parse(msg.metadata_json) : null;
      delete msg.message_encrypted;
      delete msg.metadata_json;
    }
    return msg;
  }

  /**
   * Find all messages for a user
   */
  findByUserId(userId, includeRead = true) {
    let stmt;
    let messages;

    if (includeRead) {
      stmt = this.db.prepare('SELECT * FROM inbox_messages WHERE user_id = ? ORDER BY created_at DESC');
      messages = stmt.all(userId);
    } else {
      stmt = this.db.prepare('SELECT * FROM inbox_messages WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC');
      messages = stmt.all(userId);
    }

    return messages.map(msg => ({
      ...msg,
      message: this.encryption.decrypt(msg.message_encrypted),
      metadata: msg.metadata_json ? JSON.parse(msg.metadata_json) : null,
      message_encrypted: undefined,
      metadata_json: undefined
    }));
  }

  /**
   * Get unread messages for a user
   */
  findUnread(userId) {
    return this.findByUserId(userId, false);
  }

  /**
   * Mark message as read
   */
  markAsRead(id) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE inbox_messages SET is_read = 1, read_at = ? WHERE id = ?');
    stmt.run(now, id);
  }

  /**
   * Mark all messages as read for a user
   */
  markAllAsRead(userId) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE inbox_messages SET is_read = 1, read_at = ? WHERE user_id = ? AND is_read = 0');
    stmt.run(now, userId);
  }

  /**
   * Delete message
   */
  delete(id) {
    const stmt = this.db.prepare('DELETE FROM inbox_messages WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Delete all read messages for a user
   */
  deleteAllRead(userId) {
    const stmt = this.db.prepare('DELETE FROM inbox_messages WHERE user_id = ? AND is_read = 1');
    const result = stmt.run(userId);
    return result.changes;
  }

  /**
   * Count unread messages for a user
   */
  countUnread(userId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM inbox_messages WHERE user_id = ? AND is_read = 0');
    return stmt.get(userId).count;
  }

  /**
   * Count total messages for a user
   */
  count(userId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM inbox_messages WHERE user_id = ?');
    return stmt.get(userId).count;
  }

  /**
   * Check if user owns message
   */
  isOwner(messageId, userId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM inbox_messages WHERE id = ? AND user_id = ?');
    return stmt.get(messageId, userId).count > 0;
  }

  /**
   * Create badge assigned message
   */
  createBadgeAssignedMessage(userId, badgeName, assignedByUsername) {
    return this.create({
      userId,
      type: 'badge-assigned',
      title: 'New Badge Awarded',
      message: `You have been awarded the "${badgeName}" badge by ${assignedByUsername}.`,
      metadataJson: { badgeName, assignedBy: assignedByUsername }
    });
  }

  /**
   * Create badge revoked message
   */
  createBadgeRevokedMessage(userId, badgeName, revokedByUsername) {
    return this.create({
      userId,
      type: 'badge-revoked',
      title: 'Badge Removed',
      message: `The "${badgeName}" badge has been removed by ${revokedByUsername}.`,
      metadataJson: { badgeName, revokedBy: revokedByUsername }
    });
  }

  /**
   * Create role changed message
   */
  createRoleChangedMessage(userId, oldRole, newRole, changedByUsername) {
    return this.create({
      userId,
      type: 'role-changed',
      title: 'Role Updated',
      message: `Your role has been changed from ${oldRole} to ${newRole} by ${changedByUsername}.`,
      metadataJson: { oldRole, newRole, changedBy: changedByUsername }
    });
  }

  /**
   * Create system notification
   */
  createSystemNotification(userId, title, message, metadata = null) {
    return this.create({
      userId,
      type: 'system-notification',
      title,
      message,
      metadataJson: metadata
    });
  }
}

module.exports = InboxRepository;
