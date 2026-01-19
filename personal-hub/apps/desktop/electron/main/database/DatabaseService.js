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
      this.encryption = new EncryptionService();

      // Step 2: Initialize database manager
      console.log('💾 Initializing database manager...');
      this.dbManager = new DatabaseManager(this.userDataPath);
      await this.dbManager.initialize();

      // Step 3: Create repositories
      console.log('📦 Creating repositories...');
      const db = this.dbManager.getDB();
      this.repos = createRepositories(db, this.encryption);

      // Step 4: Run migration if needed
      const migrator = new DataMigrator(this.userDataPath, this.repos, this.encryption);
      if (migrator.needsMigration()) {
        console.log('🔄 Migration needed, starting...');
        await migrator.migrate();

        // Run tests
        console.log('🧪 Running migration tests...');
        const testResults = await migrator.testMigration();

        if (!testResults.passed) {
          console.error('❌ Migration tests failed!');
          throw new Error('Migration verification failed');
        }
      } else {
        console.log('✅ No migration needed (database already populated)');
      }

      // Step 5: Clean up expired sessions
      this.dbManager.cleanupExpiredSessions();

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
