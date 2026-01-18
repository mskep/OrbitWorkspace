const RoleManager = require('./roleManager');

/**
 * Access Control - Vérification permissions et accès tools
 */
class AccessControl {
  constructor(storage, logManager) {
    this.storage = storage;
    this.logManager = logManager;
  }

  /**
   * Check if user can access tool
   */
  async canAccessTool(userId, toolManifest) {
    try {
      const profile = await this.storage.get('profile');

      if (!profile) {
        return {
          allowed: false,
          reason: 'USER_NOT_FOUND'
        };
      }

      const toolAccess = toolManifest.access || {};

      // 1. Check role authorization
      const roleCheck = RoleManager.canAccessTool(profile.role, toolAccess);
      if (!roleCheck.allowed) {
        this.logManager?.log({
          type: 'security:role_violation',
          severity: 'warning',
          userId: profile.userId,
          username: profile.username,
          userRole: profile.role,
          toolId: toolManifest.id,
          toolName: toolManifest.name,
          reason: roleCheck.reason
        });

        return roleCheck;
      }

      // 2. Check premium requirement
      if (toolAccess.requiresPremium && !profile.premium) {
        return {
          allowed: false,
          reason: 'PREMIUM_REQUIRED'
        };
      }

      // 3. Check system permissions
      const requiredPermissions = toolManifest.permissions || [];
      const grantedPermissions = profile.permissions?.granted || [];

      const missingPermissions = requiredPermissions.filter(
        perm => !grantedPermissions.includes(perm)
      );

      if (missingPermissions.length > 0) {
        this.logManager?.log({
          type: 'security:permission_denied',
          severity: 'warning',
          userId: profile.userId,
          username: profile.username,
          toolId: toolManifest.id,
          toolName: toolManifest.name,
          missingPermissions
        });

        return {
          allowed: false,
          reason: 'MISSING_PERMISSIONS',
          missing: missingPermissions
        };
      }

      // 4. Check daily usage limits (non-admin only)
      if (profile.roleLevel < 4 && toolAccess.restrictions?.maxDailyUsage) {
        const todayUsage = await this.getToolUsageToday(userId, toolManifest.id);
        if (todayUsage >= toolAccess.restrictions.maxDailyUsage) {
          return {
            allowed: false,
            reason: 'DAILY_LIMIT_REACHED',
            limit: toolAccess.restrictions.maxDailyUsage,
            usage: todayUsage
          };
        }
      }

      // ✅ Access granted
      return { allowed: true };

    } catch (error) {
      console.error('Access control error:', error);
      return {
        allowed: false,
        reason: 'ACCESS_CHECK_ERROR',
        error: error.message
      };
    }
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId, permission) {
    try {
      const profile = await this.storage.get('profile');
      if (!profile) return false;

      const granted = profile.permissions?.granted || [];
      const denied = profile.permissions?.denied || [];

      // Denied overrides granted
      if (denied.includes(permission)) return false;

      return granted.includes(permission);
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Get tool usage count for today
   */
  async getToolUsageToday(userId, toolId) {
    try {
      if (!this.logManager) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const logs = await this.logManager.search({
        userId,
        toolId,
        type: 'tool:run',
        status: 'success',
        startDate: today.getTime()
      });

      return logs.length;
    } catch (error) {
      console.error('Usage count error:', error);
      return 0;
    }
  }

  /**
   * Get user's accessible tools from list
   */
  async filterAccessibleTools(userId, tools) {
    const accessibleTools = [];

    for (const tool of tools) {
      const access = await this.canAccessTool(userId, tool);
      accessibleTools.push({
        ...tool,
        access
      });
    }

    return accessibleTools;
  }

  /**
   * Log access attempt
   */
  logAccessAttempt(userId, toolId, allowed, reason = null) {
    if (!this.logManager) return;

    this.logManager.log({
      type: allowed ? 'tool:access_granted' : 'tool:access_denied',
      severity: allowed ? 'info' : 'warning',
      userId,
      toolId,
      allowed,
      reason
    });
  }
}

module.exports = AccessControl;
