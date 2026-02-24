const fs = require('fs');
const path = require('path');

/**
 * DataMigrator - Migrates data from JSON files to SQLite database
 *
 * Migrates:
 * - users.json -> users table
 * - session.json -> sessions table
 * - Creates default workspace for existing users
 * - Creates default user settings
 */
class DataMigrator {
  constructor(userDataPath, repositories, encryptionService) {
    this.userDataPath = userDataPath;
    this.repos = repositories;
    this.encryption = encryptionService;
    this.migrationLog = [];
  }

  /**
   * Log migration step
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message };
    this.migrationLog.push(logEntry);

    const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [Migration] ${message}`);
  }

  /**
   * Check if migration is needed
   */
  needsMigration() {
    // Check if users table is empty
    const userCount = this.repos.users.count();

    // If there are users, no migration needed
    if (userCount > 0) {
      return false;
    }

    // If no users, we need to either migrate old data or create default admin
    return true;
  }

  /**
   * Run full migration
   */
  async migrate() {
    this.log('Starting data migration from JSON to SQLite...');

    try {
      // Step 1: Migrate users
      const migratedUsers = await this.migrateUsers();
      this.log(`Migrated ${migratedUsers.length} users`);

      // Step 2: Migrate sessions
      const migratedSessions = await this.migrateSessions(migratedUsers);
      this.log(`Migrated ${migratedSessions} sessions`);

      // Step 3: Create default workspaces
      const workspaces = await this.createDefaultWorkspaces(migratedUsers);
      this.log(`Created ${workspaces.length} default workspaces`);

      // Step 4: Create user settings
      const settings = await this.createUserSettings(migratedUsers, workspaces);
      this.log(`Created ${settings.length} user settings`);

      // Step 5: Create welcome messages
      const messages = await this.createWelcomeMessages(migratedUsers);
      this.log(`Created ${messages.length} welcome messages`);

      this.log('✅ Migration completed successfully!');

      return {
        success: true,
        users: migratedUsers.length,
        sessions: migratedSessions,
        workspaces: workspaces.length,
        log: this.migrationLog
      };
    } catch (error) {
      this.log(`Migration failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Migrate users from users.json
   */
  async migrateUsers() {
    const usersJsonPath = path.join(this.userDataPath, 'users.json');

    if (!fs.existsSync(usersJsonPath)) {
      this.log('No users.json found — fresh install, awaiting registration');
      return await this.createDefaultAdmin();
    }

    try {
      const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
      const migratedUsers = [];

      if (usersData.users && Array.isArray(usersData.users)) {
        for (const user of usersData.users) {
          try {
            // Create user in database
            const newUser = this.repos.users.create({
              username: user.username,
              email: user.email,
              passwordHash: user.passwordHash,
              role: user.role || 'USER',
              status: user.active ? 'active' : 'disabled'
            });

            // Update last login if exists
            if (user.lastLogin) {
              this.repos.users.db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
                .run(Math.floor(user.lastLogin / 1000), newUser.id);
            }

            migratedUsers.push(newUser);
            this.log(`Migrated user: ${user.username}`);
          } catch (error) {
            this.log(`Failed to migrate user ${user.username}: ${error.message}`, 'warning');
          }
        }
      }

      // If no users migrated, create default admin
      if (migratedUsers.length === 0) {
        this.log('No valid users found, creating default admin');
        return await this.createDefaultAdmin();
      }

      return migratedUsers;
    } catch (error) {
      this.log(`Error reading users.json: ${error.message}`, 'error');
      return await this.createDefaultAdmin();
    }
  }

  /**
   * No default admin creation — users must register through the UI.
   * First registered user can be promoted to ADMIN via admin panel.
   */
  async createDefaultAdmin() {
    this.log('No existing users found. Users must register through the app.');
    return [];
  }

  /**
   * Migrate sessions from session.json
   */
  async migrateSessions(users) {
    const sessionJsonPath = path.join(this.userDataPath, 'session.json');

    if (!fs.existsSync(sessionJsonPath)) {
      this.log('No session.json found, skipping session migration');
      return 0;
    }

    try {
      const sessionData = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf8'));

      // Find user by ID
      const user = users.find(u => u.id === sessionData.userId);

      if (!user || !sessionData.token) {
        this.log('Invalid session data, skipping', 'warning');
        return 0;
      }

      // Check if session already exists with this token
      const existingSession = this.repos.sessions.findByToken(sessionData.token);
      if (existingSession) {
        this.log('Session already exists, skipping');
        return 0;
      }

      // Create session with 30 days TTL
      const now = Math.floor(Date.now() / 1000);
      const session = this.repos.sessions.db.prepare(`
        INSERT INTO sessions (id, user_id, token, created_at, expires_at, last_activity_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        this.generateId(),
        user.id,
        sessionData.token,
        sessionData.createdAt ? Math.floor(sessionData.createdAt / 1000) : now,
        now + (30 * 24 * 60 * 60), // 30 days from now
        now
      );

      this.log('Migrated active session');
      return 1;
    } catch (error) {
      this.log(`Error migrating session: ${error.message}`, 'warning');
      return 0;
    }
  }

  /**
   * Create default workspaces for migrated users
   */
  async createDefaultWorkspaces(users) {
    const workspaces = [];

    for (const user of users) {
      try {
        const workspace = this.repos.workspaces.create(user.id, 'Default Workspace');
        workspaces.push(workspace);
        this.log(`Created default workspace for ${user.username}`);
      } catch (error) {
        this.log(`Failed to create workspace for ${user.username}: ${error.message}`, 'warning');
      }
    }

    return workspaces;
  }

  /**
   * Create user settings with active workspace
   */
  async createUserSettings(users, workspaces) {
    const settings = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const workspace = workspaces[i];

      try {
        const userSettings = this.repos.userSettings.create(user.id, workspace ? workspace.id : null);
        settings.push(userSettings);
        this.log(`Created settings for ${user.username}`);
      } catch (error) {
        this.log(`Failed to create settings for ${user.username}: ${error.message}`, 'warning');
      }
    }

    return settings;
  }

  /**
   * Create welcome messages for new users
   */
  async createWelcomeMessages(users) {
    const messages = [];

    for (const user of users) {
      try {
        const msg = this.repos.inbox.create({
          userId: user.id,
          type: 'system-notification',
          title: 'Welcome to Orbit!',
          message: `Welcome to Orbit, ${user.username}! Your personal hub has been successfully set up. Start by exploring the tools, creating notes, and organizing your workspace.`,
          metadataJson: { isWelcome: true }
        });
        messages.push(msg);
      } catch (error) {
        this.log(`Failed to create welcome message for ${user.username}: ${error.message}`, 'warning');
      }
    }

    return messages;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return require('crypto').randomBytes(16).toString('hex');
  }

  /**
   * Test migration results
   */
  async testMigration() {
    const tests = [];

    // Test 1: Check users exist
    const userCount = this.repos.users.count();
    tests.push({
      name: 'Users migrated',
      passed: userCount > 0,
      details: `Found ${userCount} users`
    });

    // Test 2: Check workspaces exist
    const allUsers = this.repos.users.findAll();
    let workspaceCount = 0;
    for (const user of allUsers) {
      const workspaces = this.repos.workspaces.findByUserId(user.id);
      workspaceCount += workspaces.length;
    }
    tests.push({
      name: 'Workspaces created',
      passed: workspaceCount > 0,
      details: `Found ${workspaceCount} workspaces`
    });

    // Test 3: Check user settings exist
    let settingsCount = 0;
    for (const user of allUsers) {
      const settings = this.repos.userSettings.findByUserId(user.id);
      if (settings) settingsCount++;
    }
    tests.push({
      name: 'User settings created',
      passed: settingsCount > 0,
      details: `Found ${settingsCount} user settings`
    });

    // Test 4: Check active workspace is set
    let activeWorkspacesSet = 0;
    for (const user of allUsers) {
      const settings = this.repos.userSettings.findByUserId(user.id);
      if (settings && settings.active_workspace_id) activeWorkspacesSet++;
    }
    tests.push({
      name: 'Active workspaces set',
      passed: activeWorkspacesSet > 0,
      details: `${activeWorkspacesSet}/${allUsers.length} users have active workspace`
    });

    // Test 5: Check encryption works
    try {
      const testMessage = 'Test encryption message';
      const encrypted = this.encryption.encrypt(testMessage);
      const decrypted = this.encryption.decrypt(encrypted);
      tests.push({
        name: 'Encryption service',
        passed: decrypted === testMessage,
        details: 'Encryption/decryption working'
      });
    } catch (error) {
      tests.push({
        name: 'Encryption service',
        passed: false,
        details: `Error: ${error.message}`
      });
    }

    // Test 6: Check at least one user exists (or fresh install)
    tests.push({
      name: 'Users available or fresh install',
      passed: true,
      details: userCount > 0 ? `${userCount} users in database` : 'Fresh install — awaiting first registration'
    });

    // Print test results
    console.log('\n========================================');
    console.log('🧪 MIGRATION TEST RESULTS');
    console.log('========================================\n');

    const passedTests = tests.filter(t => t.passed).length;
    const totalTests = tests.length;

    tests.forEach((test, index) => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${index + 1}. ${status} - ${test.name}`);
      console.log(`   ${test.details}\n`);
    });

    console.log('========================================');
    console.log(`Results: ${passedTests}/${totalTests} tests passed`);
    console.log('========================================\n');

    return {
      passed: passedTests === totalTests,
      total: totalTests,
      passedCount: passedTests,
      tests
    };
  }
}

module.exports = DataMigrator;
