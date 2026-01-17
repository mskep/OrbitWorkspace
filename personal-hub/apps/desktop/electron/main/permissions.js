const { PERMISSIONS } = require('../shared/constants');

class PermissionsManager {
  constructor(storage) {
    this.storage = storage;
  }

  async getProfile() {
    let profile = await this.storage.getJson('profile.json');

    if (!profile) {
      // Create default profile with all permissions
      profile = {
        username: 'admin',
        permissions: Object.values(PERMISSIONS),
        premiumEnabled: false,
        createdAt: Date.now()
      };
      await this.storage.setJson('profile.json', profile);
    }

    return profile;
  }

  async updateProfile(updates) {
    const profile = await this.getProfile();
    const newProfile = { ...profile, ...updates };
    await this.storage.setJson('profile.json', newProfile);
    return newProfile;
  }

  async checkPermissions(toolId, requiredPerms) {
    const profile = await this.getProfile();

    // Check each required permission
    const missingPerms = [];
    for (const perm of requiredPerms) {
      if (!profile.permissions.includes(perm)) {
        missingPerms.push(perm);
      }
    }

    const hasPermission = missingPerms.length === 0;

    if (!hasPermission) {
      this.storage.logAction({
        type: 'permission:denied',
        toolId,
        payload: { requiredPerms, missingPerms },
        status: 'blocked',
        timestamp: Date.now()
      });
    }

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
