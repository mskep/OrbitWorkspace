const crypto = require('crypto');

/**
 * SyncQueue — SQLite-backed queue of pending sync operations.
 *
 * When the user creates/updates/deletes a note/link/etc locally,
 * the change is enqueued here. The SyncManager drains the queue
 * by encrypting and pushing blobs to the server.
 *
 * Table: sync_queue
 *   id         TEXT PRIMARY KEY
 *   op_id      TEXT UNIQUE     — idempotency key sent to server
 *   entity_type TEXT            — 'note', 'link', 'file_ref', 'workspace', 'user_settings'
 *   entity_id  TEXT            — local entity ID
 *   action     TEXT            — 'upsert' or 'delete'
 *   version    INTEGER         — monotonically increasing per entity
 *   payload    TEXT            — JSON plaintext (will be encrypted before push)
 *   created_at INTEGER         — unix timestamp
 *   status     TEXT            — 'pending', 'in_flight', 'done', 'failed'
 */
class SyncQueue {
  constructor(db) {
    this.db = db;
    // Tables are created by migration 004_sync_queue_v2 in database/index.js
  }

  /**
   * Enqueue a local change for sync.
   * Automatically computes the next version for the entity.
   */
  enqueue(entityType, entityId, action, payload) {
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomBytes(16).toString('hex');
    const opId = crypto.randomUUID();

    // Get or create version
    const version = this._nextVersion(entityType, entityId);

    this.db.prepare(`
      INSERT INTO sync_queue (id, op_id, entity_type, entity_id, action, version, payload, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(id, opId, entityType, entityId, action, version, payload ? JSON.stringify(payload) : null, now);

    return { id, opId, version };
  }

  /**
   * Get all pending operations, ordered by creation time.
   * Marks them as 'in_flight' to prevent double-processing.
   */
  drain(limit = 100) {
    const rows = this.db.prepare(
      `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`
    ).all(limit);

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(',');
      this.db.prepare(
        `UPDATE sync_queue SET status = 'in_flight' WHERE id IN (${placeholders})`
      ).run(...ids);
    }

    return rows.map((r) => ({
      ...r,
      payload: r.payload ? JSON.parse(r.payload) : null,
    }));
  }

  /**
   * Mark operations as done (after successful push).
   */
  markDone(opIds) {
    if (opIds.length === 0) return;
    const placeholders = opIds.map(() => '?').join(',');
    this.db.prepare(
      `UPDATE sync_queue SET status = 'done' WHERE op_id IN (${placeholders})`
    ).run(...opIds);
  }

  /**
   * Reset in-flight operations back to pending (e.g. after crash or network error).
   */
  resetInFlight() {
    this.db.prepare(`UPDATE sync_queue SET status = 'pending' WHERE status = 'in_flight'`).run();
  }

  /**
   * Mark operations as failed.
   */
  markFailed(opIds) {
    if (opIds.length === 0) return;
    const placeholders = opIds.map(() => '?').join(',');
    this.db.prepare(
      `UPDATE sync_queue SET status = 'failed' WHERE op_id IN (${placeholders})`
    ).run(...opIds);
  }

  /**
   * Clean up completed operations older than maxAge seconds.
   */
  cleanup(maxAgeSeconds = 7 * 24 * 3600) {
    const cutoff = Math.floor(Date.now() / 1000) - maxAgeSeconds;
    this.db.prepare(`DELETE FROM sync_queue WHERE status = 'done' AND created_at < ?`).run(cutoff);
  }

  /**
   * Get pending count.
   */
  pendingCount() {
    return this.db.prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`).get().count;
  }

  // ============================================================
  // SERVER CLOCK TRACKING
  // ============================================================

  getServerClock(entityType = '_global') {
    const row = this.db.prepare(
      `SELECT server_clock FROM sync_cursors WHERE entity_type = ?`
    ).get(entityType);
    return row ? row.server_clock : 0;
  }

  setServerClock(entityType, clock) {
    this.db.prepare(`
      INSERT INTO sync_cursors (entity_type, server_clock) VALUES (?, ?)
      ON CONFLICT(entity_type) DO UPDATE SET server_clock = excluded.server_clock
    `).run(entityType, clock);
  }

  // ============================================================
  // VERSION TRACKING
  // ============================================================

  _nextVersion(entityType, entityId) {
    const row = this.db.prepare(
      `SELECT version FROM sync_versions WHERE entity_type = ? AND entity_id = ?`
    ).get(entityType, entityId);

    const next = row ? row.version + 1 : 1;

    this.db.prepare(`
      INSERT INTO sync_versions (entity_type, entity_id, version) VALUES (?, ?, ?)
      ON CONFLICT(entity_type, entity_id) DO UPDATE SET version = excluded.version
    `).run(entityType, entityId, next);

    return next;
  }

  getVersion(entityType, entityId) {
    const row = this.db.prepare(
      `SELECT version FROM sync_versions WHERE entity_type = ? AND entity_id = ?`
    ).get(entityType, entityId);
    return row ? row.version : 0;
  }

  /**
   * Set version for an entity (e.g. after receiving from server).
   */
  setVersion(entityType, entityId, version) {
    this.db.prepare(`
      INSERT INTO sync_versions (entity_type, entity_id, version) VALUES (?, ?, ?)
      ON CONFLICT(entity_type, entity_id) DO UPDATE SET version = excluded.version
    `).run(entityType, entityId, version);
  }
}

module.exports = SyncQueue;
