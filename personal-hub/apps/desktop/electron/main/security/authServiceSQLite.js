const { hashPassword, verifyPassword, generateToken } = require('./crypto');

/**
 * AuthService - SQLite-based authentication with multi-user support
 * Uses database repositories instead of JSON files
 */
class AuthServiceSQLite {
  constructor(dbService) {
    this.dbService = dbService;
    this.currentSession = null;
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

      // Create new user
      const passwordHash = await hashPassword(password);
      const newUser = repos.users.create({
        username,
        email: email.toLowerCase(),
        passwordHash,
        role: 'USER',
        status: 'active'
      });

      // Create default workspace
      const workspace = repos.workspaces.create(newUser.id, 'Default Workspace');

      // Create user settings with active workspace
      repos.userSettings.create(newUser.id, workspace.id);

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
        }
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

      return { success: true, session: this.currentSession };
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

    this.currentSession = null;
    return { success: true };
  }

  /**
   * Get current session
   */
  async getSession() {
    return this.currentSession;
  }

  /**
   * Restore session from database
   */
  async restoreSession() {
    try {
      const repos = this.dbService.getRepositories();

      // Get all active sessions for now (in real app, store token in local storage)
      // For now, we'll just check if there's any active session
      const db = this.dbService.getDB();
      const now = Math.floor(Date.now() / 1000);

      const session = db.prepare(`
        SELECT s.*, u.username, u.email, u.role
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.expires_at > ? AND u.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 1
      `).get(now);

      if (!session) {
        return null;
      }

      // Update last activity
      repos.sessions.updateActivity(session.id);

      // Restore session
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

      // Update password
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
}

module.exports = AuthServiceSQLite;
