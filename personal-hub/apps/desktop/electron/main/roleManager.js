const { ROLES, ROLE_LEVELS, ROLE_PERMISSIONS } = require('../shared/constants');

/**
 * Role Manager - Gestion des rôles utilisateur
 */
class RoleManager {
  /**
   * Get role level (1-4)
   */
  static getRoleLevel(role) {
    return ROLE_LEVELS[role] || 1;
  }

  /**
   * Check if role has sufficient level
   */
  static hasMinimumLevel(userRole, requiredLevel) {
    const userLevel = this.getRoleLevel(userRole);
    return userLevel >= requiredLevel;
  }

  /**
   * Check if role is in allowed list
   */
  static isRoleAllowed(userRole, allowedRoles) {
    if (!allowedRoles || allowedRoles.length === 0) {
      return true; // No restriction
    }
    return allowedRoles.includes(userRole);
  }

  /**
   * Get default permissions for role
   */
  static getDefaultPermissions(role) {
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.USER;
  }

  /**
   * Check if role can access tool
   */
  static canAccessTool(userRole, toolAccess) {
    const userLevel = this.getRoleLevel(userRole);

    // Check minimum role level
    if (toolAccess.minRoleLevel && userLevel < toolAccess.minRoleLevel) {
      return {
        allowed: false,
        reason: 'INSUFFICIENT_ROLE_LEVEL',
        required: toolAccess.minRoleLevel
      };
    }

    // Check allowed roles
    if (toolAccess.allowedRoles && toolAccess.allowedRoles.length > 0) {
      if (!toolAccess.allowedRoles.includes(userRole)) {
        return {
          allowed: false,
          reason: 'ROLE_NOT_ALLOWED',
          required: toolAccess.allowedRoles
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Get role display info
   */
  static getRoleInfo(role) {
    const info = {
      ADMIN: {
        label: 'Admin',
        description: 'Full system access',
        color: '#dc2626',
        capabilities: [
          'All Tools Access',
          'User Management',
          'System Configuration',
          'Full Logs Access',
          'Premium Features',
          'Unlimited Usage'
        ]
      },
      DEV: {
        label: 'Developer',
        description: 'Development tools access',
        color: '#6366f1',
        capabilities: [
          'All Development Tools',
          'Advanced Logs',
          'Debug Tools',
          'Premium Features',
          'Tool Installation'
        ]
      },
      PREMIUM: {
        label: 'Premium',
        description: 'Premium tools access',
        color: '#f59e0b',
        capabilities: [
          'Premium Tools',
          'Standard Tools',
          'Personal Logs',
          'Higher Limits',
          'Tool Installation'
        ]
      },
      USER: {
        label: 'User',
        description: 'Basic tools access',
        color: '#64748b',
        capabilities: [
          'Free Tools',
          'Basic Logs',
          'Standard Features'
        ]
      }
    };

    return info[role] || info.USER;
  }

  /**
   * Validate role
   */
  static isValidRole(role) {
    return Object.values(ROLES).includes(role);
  }

  /**
   * Get all roles
   */
  static getAllRoles() {
    return Object.values(ROLES);
  }
}

module.exports = RoleManager;
