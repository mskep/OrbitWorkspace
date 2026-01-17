const Database = require('better-sqlite3');
const path = require('path');

class SqliteStore {
  constructor(userDataPath) {
    const dbPath = path.join(userDataPath, 'db.sqlite');
    this.db = new Database(dbPath);
    this.initTables();
  }

  initTables() {
    // Action events table (for history/audit)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS action_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        tool_id TEXT,
        payload TEXT,
        status TEXT,
        error TEXT
      )
    `);

    // Index for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_action_events_timestamp
      ON action_events(timestamp DESC)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_action_events_type
      ON action_events(type)
    `);
  }

  logAction(event) {
    const stmt = this.db.prepare(`
      INSERT INTO action_events (timestamp, type, tool_id, payload, status, error)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      event.timestamp || Date.now(),
      event.type,
      event.toolId || null,
      event.payload ? JSON.stringify(event.payload) : null,
      event.status || 'success',
      event.error || null
    );
  }

  getActions({ limit = 50, offset = 0, type = null, toolId = null } = {}) {
    let query = 'SELECT * FROM action_events WHERE 1=1';
    const params = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (toolId) {
      query += ' AND tool_id = ?';
      params.push(toolId);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  searchActions(query) {
    const stmt = this.db.prepare(`
      SELECT * FROM action_events
      WHERE type LIKE ? OR tool_id LIKE ? OR payload LIKE ?
      ORDER BY timestamp DESC
      LIMIT 100
    `);

    const searchTerm = `%${query}%`;
    return stmt.all(searchTerm, searchTerm, searchTerm);
  }

  close() {
    this.db.close();
  }
}

module.exports = SqliteStore;
