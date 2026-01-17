const { hashPassword, verifyPassword, generateToken } = require('./crypto');

class AuthService {
  constructor(storage) {
    this.storage = storage;
    this.currentSession = null;
  }

  async initialize() {
    // Check if auth file exists, if not create default user
    const authExists = await this.storage.existsJson('auth.json');
    if (!authExists) {
      // Default credentials for first setup
      const defaultPassword = await hashPassword('admin');
      await this.storage.setJson('auth.json', {
        username: 'admin',
        passwordHash: defaultPassword,
        token: null
      });
    }
  }

  async login(username, password, rememberMe = false) {
    try {
      const auth = await this.storage.getJson('auth.json');

      if (!auth || auth.username !== username) {
        return { success: false, error: 'Invalid credentials' };
      }

      const isValid = await verifyPassword(password, auth.passwordHash);
      if (!isValid) {
        return { success: false, error: 'Invalid credentials' };
      }

      const token = generateToken();
      this.currentSession = {
        username,
        token,
        loginTime: Date.now()
      };

      if (rememberMe) {
        await this.storage.setJson('auth.json', {
          ...auth,
          token
        });
      }

      // Log the action
      this.storage.logAction({
        type: 'auth:login',
        status: 'success',
        timestamp: Date.now()
      });

      return { success: true, session: this.currentSession };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async logout() {
    if (this.currentSession) {
      this.storage.logAction({
        type: 'auth:logout',
        status: 'success',
        timestamp: Date.now()
      });
    }

    this.currentSession = null;

    // Clear token
    const auth = await this.storage.getJson('auth.json');
    if (auth) {
      await this.storage.setJson('auth.json', {
        ...auth,
        token: null
      });
    }

    return { success: true };
  }

  async getSession() {
    return this.currentSession;
  }

  async restoreSession() {
    const auth = await this.storage.getJson('auth.json');
    if (auth && auth.token) {
      this.currentSession = {
        username: auth.username,
        token: auth.token,
        loginTime: Date.now()
      };
      return this.currentSession;
    }
    return null;
  }

  isAuthenticated() {
    return this.currentSession !== null;
  }

  async changePassword(oldPassword, newPassword) {
    const auth = await this.storage.getJson('auth.json');

    if (!auth) {
      return { success: false, error: 'No auth data found' };
    }

    const isValid = await verifyPassword(oldPassword, auth.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Invalid current password' };
    }

    const newHash = await hashPassword(newPassword);
    await this.storage.setJson('auth.json', {
      ...auth,
      passwordHash: newHash
    });

    this.storage.logAction({
      type: 'auth:password_changed',
      status: 'success',
      timestamp: Date.now()
    });

    return { success: true };
  }
}

module.exports = AuthService;
