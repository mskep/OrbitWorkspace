const SyncCrypto = require('./syncCrypto');
const os = require('os');
const crypto = require('crypto');

/**
 * AuthService — Cloud-first authentication.
 *
 * All auth operations (register, login) go through the remote server.
 * Local SQLite is a cache for user profile, crypto material, and session state.
 *
 * Key hierarchy:
 *   - Server: source of truth for identity, auth, and encrypted blobs
 *   - TokenStore: persists server tokens (access + refresh) on disk
 *   - SQLite: caches user profile, crypto material, workspaces, entities
 *   - SyncCrypto: in-memory masterKey (zeroed on logout/quit)
 *
 * Session restore flow (app restart):
 *   1. Load tokens from TokenStore
 *   2. Try refresh → if valid, user is "authenticated but locked"
 *   3. User enters password → unlock masterKey from cached crypto material
 *   4. Start sync engine
 */
class AuthServiceSQLite {
  constructor(dbService, userDataPath) {
    this.dbService = dbService;
    this.currentSession = null;
    this.syncCrypto = new SyncCrypto();
    this.userDataPath = userDataPath;
    this._needsUnlock = false; // True when session is restored but masterKey is locked

    // Set by main.js after all services are created
    this.apiClient = null;
    this.tokenStore = null;
    this.syncManager = null;
  }

  /**
   * Wire cloud services (called from main.js after all services are created).
   */
  setCloudServices(apiClient, tokenStore, syncManager) {
    this.apiClient = apiClient;
    this.tokenStore = tokenStore;
    this.syncManager = syncManager;
  }

  async initialize() {
    // Nothing to do here — restoreSession is called separately after cloud services are wired
  }

  // ============================================================
  // REGISTER — Server-first
  // ============================================================

  async register(email, username, password) {
    try {
      if (!email || !username || !password) {
        return { success: false, error: 'All fields are required' };
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Invalid email format' };
      }

      const usernameRegex = /^[a-zA-Z0-9_-]{3,32}$/;
      if (!usernameRegex.test(username)) {
        return { success: false, error: 'Username must be 3-32 chars (letters, numbers, _ -)' };
      }

      if (password.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' };
      }

      // Generate zero-knowledge crypto bundle
      const cryptoBundle = await this.syncCrypto.generateRegistrationBundle(password);

      // Register on server
      const result = await this.apiClient.register({
        email,
        username,
        password,
        salt: cryptoBundle.salt,
        encrypted_master_key: cryptoBundle.encryptedMasterKey,
        recovery_blob: cryptoBundle.recoveryBlob,
        kdf_params: cryptoBundle.kdfParams,
        device_name: this._getDeviceName(),
        device_fingerprint: this._getDeviceFingerprint(),
      });

      // Store tokens
      this.tokenStore.saveTokens({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        server_user_id: result.user.id,
        device_id: result.device.id,
      });

      // Cache user locally
      const repos = this.dbService.getRepositories();
      repos.users.upsertFromServer(result.user);

      // Cache crypto material locally (for offline unlock)
      if (!repos.userCrypto.exists(result.user.id)) {
        repos.userCrypto.create({
          userId: result.user.id,
          salt: cryptoBundle.salt,
          encryptedMasterKey: cryptoBundle.encryptedMasterKey,
          recoveryBlob: cryptoBundle.recoveryBlob,
          kdfParams: cryptoBundle.kdfParams,
        });
      }

      // Create default workspace locally
      let workspace = (repos.workspaces.findByUserId(result.user.id) || [])[0];
      if (!workspace) {
        workspace = repos.workspaces.create(result.user.id, 'Default Workspace');
      }

      // Create user settings locally
      const settings = repos.userSettings.findByUserId(result.user.id);
      if (!settings) {
        repos.userSettings.create(result.user.id, workspace.id);
      }

      // Set session
      this.currentSession = {
        userId: result.user.id,
        username: result.user.username,
        email: result.user.email,
        role: result.user.role,
        loginTime: Date.now(),
      };
      this._needsUnlock = false;

      // Generate recovery file content
      const recoveryFileContent = this.syncCrypto.generateRecoveryFileContent(
        cryptoBundle.recoveryKey,
        username,
      );

      // Create welcome inbox message
      repos.inbox.createSystemNotification(
        result.user.id,
        'Welcome to Orbit!',
        `Welcome ${username}! Your account has been created successfully.`,
        { isWelcome: true },
      );

      // Start sync engine
      if (this.syncManager) {
        this.syncManager.start().catch(console.error);
      }

      return {
        success: true,
        user: result.user,
        recoveryFileContent,
      };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: error.message || 'Registration failed' };
    }
  }

  // ============================================================
  // LOGIN — Server-first
  // ============================================================

  async login(identifier, password) {
    try {
      if (!identifier || !password) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Login on server
      const result = await this.apiClient.login({
        identifier,
        password,
        device_name: this._getDeviceName(),
        device_fingerprint: this._getDeviceFingerprint(),
      });

      // Store tokens
      this.tokenStore.saveTokens({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        server_user_id: result.user.id,
        device_id: result.device.id,
      });

      // Unlock masterKey with server-returned crypto material
      await this.syncCrypto.unlockWithPassword(
        password,
        result.crypto.salt,
        result.crypto.encrypted_master_key,
        result.crypto.kdf_params,
      );

      // Cache user locally
      const repos = this.dbService.getRepositories();
      repos.users.upsertFromServer(result.user);

      // Cache crypto material locally (for offline unlock on restart)
      const existingCrypto = repos.userCrypto.findByUserId(result.user.id);
      if (!existingCrypto) {
        repos.userCrypto.create({
          userId: result.user.id,
          salt: result.crypto.salt,
          encryptedMasterKey: result.crypto.encrypted_master_key,
          kdfParams: result.crypto.kdf_params,
          recoveryBlob: '',
        });
      } else {
        repos.userCrypto.updatePasswordCrypto(result.user.id, {
          salt: result.crypto.salt,
          encryptedMasterKey: result.crypto.encrypted_master_key,
          kdfParams: result.crypto.kdf_params,
        });
      }

      // Ensure default workspace exists
      let workspace = (repos.workspaces.findByUserId(result.user.id) || [])[0];
      if (!workspace) {
        workspace = repos.workspaces.create(result.user.id, 'Default Workspace');
      }

      // Ensure user settings exist
      const settings = repos.userSettings.findByUserId(result.user.id);
      if (!settings) {
        repos.userSettings.create(result.user.id, workspace.id);
      }

      // Set session
      this.currentSession = {
        userId: result.user.id,
        username: result.user.username,
        email: result.user.email,
        role: result.user.role,
        loginTime: Date.now(),
      };
      this._needsUnlock = false;

      repos.users.updateLastLogin(result.user.id);

      // Start sync engine
      if (this.syncManager) {
        this.syncManager.start().catch(console.error);
      }

      return { success: true, session: this.currentSession };
    } catch (error) {
      console.error('Login error:', error);
      const msg = error.message || 'Login failed';
      return { success: false, error: msg.includes('Invalid credentials') ? 'Invalid credentials' : msg };
    }
  }

  // ============================================================
  // UNLOCK — After session restore, user enters password to decrypt
  // ============================================================

  async unlockSession(password) {
    if (!this.currentSession || !this._needsUnlock) {
      return { success: false, error: 'No session to unlock' };
    }

    try {
      const repos = this.dbService.getRepositories();
      const userCrypto = repos.userCrypto.findByUserId(this.currentSession.userId);

      if (!userCrypto) {
        return { success: false, error: 'Crypto material not found. Please log in again.' };
      }

      // Unlock masterKey from locally cached crypto material
      await this.syncCrypto.unlockWithPassword(
        password,
        userCrypto.salt,
        userCrypto.encrypted_master_key,
        userCrypto.kdf_params,
      );

      this._needsUnlock = false;

      // Start sync engine
      if (this.syncManager) {
        this.syncManager.start().catch(console.error);
      }

      return { success: true };
    } catch (error) {
      console.error('Unlock error:', error);
      return { success: false, error: 'Wrong password' };
    }
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async logout() {
    // Stop sync
    if (this.syncManager) {
      this.syncManager.stop();
    }

    // Server logout (best effort)
    try {
      if (this.tokenStore?.isConnected()) {
        await this.apiClient.logout();
      }
    } catch { /* ignore */ }

    // Clear tokens
    if (this.tokenStore) {
      this.tokenStore.clearTokens();
    }

    // Lock crypto
    this.syncCrypto.lock();

    this.currentSession = null;
    this._needsUnlock = false;
    return { success: true };
  }

  // ============================================================
  // SESSION
  // ============================================================

  async getSession() {
    return this.currentSession;
  }

  getNeedsUnlock() {
    return this._needsUnlock;
  }

  /**
   * Restore session from persisted tokens (app restart).
   * If valid tokens exist, creates a session in "locked" state.
   */
  async restoreSession() {
    try {
      if (!this.tokenStore) return null;

      this.tokenStore.load();
      if (!this.tokenStore.isConnected()) return null;

      const tokens = this.tokenStore.getTokens();
      if (!tokens?.server_user_id) return null;

      // Try token refresh to validate session
      try {
        const refreshResult = await this.apiClient.refreshTokens(tokens.refresh_token);
        this.tokenStore.saveTokens({
          access_token: refreshResult.access_token,
          refresh_token: refreshResult.refresh_token,
        });
      } catch {
        // Refresh failed — session expired
        this.tokenStore.clearTokens();
        return null;
      }

      // Restore session from locally cached user
      const repos = this.dbService.getRepositories();
      const user = repos.users.findById(tokens.server_user_id);

      if (!user) {
        this.tokenStore.clearTokens();
        return null;
      }

      this.currentSession = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        loginTime: Date.now(),
      };

      // Session restored but masterKey is not available (needs password)
      this._needsUnlock = true;

      return this.currentSession;
    } catch (error) {
      console.error('Restore session error:', error);
      return null;
    }
  }

  isAuthenticated() {
    return this.currentSession !== null;
  }

  // ============================================================
  // PASSWORD CHANGE — Server-first
  // ============================================================

  async changePassword(oldPassword, newPassword) {
    if (!this.currentSession) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters' };
    }

    try {
      const repos = this.dbService.getRepositories();
      const userCrypto = repos.userCrypto.findByUserId(this.currentSession.userId);

      if (!userCrypto) {
        return { success: false, error: 'Crypto material not found' };
      }

      const newCrypto = await this.syncCrypto.changePassword(
        oldPassword, newPassword,
        userCrypto.salt,
        userCrypto.encrypted_master_key,
      );

      const kdfParams = this.syncCrypto.getDefaultKdfParams();

      // Change password on server
      await this.apiClient.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        new_salt: newCrypto.salt,
        new_encrypted_master_key: newCrypto.encryptedMasterKey,
        new_kdf_params: kdfParams,
      });

      // Update local cache
      repos.userCrypto.updatePasswordCrypto(this.currentSession.userId, {
        salt: newCrypto.salt,
        encryptedMasterKey: newCrypto.encryptedMasterKey,
        kdfParams,
      });

      // Server revoked all sessions — force re-login
      await this.logout();

      return { success: true, message: 'Password changed. Please log in again.' };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: error.message || 'Password change failed' };
    }
  }

  // ============================================================
  // RECOVERY
  // ============================================================

  async recoverWithFile(recoveryFileContent, newPassword) {
    try {
      if (!recoveryFileContent || !newPassword || newPassword.length < 8) {
        return { success: false, error: 'Invalid recovery data' };
      }

      const recoveryKeyHex = this.syncCrypto.parseRecoveryFile(recoveryFileContent);

      const db = this.dbService.getDB();
      const allCrypto = db.prepare('SELECT uc.*, u.username FROM user_crypto uc JOIN users u ON uc.user_id = u.id').all();

      let matchedUser = null;
      let masterKey = null;

      for (const entry of allCrypto) {
        try {
          masterKey = this.syncCrypto.unlockWithRecoveryKey(recoveryKeyHex, entry.recovery_blob);
          matchedUser = entry;
          break;
        } catch {
          continue;
        }
      }

      if (!matchedUser || !masterKey) {
        return { success: false, error: 'Invalid recovery key' };
      }

      const newSalt = this.syncCrypto.generateSalt();
      const newDerivedKey = await this.syncCrypto.deriveKey(newPassword, newSalt);
      const newEncryptedMasterKey = this.syncCrypto._wrapKey(masterKey, newDerivedKey);
      const kdfParams = this.syncCrypto.getDefaultKdfParams();

      const repos = this.dbService.getRepositories();
      const newSaltHex = newSalt.toString('hex');
      const newEncMasterKeyB64 = newEncryptedMasterKey.toString('base64');

      repos.userCrypto.updatePasswordCrypto(matchedUser.user_id, {
        salt: newSaltHex,
        encryptedMasterKey: newEncMasterKeyB64,
        kdfParams,
      });

      // Sync updated crypto to server if connected
      if (this.apiClient && this.tokenStore?.isConnected()) {
        try {
          await this.apiClient.recoverReset({
            new_password: newPassword,
            new_salt: newSaltHex,
            new_encrypted_master_key: newEncMasterKeyB64,
            new_kdf_params: kdfParams,
          });
        } catch (err) {
          console.warn('Recovery: failed to sync crypto to server:', err.message);
        }
      }

      return { success: true, username: matchedUser.username };
    } catch (error) {
      console.error('Recovery error:', error);
      return { success: false, error: 'Recovery failed' };
    }
  }

  // ============================================================
  // ACCESSORS
  // ============================================================

  getSyncCrypto() {
    return this.syncCrypto;
  }

  async getUserProfile(userId) {
    try {
      const repos = this.dbService.getRepositories();
      const user = repos.users.findById(userId);
      if (!user) return null;

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.created_at * 1000,
        lastLogin: user.last_login_at ? user.last_login_at * 1000 : null,
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  }

  async getAllUsers() {
    try {
      if (!this.currentSession || (this.currentSession.role !== 'ADMIN' && this.currentSession.role !== 'DEV')) {
        return { success: false, error: 'Unauthorized' };
      }
      const repos = this.dbService.getRepositories();
      return { success: true, users: repos.users.findAll() };
    } catch (error) {
      return { success: false, error: 'Failed to fetch users' };
    }
  }

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
      if (!user) return { success: false, error: 'User not found' };

      const oldRole = user.role;
      repos.users.updateRole(userId, newRole);
      repos.inbox.createRoleChangedMessage(userId, oldRole, newRole, this.currentSession.username);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to update role' };
    }
  }

  // ============================================================
  // DEVICE INFO
  // ============================================================

  _getDeviceName() {
    return `${os.hostname()} (${os.platform()})`;
  }

  _getDeviceFingerprint() {
    const raw = `${os.hostname()}:${os.platform()}:${os.arch()}:${os.userInfo().username}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 64);
  }
}

module.exports = AuthServiceSQLite;
