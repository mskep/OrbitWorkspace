const { ROLE_PERMISSIONS } = require('../shared/constants');

class PermissionsManager {
  constructor(dbService, authService) {
    this.dbService = dbService;
    this.authService = authService;
  }

  /**
   * Get permissions for a role from the ROLE_PERMISSIONS map.
   * Falls back to USER permissions if role not found.
   */
  _getPermissionsForRole(role) {
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.USER || [];
  }

  async getProfile() {
    try {
      const session = await this.authService.getSession();
      if (!session) {
        return null;
      }

      const repos = this.dbService.getRepositories();
      const user = repos.users.findById(session.userId);
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        permissions: this._getPermissionsForRole(user.role),
        premiumEnabled: user.role === 'PREMIUM' || user.role === 'ADMIN' || user.role === 'DEV',
        createdAt: user.created_at
      };
    } catch (error) {
      console.error('Error getting profile:', error);
      return null;
    }
  }

  async updateProfile(updates) {
    try {
      const session = await this.authService.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      // Users cannot self-promote roles — only admins can change roles
      // Premium toggle is disabled for self-service
      return await this.getProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  }

  async checkPermissions(toolId, requiredPerms) {
    const profile = await this.getProfile();
    if (!profile) {
      return {
        allowed: false,
        missingPermissions: requiredPerms
      };
    }

    // Check each required permission
    const missingPerms = [];
    for (const perm of requiredPerms) {
      if (!profile.permissions.includes(perm)) {
        missingPerms.push(perm);
      }
    }

    const hasPermission = missingPerms.length === 0;

    // No logging for now (user said no action logs in v0.x)

    return {
      allowed: hasPermission,
      missingPermissions: missingPerms
    };
  }

  async setPermission(permission, enabled) {
    const profile = await this.getProfile();
    let permissions = [...profile.permissions];

    if (enabled && !permissions.includes(permission)) {
      permissions.push(permission);
    } else if (!enabled) {
      permissions = permissions.filter(p => p !== permission);
    }

    return this.updateProfile({ permissions });
  }

  async isPremium() {
    const profile = await this.getProfile();
    return profile.premiumEnabled === true;
  }

  async setPremium(enabled) {
    return this.updateProfile({ premiumEnabled: enabled });
  }
}

module.exports = PermissionsManager;
