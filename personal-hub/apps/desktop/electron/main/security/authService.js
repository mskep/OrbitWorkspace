const { hashPassword, verifyPassword, generateToken } = require('./crypto');
const crypto = require('crypto');

// Generate unique ID
function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * AuthService - Enhanced authentication with multi-user support
 * Supports: email + username + password, login with email OR username
 */
class AuthService {
  constructor(storage) {
    this.storage = storage;
    this.currentSession = null;
  }

  async initialize() {
    // Check if users file exists, if not create default admin user
    const usersExist = await this.storage.existsJson('users.json');
    if (!usersExist) {
      // Create default admin user
      const defaultPassword = await hashPassword('admin');
      await this.storage.setJson('users.json', {
        users: [
          {
            id: generateId(),
            username: 'admin',
            email: 'admin@orbit.local',
            passwordHash: defaultPassword,
            role: 'ADMIN',
            active: true,
            createdAt: Date.now(),
            lastLogin: null
          }
        ]
      });
    }

    // Restore session if token exists
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

      const usersData = await this.storage.getJson('users.json') || { users: [] };

      // Check if email or username already exists
      const emailExists = usersData.users.some(u => u.email.toLowerCase() === email.toLowerCase());
      const usernameExists = usersData.users.some(u => u.username.toLowerCase() === username.toLowerCase());

      if (emailExists || usernameExists) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Create new user
      const passwordHash = await hashPassword(password);
      const newUser = {
        id: generateId(),
        username,
        email: email.toLowerCase(),
        passwordHash,
        role: 'USER', // Default role
        active: true,
        createdAt: Date.now(),
        lastLogin: null
      };

      usersData.users.push(newUser);
      await this.storage.setJson('users.json', usersData);

      // Log the action
      this.storage.logAction({
        type: 'auth:register',
        status: 'success',
        timestamp: Date.now(),
        payload: JSON.stringify({ username, email })
      });

      return { success: true, user: { id: newUser.id, username, email, role: newUser.role } };
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

      const usersData = await this.storage.getJson('users.json');
      if (!usersData || !usersData.users) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Find user by email OR username
      const user = usersData.users.find(u =>
        u.email.toLowerCase() === identifier.toLowerCase() ||
        u.username.toLowerCase() === identifier.toLowerCase()
      );

      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Check if user is active
      if (!user.active) {
        return { success: false, error: 'Account suspended' };
      }

      // Verify password - NO length check, just verify against hash
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        // Log failed attempt
        this.storage.logAction({
          type: 'auth:login_failed',
          status: 'error',
          timestamp: Date.now(),
          error: 'Invalid password'
        });
        return { success: false, error: 'Invalid credentials' };
      }

      // Generate session token
      const token = generateToken();

      // Update last login
      user.lastLogin = Date.now();
      await this.storage.setJson('users.json', usersData);

      // Create session
      this.currentSession = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        token,
        loginTime: Date.now()
      };

      // Save token if remember me
      if (rememberMe) {
        await this.storage.setJson('session.json', {
          userId: user.id,
          token,
          createdAt: Date.now()
        });
      }

      // Log successful login
      this.storage.logAction({
        type: 'auth:login',
        status: 'success',
        timestamp: Date.now()
      });

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
    if (this.currentSession) {
      this.storage.logAction({
        type: 'auth:logout',
        status: 'success',
        timestamp: Date.now()
      });
    }

    this.currentSession = null;

    // Clear session token
    const sessionExists = await this.storage.existsJson('session.json');
    if (sessionExists) {
      await this.storage.deleteJson('session.json');
    }

    return { success: true };
  }

  /**
   * Get current session
   */
  async getSession() {
    return this.currentSession;
  }

  /**
   * Restore session from saved token
   */
  async restoreSession() {
    try {
      const sessionExists = await this.storage.existsJson('session.json');
      if (!sessionExists) {
        return null;
      }

      const session = await this.storage.getJson('session.json');
      if (!session || !session.token || !session.userId) {
        return null;
      }

      // Verify user still exists and is active
      const usersData = await this.storage.getJson('users.json');
      if (!usersData || !usersData.users) {
        return null;
      }

      const user = usersData.users.find(u => u.id === session.userId);
      if (!user || !user.active) {
        await this.storage.deleteJson('session.json');
        return null;
      }

      // Restore session
      this.currentSession = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        token: session.token,
        loginTime: session.createdAt
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
      const usersData = await this.storage.getJson('users.json');
      if (!usersData || !usersData.users) {
        return { success: false, error: 'Invalid operation' };
      }

      const userIndex = usersData.users.findIndex(u => u.id === this.currentSession.userId);
      if (userIndex === -1) {
        return { success: false, error: 'User not found' };
      }

      const user = usersData.users[userIndex];

      // Verify old password
      const isValid = await verifyPassword(oldPassword, user.passwordHash);
      if (!isValid) {
        return { success: false, error: 'Invalid current password' };
      }

      // Hash new password
      const newHash = await hashPassword(newPassword);
      usersData.users[userIndex].passwordHash = newHash;

      await this.storage.setJson('users.json', usersData);

      this.storage.logAction({
        type: 'auth:password_changed',
        status: 'success',
        timestamp: Date.now()
      });

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
      const usersData = await this.storage.getJson('users.json');
      if (!usersData || !usersData.users) {
        return null;
      }

      const user = usersData.users.find(u => u.id === userId);
      if (!user) {
        return null;
      }

      // Return profile without sensitive data
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
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
      if (!this.currentSession || (this.currentSession.role !== 'ADMIN' && this.currentSession.role !== 'DEVELOPER')) {
        return { success: false, error: 'Unauthorized' };
      }

      const usersData = await this.storage.getJson('users.json');
      if (!usersData || !usersData.users) {
        return { success: true, users: [] };
      }

      // Return users without password hashes
      const users = usersData.users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        active: u.active,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin
      }));

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

      const validRoles = ['ADMIN', 'DEVELOPER', 'VIP', 'USER'];
      if (!validRoles.includes(newRole)) {
        return { success: false, error: 'Invalid role' };
      }

      const usersData = await this.storage.getJson('users.json');
      if (!usersData || !usersData.users) {
        return { success: false, error: 'Users not found' };
      }

      const userIndex = usersData.users.findIndex(u => u.id === userId);
      if (userIndex === -1) {
        return { success: false, error: 'User not found' };
      }

      usersData.users[userIndex].role = newRole;
      await this.storage.setJson('users.json', usersData);

      this.storage.logAction({
        type: 'auth:role_updated',
        status: 'success',
        timestamp: Date.now(),
        payload: JSON.stringify({ userId, newRole })
      });

      return { success: true };
    } catch (error) {
      console.error('Update role error:', error);
      return { success: false, error: 'Failed to update role' };
    }
  }
}

module.exports = AuthService;
