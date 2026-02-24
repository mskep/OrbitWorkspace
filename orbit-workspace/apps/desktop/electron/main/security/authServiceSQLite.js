const { hashPassword, verifyPassword, generateToken } = require('./crypto');
const SyncCrypto = require('./syncCrypto');
const fs = require('fs');
const path = require('path');

/**
 * AuthService - SQLite-based authentication with multi-user support
 *
 * Integrates SyncCrypto for zero-knowledge encryption:
 *   - Registration: generates crypto bundle (salt, encryptedMasterKey, recoveryBlob)
 *   - Login: unlocks masterKey from encrypted storage
 *   - Logout: zeroes masterKey from memory
 *   - Password change: re-wraps masterKey with new derived key
 */
class AuthServiceSQLite {
  constructor(dbService, userDataPath) {
    this.dbService = dbService;
    this.currentSession = null;
    this.syncCrypto = new SyncCrypto();
    this.tokenFilePath = path.join(userDataPath, '.session-token');
    this._lastValidation = 0;
    this._validationIntervalMs = 60_000; // Revalidate session against DB every 60s
  }

  /**
   * Persist session token to disk (for restore on next launch)
   */
  _persistToken(token) {
    try {
      fs.writeFileSync(this.tokenFilePath, token, 'utf-8');
    } catch (_) { /* non-critical */ }
  }

  /**
   * Read persisted token from disk
   */
  _readPersistedToken() {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        return fs.readFileSync(this.tokenFilePath, 'utf-8').trim();
      }
    } catch (_) { /* non-critical */ }
    return null;
  }

  /**
   * Clear persisted token from disk
   */
  _clearPersistedToken() {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        fs.unlinkSync(this.tokenFilePath);
      }
    } catch (_) { /* non-critical */ }
  }

  async initialize() {
    // Database is already initialized in main.js
    // Just restore session if exists
    await this.restoreSession();
  }

  /**
   * Register a new user
   */
  async register(email, username, password) {
    try {
      // Validation
      if (!email || !username || !password) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Username validation (3-20 chars, alphanumeric + underscore)
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(username)) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Password validation (min 6 chars)
      if (password.length < 6) {
        return { success: false, error: 'Invalid credentials' };
      }

      const repos = this.dbService.getRepositories();

      // Check if email or username already exists
      const emailExists = repos.users.findByEmail(email);
      const usernameExists = repos.users.findByUsername(username);

      if (emailExists || usernameExists) {
        return { success: false, error: 'Invalid credentials' };
      }

      // First user ever registered gets ADMIN role
      const userCount = repos.users.count();
      const role = userCount === 0 ? 'ADMIN' : 'USER';

      // Create new user
      const passwordHash = await hashPassword(password);
      const newUser = repos.users.create({
        username,
        email: email.toLowerCase(),
        passwordHash,
        role,
        status: 'active'
      });

      // Create default workspace
      const workspace = repos.workspaces.create(newUser.id, 'Default Workspace');

      // Create user settings with active workspace
      repos.userSettings.create(newUser.id, workspace.id);

      // Generate zero-knowledge crypto bundle
      const cryptoBundle = await this.syncCrypto.generateRegistrationBundle(password);

      // Store crypto material in user_crypto table
      repos.userCrypto.create({
        userId: newUser.id,
        salt: cryptoBundle.salt,
        encryptedMasterKey: cryptoBundle.encryptedMasterKey,
        recoveryBlob: cryptoBundle.recoveryBlob,
        kdfParams: cryptoBundle.kdfParams,
      });

      // Generate recovery file content
      const recoveryFileContent = this.syncCrypto.generateRecoveryFileContent(
        cryptoBundle.recoveryKey,
        username
      );

      // Create welcome message
      repos.inbox.createSystemNotification(
        newUser.id,
        'Welcome to Orbit!',
        `Welcome ${username}! Your account has been created successfully.`,
        { isWelcome: true }
      );

      return {
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role
        },
        recoveryFileContent
      };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: 'Registration failed' };
    }
  }

  /**
   * Login with email OR username + password
   * NO VALIDATION on password format - only check if it matches the hash
   */
  async login(identifier, password, rememberMe = false) {
    try {
      // Only check if fields are provided, no format validation
      if (!identifier || !password) {
        return { success: false, error: 'Invalid credentials' };
      }

      const repos = this.dbService.getRepositories();

      // Find user by email OR username
      const user = repos.users.findByIdentifier(identifier);

      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Check if user is active
      if (user.status !== 'active') {
        return { success: false, error: 'Account suspended' };
      }

      // Verify password - NO length check, just verify against hash
      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Unlock zero-knowledge crypto
      let recoveryFileContent = null;
      const userCrypto = repos.userCrypto.findByUserId(user.id);

      if (userCrypto) {
        // Existing user with crypto — unlock masterKey
        await this.syncCrypto.unlockWithPassword(
          password,
          userCrypto.salt,
          userCrypto.encrypted_master_key,
          userCrypto.kdf_params
        );
      } else {
        // Existing user WITHOUT crypto (pre-Phase 3 account) — generate bundle now
        const cryptoBundle = await this.syncCrypto.generateRegistrationBundle(password);
        repos.userCrypto.create({
          userId: user.id,
          salt: cryptoBundle.salt,
          encryptedMasterKey: cryptoBundle.encryptedMasterKey,
          recoveryBlob: cryptoBundle.recoveryBlob,
          kdfParams: cryptoBundle.kdfParams,
        });
        recoveryFileContent = this.syncCrypto.generateRecoveryFileContent(
          cryptoBundle.recoveryKey,
          user.username
        );
      }

      // Create session in database
      const sessionData = repos.sessions.create(user.id, rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60);

      // Update last login
      repos.users.updateLastLogin(user.id);

      // Store current session
      this.currentSession = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        token: sessionData.token,
        loginTime: Date.now()
      };

      // Only persist token for session restore if rememberMe is checked
      if (rememberMe) {
        this._persistToken(sessionData.token);
      } else {
        this._clearPersistedToken();
      }

      const result = { success: true, session: this.currentSession };

      // If this is a migrated account, include recovery file for one-time download
      if (recoveryFileContent) {
        result.recoveryFileContent = recoveryFileContent;
        result.cryptoMigrated = true;
      }

      return result;
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  /**
   * Logout current user
   */
  async logout() {
    if (this.currentSession && this.currentSession.token) {
      try {
        const repos = this.dbService.getRepositories();
        repos.sessions.deleteByToken(this.currentSession.token);
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    // Zero masterKey from memory
    this.syncCrypto.lock();

    this._clearPersistedToken();
    this.currentSession = null;
    return { success: true };
  }

  /**
   * Get current session — revalidates against DB periodically
   * Checks: token expiration, user status (active), role freshness
   */
  async getSession() {
    if (!this.currentSession) return null;

    const now = Date.now();
    if (now - this._lastValidation < this._validationIntervalMs) {
      return this.currentSession;
    }

    // Revalidate against DB
    try {
      const db = this.dbService.getDB();
      const nowUnix = Math.floor(now / 1000);

      const row = db.prepare(`
        SELECT s.expires_at, u.status, u.role, u.username, u.email
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ?
      `).get(this.currentSession.token);

      if (!row || row.expires_at <= nowUnix || row.status !== 'active') {
        // Session expired, user disabled, or token invalid
        this.currentSession = null;
        this._clearPersistedToken();
        return null;
      }

      // Refresh role/username in case admin changed them
      this.currentSession.role = row.role;
      this.currentSession.username = row.username;
      this.currentSession.email = row.email;
      this._lastValidation = now;

      return this.currentSession;
    } catch (error) {
      console.error('Session revalidation error:', error);
      return this.currentSession; // Fail-open on DB error to avoid locking out user
    }
  }

  /**
   * Restore session from persisted token file
   * Only restores the exact session this device logged into (not any global latest)
   */
  async restoreSession() {
    try {
      const token = this._readPersistedToken();
      if (!token) {
        return null;
      }

      const repos = this.dbService.getRepositories();
      const db = this.dbService.getDB();
      const now = Math.floor(Date.now() / 1000);

      // Look up this specific token — not "latest session"
      const session = db.prepare(`
        SELECT s.*, u.username, u.email, u.role
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > ? AND u.status = 'active'
      `).get(token, now);

      if (!session) {
        // Token expired or invalid — clean up
        this._clearPersistedToken();
        return null;
      }

      repos.sessions.updateActivity(session.token);

      this.currentSession = {
        userId: session.user_id,
        username: session.username,
        email: session.email,
        role: session.role,
        token: session.token,
        loginTime: session.created_at * 1000
      };

      return this.currentSession;
    } catch (error) {
      console.error('Restore session error:', error);
      return null;
    }
  }

  /**
   * Check if authenticated
   */
  isAuthenticated() {
    return this.currentSession !== null;
  }

  /**
   * Change password for current user
   */
  async changePassword(oldPassword, newPassword) {
    if (!this.currentSession) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const repos = this.dbService.getRepositories();
      const user = repos.users.findById(this.currentSession.userId);

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Verify old password
      const isValid = await verifyPassword(oldPassword, user.password_hash);
      if (!isValid) {
        return { success: false, error: 'Invalid current password' };
      }

      // Hash new password
      const newHash = await hashPassword(newPassword);

      // Re-wrap masterKey with new password (zero-knowledge crypto)
      const userCrypto = repos.userCrypto.findByUserId(user.id);
      if (userCrypto) {
        const newCrypto = await this.syncCrypto.changePassword(
          oldPassword, newPassword,
          userCrypto.salt,
          userCrypto.encrypted_master_key
        );
        repos.userCrypto.updatePasswordCrypto(user.id, {
          salt: newCrypto.salt,
          encryptedMasterKey: newCrypto.encryptedMasterKey,
          kdfParams: this.syncCrypto.getDefaultKdfParams(),
        });
      }

      // Update password hash
      const db = this.dbService.getDB();
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: 'Password change failed' };
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    try {
      const repos = this.dbService.getRepositories();
      const user = repos.users.findById(userId);

      if (!user) {
        return null;
      }

      // Return profile without sensitive data
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.created_at * 1000,
        lastLogin: user.last_login_at ? user.last_login_at * 1000 : null
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers() {
    try {
      if (!this.currentSession || (this.currentSession.role !== 'ADMIN' && this.currentSession.role !== 'DEV')) {
        return { success: false, error: 'Unauthorized' };
      }

      const repos = this.dbService.getRepositories();
      const users = repos.users.findAll();

      return { success: true, users };
    } catch (error) {
      console.error('Get all users error:', error);
      return { success: false, error: 'Failed to fetch users' };
    }
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId, newRole) {
    try {
      if (!this.currentSession || this.currentSession.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
      }

      const validRoles = ['ADMIN', 'DEV', 'PREMIUM', 'USER'];
      if (!validRoles.includes(newRole)) {
        return { success: false, error: 'Invalid role' };
      }

      const repos = this.dbService.getRepositories();
      const user = repos.users.findById(userId);

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const oldRole = user.role;
      repos.users.updateRole(userId, newRole);

      // Create inbox notification
      repos.inbox.createRoleChangedMessage(userId, oldRole, newRole, this.currentSession.username);

      return { success: true };
    } catch (error) {
      console.error('Update role error:', error);
      return { success: false, error: 'Failed to update role' };
    }
  }

  /**
   * Recover account using recovery file (password reset)
   * Unlocks masterKey with recovery key, re-wraps with new password
   */
  async recoverWithFile(recoveryFileContent, newPassword) {
    try {
      if (!recoveryFileContent || !newPassword || newPassword.length < 6) {
        return { success: false, error: 'Invalid recovery data' };
      }

      // Parse recovery key from file
      const recoveryKeyHex = this.syncCrypto.parseRecoveryFile(recoveryFileContent);

      // We need to find which user this recovery key belongs to
      // Try all users' recovery blobs (there should be few users on a local app)
      const db = this.dbService.getDB();
      const allCrypto = db.prepare('SELECT uc.*, u.username FROM user_crypto uc JOIN users u ON uc.user_id = u.id').all();

      let matchedUser = null;
      let masterKey = null;

      for (const entry of allCrypto) {
        try {
          masterKey = this.syncCrypto.unlockWithRecoveryKey(recoveryKeyHex, entry.recovery_blob);
          matchedUser = entry;
          break;
        } catch (_) {
          // Wrong recovery key for this user, try next
          continue;
        }
      }

      if (!matchedUser || !masterKey) {
        return { success: false, error: 'Invalid recovery key' };
      }

      // Re-wrap masterKey with new password
      const newSalt = this.syncCrypto.generateSalt();
      const newDerivedKey = await this.syncCrypto.deriveKey(newPassword, newSalt);
      const newEncryptedMasterKey = this.syncCrypto._wrapKey(masterKey, newDerivedKey);

      const repos = this.dbService.getRepositories();

      // Update crypto material
      repos.userCrypto.updatePasswordCrypto(matchedUser.user_id, {
        salt: newSalt.toString('hex'),
        encryptedMasterKey: newEncryptedMasterKey.toString('base64'),
        kdfParams: this.syncCrypto.getDefaultKdfParams(),
      });

      // Hash and update password
      const newHash = await hashPassword(newPassword);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, matchedUser.user_id);

      return { success: true, username: matchedUser.username };
    } catch (error) {
      console.error('Recovery error:', error);
      return { success: false, error: 'Recovery failed' };
    }
  }

  /**
   * Get the SyncCrypto instance (for use by sync engine)
   */
  getSyncCrypto() {
    return this.syncCrypto;
  }
}

module.exports = AuthServiceSQLite;
