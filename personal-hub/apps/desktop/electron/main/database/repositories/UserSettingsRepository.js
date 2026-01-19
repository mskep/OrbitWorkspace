/**
 * UserSettingsRepository - Manages user settings and preferences
 */
class UserSettingsRepository {
  constructor(db, encryptionService) {
    this.db = db;
    this.encryption = encryptionService;
  }

  /**
   * Create default settings for a user
   */
  create(userId, activeWorkspaceId = null) {
    const now = Math.floor(Date.now() / 1000);

    const stmt = this.db.prepare(`
      INSERT INTO user_settings (user_id, active_workspace_id, theme, language, notifications_enabled, auto_launch_enabled, settings_json_encrypted, updated_at)
      VALUES (?, ?, 'dark', 'en', 1, 0, NULL, ?)
    `);

    stmt.run(userId, activeWorkspaceId, now);
    return this.findByUserId(userId);
  }

  /**
   * Find settings by user ID
   */
  findByUserId(userId) {
    const stmt = this.db.prepare('SELECT * FROM user_settings WHERE user_id = ?');
    const settings = stmt.get(userId);

    if (settings && settings.settings_json_encrypted) {
      settings.additionalSettings = this.encryption.decryptJSON(settings.settings_json_encrypted);
      delete settings.settings_json_encrypted;
    }

    return settings;
  }

  /**
   * Update active workspace
   */
  updateActiveWorkspace(userId, workspaceId) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE user_settings SET active_workspace_id = ?, updated_at = ? WHERE user_id = ?');
    stmt.run(workspaceId, now, userId);
  }

  /**
   * Get active workspace ID for a user
   */
  getActiveWorkspaceId(userId) {
    const stmt = this.db.prepare('SELECT active_workspace_id FROM user_settings WHERE user_id = ?');
    const result = stmt.get(userId);
    return result ? result.active_workspace_id : null;
  }

  /**
   * Update theme
   */
  updateTheme(userId, theme) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE user_settings SET theme = ?, updated_at = ? WHERE user_id = ?');
    stmt.run(theme, now, userId);
  }

  /**
   * Update language
   */
  updateLanguage(userId, language) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE user_settings SET language = ?, updated_at = ? WHERE user_id = ?');
    stmt.run(language, now, userId);
  }

  /**
   * Update notifications enabled
   */
  updateNotifications(userId, enabled) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE user_settings SET notifications_enabled = ?, updated_at = ? WHERE user_id = ?');
    stmt.run(enabled ? 1 : 0, now, userId);
  }

  /**
   * Update auto launch enabled
   */
  updateAutoLaunch(userId, enabled) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE user_settings SET auto_launch_enabled = ?, updated_at = ? WHERE user_id = ?');
    stmt.run(enabled ? 1 : 0, now, userId);
  }

  /**
   * Update additional settings (encrypted JSON)
   */
  updateAdditionalSettings(userId, settingsObj) {
    const now = Math.floor(Date.now() / 1000);
    const encrypted = this.encryption.encryptJSON(settingsObj);

    const stmt = this.db.prepare('UPDATE user_settings SET settings_json_encrypted = ?, updated_at = ? WHERE user_id = ?');
    stmt.run(encrypted, now, userId);
  }

  /**
   * Update multiple settings at once
   */
  update(userId, updates) {
    const now = Math.floor(Date.now() / 1000);
    const fields = [];
    const params = [];

    if (updates.activeWorkspaceId !== undefined) {
      fields.push('active_workspace_id = ?');
      params.push(updates.activeWorkspaceId);
    }
    if (updates.theme !== undefined) {
      fields.push('theme = ?');
      params.push(updates.theme);
    }
    if (updates.language !== undefined) {
      fields.push('language = ?');
      params.push(updates.language);
    }
    if (updates.notificationsEnabled !== undefined) {
      fields.push('notifications_enabled = ?');
      params.push(updates.notificationsEnabled ? 1 : 0);
    }
    if (updates.autoLaunchEnabled !== undefined) {
      fields.push('auto_launch_enabled = ?');
      params.push(updates.autoLaunchEnabled ? 1 : 0);
    }
    if (updates.additionalSettings !== undefined) {
      fields.push('settings_json_encrypted = ?');
      params.push(this.encryption.encryptJSON(updates.additionalSettings));
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    params.push(now);
    params.push(userId);

    const stmt = this.db.prepare(`UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`);
    stmt.run(...params);
  }
}

module.exports = UserSettingsRepository;
