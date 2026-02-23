const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * DatabaseManager - SQLite database with migrations
 *
 * Handles database initialization, schema migrations, and connection management
 */
class DatabaseManager {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.dbPath = path.join(userDataPath, 'orbit.db');
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize database connection and run migrations
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure user data directory exists
      if (!fs.existsSync(this.userDataPath)) {
        fs.mkdirSync(this.userDataPath, { recursive: true });
      }

      // Open database connection
      this.db = new Database(this.dbPath);

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');

      console.log('✅ Database connection established:', this.dbPath);

      // Run migrations
      await this.runMigrations();

      this.isInitialized = true;
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    // Create migrations table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL
      )
    `);

    // Get applied migrations
    const appliedMigrations = this.db.prepare('SELECT name FROM migrations').all();
    const appliedNames = new Set(appliedMigrations.map(m => m.name));

    // Define migrations in order
    const migrations = [
      {
        name: '001_initial_schema',
        sql: this._getInitialSchemaMigration()
      },
      {
        name: '002_sync_infrastructure',
        sql: this._getSyncInfrastructureMigration()
      },
    ];

    // Apply pending migrations
    for (const migration of migrations) {
      if (!appliedNames.has(migration.name)) {
        console.log(`📦 Applying migration: ${migration.name}`);

        // Run migration in transaction
        const applyMigration = this.db.transaction(() => {
          this.db.exec(migration.sql);
          this.db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(
            migration.name,
            Math.floor(Date.now() / 1000)
          );
        });

        applyMigration();
        console.log(`✅ Migration applied: ${migration.name}`);
      }
    }
  }

  /**
   * Get initial schema migration SQL
   */
  _getInitialSchemaMigration() {
    return `
      -- Users & Auth
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'USER',
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        last_login_at INTEGER,
        CONSTRAINT chk_role CHECK (role IN ('USER', 'PREMIUM', 'DEV', 'ADMIN')),
        CONSTRAINT chk_status CHECK (status IN ('active', 'disabled'))
      );

      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_username ON users(username);
      CREATE INDEX idx_users_status ON users(status);

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        last_activity_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_sessions_token ON sessions(token);
      CREATE INDEX idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX idx_sessions_expires ON sessions(expires_at);

      -- User Settings
      CREATE TABLE user_settings (
        user_id TEXT PRIMARY KEY,
        active_workspace_id TEXT,
        theme TEXT DEFAULT 'dark',
        language TEXT DEFAULT 'en',
        notifications_enabled INTEGER DEFAULT 1,
        auto_launch_enabled INTEGER DEFAULT 0,
        settings_json_encrypted TEXT,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Workspaces
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, name)
      );

      CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);

      -- Notes
      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content_encrypted TEXT NOT NULL,
        tags TEXT,
        is_pinned INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_notes_workspace_id ON notes(workspace_id);
      CREATE INDEX idx_notes_user_id ON notes(user_id);
      CREATE INDEX idx_notes_title ON notes(title);
      CREATE INDEX idx_notes_pinned ON notes(is_pinned);
      CREATE INDEX idx_notes_updated ON notes(updated_at DESC);

      -- Links
      CREATE TABLE links (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        url_encrypted TEXT NOT NULL,
        description_encrypted TEXT,
        tags TEXT,
        favicon_url TEXT,
        is_favorite INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_links_workspace_id ON links(workspace_id);
      CREATE INDEX idx_links_user_id ON links(user_id);
      CREATE INDEX idx_links_title ON links(title);
      CREATE INDEX idx_links_favorite ON links(is_favorite);

      -- File References
      CREATE TABLE file_references (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        path_encrypted TEXT NOT NULL,
        type TEXT NOT NULL,
        description_encrypted TEXT,
        tags TEXT,
        is_pinned INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT chk_file_type CHECK (type IN ('file', 'folder'))
      );

      CREATE INDEX idx_file_refs_workspace_id ON file_references(workspace_id);
      CREATE INDEX idx_file_refs_user_id ON file_references(user_id);
      CREATE INDEX idx_file_refs_type ON file_references(type);
      CREATE INDEX idx_file_refs_name ON file_references(name);

      -- Workspace Tools
      CREATE TABLE workspace_tools (
        workspace_id TEXT NOT NULL,
        tool_id TEXT NOT NULL,
        is_visible INTEGER DEFAULT 1,
        display_order INTEGER,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (workspace_id, tool_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_workspace_tools_workspace ON workspace_tools(workspace_id);

      -- Badges
      CREATE TABLE badges (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        created_at INTEGER NOT NULL
      );

      INSERT INTO badges (id, name, display_name, description, icon, color, created_at) VALUES
        ('badge-1', 'beta-tester', 'Beta Tester', 'Early adopter helping test new features', '🧪', '#667eea', strftime('%s', 'now')),
        ('badge-2', 'orbit-team', 'Orbit Team', 'Official Orbit team member', '⭐', '#f59e0b', strftime('%s', 'now')),
        ('badge-3', 'contributor', 'Contributor', 'Contributed to Orbit development', '🔧', '#10b981', strftime('%s', 'now')),
        ('badge-4', 'partner', 'Partner', 'Orbit partner organization', '🤝', '#8b5cf6', strftime('%s', 'now')),
        ('badge-5', 'trusted-user', 'Trusted User', 'Trusted community member', '✓', '#06b6d4', strftime('%s', 'now'));

      CREATE TABLE user_badges (
        user_id TEXT NOT NULL,
        badge_id TEXT NOT NULL,
        assigned_by TEXT NOT NULL,
        assigned_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, badge_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id)
      );

      CREATE INDEX idx_user_badges_user ON user_badges(user_id);

      -- Inbox
      CREATE TABLE inbox_messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message_encrypted TEXT NOT NULL,
        metadata_json TEXT,
        is_read INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        read_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT chk_inbox_type CHECK (type IN ('badge-assigned', 'badge-revoked', 'role-changed', 'system-notification'))
      );

      CREATE INDEX idx_inbox_user_id ON inbox_messages(user_id);
      CREATE INDEX idx_inbox_unread ON inbox_messages(user_id, is_read);
      CREATE INDEX idx_inbox_created ON inbox_messages(created_at DESC);
    `;
  }

  /**
   * Sync infrastructure migration
   * Adds sync columns to all syncable tables + sync_queue + sync_conflicts
   */
  _getSyncInfrastructureMigration() {
    return `
      -- Add sync columns to workspaces
      ALTER TABLE workspaces ADD COLUMN sync_version INTEGER DEFAULT 0;
      ALTER TABLE workspaces ADD COLUMN sync_status TEXT DEFAULT 'synced';
      ALTER TABLE workspaces ADD COLUMN lamport_clock INTEGER DEFAULT 0;
      ALTER TABLE workspaces ADD COLUMN last_modified_device TEXT;

      -- Add sync columns to notes
      ALTER TABLE notes ADD COLUMN sync_version INTEGER DEFAULT 0;
      ALTER TABLE notes ADD COLUMN sync_status TEXT DEFAULT 'synced';
      ALTER TABLE notes ADD COLUMN lamport_clock INTEGER DEFAULT 0;
      ALTER TABLE notes ADD COLUMN last_modified_device TEXT;

      -- Add sync columns to links
      ALTER TABLE links ADD COLUMN sync_version INTEGER DEFAULT 0;
      ALTER TABLE links ADD COLUMN sync_status TEXT DEFAULT 'synced';
      ALTER TABLE links ADD COLUMN lamport_clock INTEGER DEFAULT 0;
      ALTER TABLE links ADD COLUMN last_modified_device TEXT;

      -- Add sync columns to file_references
      ALTER TABLE file_references ADD COLUMN sync_version INTEGER DEFAULT 0;
      ALTER TABLE file_references ADD COLUMN sync_status TEXT DEFAULT 'synced';
      ALTER TABLE file_references ADD COLUMN lamport_clock INTEGER DEFAULT 0;
      ALTER TABLE file_references ADD COLUMN last_modified_device TEXT;

      -- Add sync columns to user_settings
      ALTER TABLE user_settings ADD COLUMN sync_version INTEGER DEFAULT 0;
      ALTER TABLE user_settings ADD COLUMN sync_status TEXT DEFAULT 'synced';
      ALTER TABLE user_settings ADD COLUMN lamport_clock INTEGER DEFAULT 0;
      ALTER TABLE user_settings ADD COLUMN last_modified_device TEXT;

      -- Sync queue: stores pending changes when offline
      CREATE TABLE sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op_id TEXT NOT NULL UNIQUE,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        encrypted_payload TEXT,
        lamport_clock INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        CONSTRAINT chk_operation CHECK (operation IN ('create', 'update', 'delete'))
      );

      CREATE INDEX idx_sync_queue_clock ON sync_queue(lamport_clock ASC);
      CREATE INDEX idx_sync_queue_entity ON sync_queue(entity_type, entity_id);

      -- Sync conflicts: stores losing versions for user review
      CREATE TABLE sync_conflicts (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        losing_data TEXT NOT NULL,
        winning_device TEXT NOT NULL,
        losing_device TEXT NOT NULL,
        resolved_at INTEGER NOT NULL,
        user_reviewed INTEGER DEFAULT 0
      );

      CREATE INDEX idx_sync_conflicts_entity ON sync_conflicts(entity_type, entity_id);
      CREATE INDEX idx_sync_conflicts_unreviewed ON sync_conflicts(user_reviewed) WHERE user_reviewed = 0;

      -- Device tracking
      CREATE TABLE devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        device_fingerprint TEXT NOT NULL UNIQUE,
        last_seen_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_devices_user ON devices(user_id);

      -- Sync metadata: tracks last sync state per device
      CREATE TABLE sync_metadata (
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        last_synced_clock INTEGER DEFAULT 0,
        last_synced_at INTEGER,
        PRIMARY KEY (user_id, device_id, entity_type),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      );

      -- User crypto keys: stores encrypted master key + recovery blob
      -- kdf_params stored as JSON for future upgrades (memory, iterations, parallelism)
      CREATE TABLE user_crypto (
        user_id TEXT PRIMARY KEY,
        salt TEXT NOT NULL,
        encrypted_master_key TEXT NOT NULL,
        recovery_blob TEXT NOT NULL,
        key_version INTEGER DEFAULT 1,
        kdf_params TEXT NOT NULL DEFAULT '{"algorithm":"argon2id","memoryCost":65536,"timeCost":3,"parallelism":4,"hashLength":32}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;
  }

  /**
   * Get database instance
   */
  getDB() {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.isInitialized = false;
      console.log('✅ Database connection closed');
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    if (!this.isInitialized) return;

    const now = Math.floor(Date.now() / 1000);
    const result = this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);

    if (result.changes > 0) {
      console.log(`🧹 Cleaned up ${result.changes} expired session(s)`);
    }
  }
}

module.exports = DatabaseManager;
