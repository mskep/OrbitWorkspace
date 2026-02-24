const { v4: uuidv4 } = require('uuid');
const { LOG_SEVERITY, LOG_CATEGORY } = require('../shared/constants');

/**
 * Log Manager - Enhanced logging with real-time broadcast
 */
class LogManager {
  constructor(db, websocketServer = null) {
    this.db = db;
    this.wsServer = websocketServer;
    this.initDatabase();
  }

  /**
   * Initialize enhanced logs table
   */
  initDatabase() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS action_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        timestamp INTEGER NOT NULL,
        duration_ms INTEGER,

        user_id TEXT,
        username TEXT,
        user_role TEXT,
        user_role_level INTEGER,

        action_type TEXT NOT NULL,
        tool_id TEXT,
        tool_name TEXT,
        action_name TEXT,

        request_payload TEXT,
        response_data TEXT,

        status TEXT NOT NULL,
        error_message TEXT,
        error_stack TEXT,

        permissions_required TEXT,
        permissions_granted INTEGER DEFAULT 1,
        role_authorized INTEGER DEFAULT 1,

        ip_address TEXT,
        user_agent TEXT,

        severity TEXT DEFAULT 'info',
        category TEXT DEFAULT 'system',
        tags TEXT
      )
    `;

    this.db.exec(createTableSQL);

    // Create indexes
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_timestamp ON action_logs(timestamp)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_user_id ON action_logs(user_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_status ON action_logs(status)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_category ON action_logs(category)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_severity ON action_logs(severity)');
  }

  /**
   * Sanitize sensitive data from payloads before logging
   * SECURITY: Never log passwords, tokens, or other sensitive data
   */
  sanitizePayload(payload, actionType) {
    if (!payload) return null;

    // List of sensitive fields to redact
    const sensitiveFields = [
      'password', 'password_hash', 'token', 'accessToken', 'refreshToken',
      'secret', 'apiKey', 'api_key', 'privateKey', 'private_key',
      'credentials', 'authorization', 'auth'
    ];

    // For auth actions, be extra careful - only log minimal info
    if (actionType && actionType.startsWith('auth:')) {
      // For auth:register and auth:login, only log that it happened, not the details
      if (actionType === 'auth:register') {
        return { action: 'user_registration', email: '[REDACTED]', username: '[REDACTED]' };
      }
      if (actionType === 'auth:login') {
        return { action: 'user_login', identifier: '[REDACTED]' };
      }
      // For other auth actions, redact everything
      return { action: actionType, details: '[REDACTED]' };
    }

    // Deep clone and sanitize
    const sanitized = JSON.parse(JSON.stringify(payload));

    const redactSensitive = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;

      for (const key of Object.keys(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          redactSensitive(obj[key]);
        }
      }
      return obj;
    };

    return redactSensitive(sanitized);
  }

  /**
   * Log an action
   */
  log(logData) {
    try {
      // Sanitize payload before storing
      const sanitizedPayload = this.sanitizePayload(logData.payload, logData.type);
      const sanitizedResponse = this.sanitizePayload(logData.response, logData.type);

      const logEntry = {
        uuid: uuidv4(),
        timestamp: Date.now(),
        duration_ms: logData.duration || null,

        user_id: logData.userId || null,
        username: logData.username || null,
        user_role: logData.userRole || null,
        user_role_level: logData.userRoleLevel || null,

        action_type: logData.type || 'unknown',
        tool_id: logData.toolId || null,
        tool_name: logData.toolName || null,
        action_name: logData.action || null,

        request_payload: sanitizedPayload ? JSON.stringify(sanitizedPayload) : null,
        response_data: sanitizedResponse ? JSON.stringify(sanitizedResponse) : null,

        status: logData.status || 'success',
        error_message: logData.error || null,
        error_stack: logData.errorStack || null,

        permissions_required: logData.permissionsRequired ? JSON.stringify(logData.permissionsRequired) : null,
        permissions_granted: logData.permissionsGranted !== undefined ? (logData.permissionsGranted ? 1 : 0) : 1,
        role_authorized: logData.roleAuthorized !== undefined ? (logData.roleAuthorized ? 1 : 0) : 1,

        ip_address: logData.ip || null,
        user_agent: logData.userAgent || null,

        severity: logData.severity || LOG_SEVERITY.INFO,
        category: logData.category || this.getCategoryFromType(logData.type),
        tags: logData.tags ? JSON.stringify(logData.tags) : null
      };

      const stmt = this.db.prepare(`
        INSERT INTO action_logs (
          uuid, timestamp, duration_ms,
          user_id, username, user_role, user_role_level,
          action_type, tool_id, tool_name, action_name,
          request_payload, response_data,
          status, error_message, error_stack,
          permissions_required, permissions_granted, role_authorized,
          ip_address, user_agent,
          severity, category, tags
        ) VALUES (
          @uuid, @timestamp, @duration_ms,
          @user_id, @username, @user_role, @user_role_level,
          @action_type, @tool_id, @tool_name, @action_name,
          @request_payload, @response_data,
          @status, @error_message, @error_stack,
          @permissions_required, @permissions_granted, @role_authorized,
          @ip_address, @user_agent,
          @severity, @category, @tags
        )
      `);

      stmt.run(logEntry);

      // Broadcast to WebSocket clients (real-time)
      if (this.wsServer) {
        this.wsServer.broadcast('log:new', this.formatLogEntry({
          id: this.db.prepare('SELECT last_insert_rowid()').pluck().get(),
          ...logEntry
        }));
      }

      return logEntry.uuid;
    } catch (error) {
      console.error('Failed to log action:', error);
      return null;
    }
  }

  /**
   * Get category from action type
   */
  getCategoryFromType(type) {
    if (!type) return LOG_CATEGORY.SYSTEM;

    if (type.startsWith('auth:')) return LOG_CATEGORY.AUTH;
    if (type.startsWith('tool:')) return LOG_CATEGORY.TOOL;
    if (type.startsWith('security:')) return LOG_CATEGORY.SECURITY;

    return LOG_CATEGORY.SYSTEM;
  }

  /**
   * Get recent logs (tail)
   */
  tail({ limit = 50, offset = 0 } = {}) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM action_logs
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `);

      const logs = stmt.all(limit, offset);
      return logs.map(log => this.formatLogEntry(log));
    } catch (error) {
      console.error('Failed to tail logs:', error);
      return [];
    }
  }

  /**
   * Search logs with filters
   */
  search(filters = {}) {
    try {
      let query = 'SELECT * FROM action_logs WHERE 1=1';
      const params = [];

      if (filters.userId) {
        query += ' AND user_id = ?';
        params.push(filters.userId);
      }

      if (filters.toolId) {
        query += ' AND tool_id = ?';
        params.push(filters.toolId);
      }

      if (filters.type) {
        query += ' AND action_type = ?';
        params.push(filters.type);
      }

      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.category) {
        query += ' AND category = ?';
        params.push(filters.category);
      }

      if (filters.severity) {
        query += ' AND severity = ?';
        params.push(filters.severity);
      }

      if (filters.startDate) {
        query += ' AND timestamp >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ' AND timestamp <= ?';
        params.push(filters.endDate);
      }

      if (filters.search) {
        query += ` AND (
          action_type LIKE ? OR
          tool_name LIKE ? OR
          username LIKE ? OR
          error_message LIKE ?
        )`;
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      query += ' ORDER BY timestamp DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      const stmt = this.db.prepare(query);
      const logs = stmt.all(...params);

      return logs.map(log => this.formatLogEntry(log));
    } catch (error) {
      console.error('Failed to search logs:', error);
      return [];
    }
  }

  /**
   * Get log statistics
   */
  getStats({ startDate, endDate } = {}) {
    try {
      let whereClause = '1=1';
      const params = [];

      if (startDate) {
        whereClause += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND timestamp <= ?';
        params.push(endDate);
      }

      const stats = {
        total: this.db.prepare(`SELECT COUNT(*) FROM action_logs WHERE ${whereClause}`).pluck().get(...params),
        byStatus: {},
        byCategory: {},
        bySeverity: {},
        topUsers: [],
        topTools: []
      };

      // By status
      const statusStats = this.db.prepare(`
        SELECT status, COUNT(*) as count
        FROM action_logs
        WHERE ${whereClause}
        GROUP BY status
      `).all(...params);

      statusStats.forEach(row => {
        stats.byStatus[row.status] = row.count;
      });

      // By category
      const categoryStats = this.db.prepare(`
        SELECT category, COUNT(*) as count
        FROM action_logs
        WHERE ${whereClause}
        GROUP BY category
      `).all(...params);

      categoryStats.forEach(row => {
        stats.byCategory[row.category] = row.count;
      });

      // Top users
      stats.topUsers = this.db.prepare(`
        SELECT username, COUNT(*) as count
        FROM action_logs
        WHERE ${whereClause} AND username IS NOT NULL
        GROUP BY username
        ORDER BY count DESC
        LIMIT 5
      `).all(...params);

      // Top tools
      stats.topTools = this.db.prepare(`
        SELECT tool_name, COUNT(*) as count
        FROM action_logs
        WHERE ${whereClause} AND tool_name IS NOT NULL
        GROUP BY tool_name
        ORDER BY count DESC
        LIMIT 5
      `).all(...params);

      return stats;
    } catch (error) {
      console.error('Failed to get stats:', error);
      return null;
    }
  }

  /**
   * Format log entry for output
   */
  formatLogEntry(log) {
    return {
      id: log.id,
      uuid: log.uuid,
      timestamp: log.timestamp,
      duration: log.duration_ms,

      user: {
        id: log.user_id,
        username: log.username,
        role: log.user_role,
        roleLevel: log.user_role_level
      },

      action: {
        type: log.action_type,
        name: log.action_name,
        tool: {
          id: log.tool_id,
          name: log.tool_name
        }
      },

      request: log.request_payload ? JSON.parse(log.request_payload) : null,
      response: log.response_data ? JSON.parse(log.response_data) : null,

      status: log.status,
      error: log.error_message,
      errorStack: log.error_stack,

      permissions: {
        required: log.permissions_required ? JSON.parse(log.permissions_required) : [],
        granted: log.permissions_granted === 1,
        roleAuthorized: log.role_authorized === 1
      },

      meta: {
        ip: log.ip_address,
        userAgent: log.user_agent,
        severity: log.severity,
        category: log.category,
        tags: log.tags ? JSON.parse(log.tags) : []
      }
    };
  }

  /**
   * Export logs to JSON
   */
  exportToJSON(filters = {}) {
    const logs = this.search(filters);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Export logs to CSV
   */
  exportToCSV(filters = {}) {
    const logs = this.search(filters);

    const headers = [
      'timestamp',
      'username',
      'role',
      'action_type',
      'tool_name',
      'status',
      'severity',
      'category',
      'error_message'
    ];

    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.user.username || 'N/A',
      log.user.role || 'N/A',
      log.action.type,
      log.action.tool.name || 'N/A',
      log.status,
      log.meta.severity,
      log.meta.category,
      log.error || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
  }

  /**
   * Clean old logs (retention policy)
   */
  cleanOldLogs(daysToKeep = 90) {
    const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    const stmt = this.db.prepare('DELETE FROM action_logs WHERE timestamp < ?');
    const result = stmt.run(cutoffDate);

    return result.changes;
  }
}

module.exports = LogManager;
