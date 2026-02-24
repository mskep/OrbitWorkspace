const DatabaseManager = require('./index');
const EncryptionService = require('../security/encryptionService');
const { createRepositories } = require('./repositories');
const DataMigrator = require('./migrator');

/**
 * DatabaseService - Main service for database operations
 *
 * Initializes database, encryption, repositories, and handles migrations
 */
class DatabaseService {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.dbManager = null;
    this.encryption = null;
    this.repos = null;
    this.isInitialized = false;
  }

  /**
   * Initialize database service
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️  DatabaseService already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing DatabaseService...');

      // Step 1: Initialize encryption service
      console.log('🔐 Initializing encryption service...');
      this.encryption = new EncryptionService(this.userDataPath);

      // Step 2: Initialize database manager
      console.log('💾 Initializing database manager...');
      this.dbManager = new DatabaseManager(this.userDataPath);
      await this.dbManager.initialize();

      // Step 3: Create repositories
      console.log('📦 Creating repositories...');
      const db = this.dbManager.getDB();
      this.repos = createRepositories(db, this.encryption);

      // Step 4: Run migration if needed (only when legacy users.json exists)
      const migrator = new DataMigrator(this.userDataPath, this.repos, this.encryption);
      if (migrator.needsMigration()) {
        const result = await migrator.migrate();

        // Only run verification tests if users were actually migrated
        if (result.users > 0) {
          console.log('🧪 Running migration tests...');
          const testResults = await migrator.testMigration();

          if (!testResults.passed) {
            console.error('❌ Migration tests failed!');
            throw new Error('Migration verification failed');
          }
        } else {
          console.log('✅ Fresh install — no users to migrate, awaiting first registration');
        }
      } else {
        console.log('✅ No migration needed (database already populated)');
      }

      // Step 5: Clean up expired sessions
      this.dbManager.cleanupExpiredSessions();

      // Step 6: Clean up corrupted encrypted data (one-time cleanup)
      this.cleanupCorruptedData();

      this.isInitialized = true;
      console.log('✅ DatabaseService initialized successfully!\n');
    } catch (error) {
      console.error('❌ DatabaseService initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get repositories
   */
  getRepositories() {
    if (!this.isInitialized) {
      throw new Error('DatabaseService not initialized');
    }
    return this.repos;
  }

  /**
   * Get encryption service
   */
  getEncryption() {
    if (!this.isInitialized) {
      throw new Error('DatabaseService not initialized');
    }
    return this.encryption;
  }

  /**
   * Get database instance
   */
  getDB() {
    if (!this.isInitialized) {
      throw new Error('DatabaseService not initialized');
    }
    return this.dbManager.getDB();
  }

  /**
   * Close database connection
   */
  close() {
    if (this.dbManager) {
      this.dbManager.close();
      this.isInitialized = false;
    }
  }

  /**
   * Clean up corrupted encrypted data
   * (Notes/Links/FileRefs that can't be decrypted with current key)
   */
  cleanupCorruptedData() {
    try {
      const db = this.dbManager.getDB(); // Use dbManager directly (called before isInitialized=true)
      let deletedCount = 0;

      // Check and delete corrupted notes
      const notes = db.prepare('SELECT id, content_encrypted FROM notes').all();
      notes.forEach(note => {
        try {
          this.encryption.decrypt(note.content_encrypted);
        } catch (error) {
          console.warn(`Deleting corrupted note ${note.id}`);
          db.prepare('DELETE FROM notes WHERE id = ?').run(note.id);
          deletedCount++;
        }
      });

      // Check and delete corrupted links
      const links = db.prepare('SELECT id, url_encrypted FROM links').all();
      links.forEach(link => {
        try {
          this.encryption.decrypt(link.url_encrypted);
        } catch (error) {
          console.warn(`Deleting corrupted link ${link.id}`);
          db.prepare('DELETE FROM links WHERE id = ?').run(link.id);
          deletedCount++;
        }
      });

      // Check and delete corrupted file references
      const fileRefs = db.prepare('SELECT id, path_encrypted FROM file_references').all();
      fileRefs.forEach(fileRef => {
        try {
          this.encryption.decrypt(fileRef.path_encrypted);
        } catch (error) {
          console.warn(`Deleting corrupted file reference ${fileRef.id}`);
          db.prepare('DELETE FROM file_references WHERE id = ?').run(fileRef.id);
          deletedCount++;
        }
      });

      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} corrupted encrypted records`);
      }
    } catch (error) {
      console.error('Failed to cleanup corrupted data:', error);
    }
  }

  /**
   * Run database health check
   */
  async healthCheck() {
    try {
      const db = this.getDB();

      // Test basic query
      const result = db.prepare('SELECT COUNT(*) as count FROM users').get();

      // Check encryption
      const testData = 'health check test';
      const encrypted = this.encryption.encrypt(testData);
      const decrypted = this.encryption.decrypt(encrypted);

      return {
        healthy: decrypted === testData,
        userCount: result.count,
        dbPath: this.dbManager.dbPath,
        encryptionWorking: decrypted === testData
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

module.exports = DatabaseService;
