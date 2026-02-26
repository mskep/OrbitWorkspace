const https = require('https');
const http = require('http');

const DEFAULT_BASE_URL = process.env.ORBIT_API_URL || 'https://api.orbitenv.com';
const API_PREFIX = '/api/v1';
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * ApiClient — HTTP client for the Orbit sync server.
 *
 * Handles:
 *   - JSON request/response
 *   - Bearer token injection
 *   - Automatic token refresh on 401
 *   - Retry once after refresh
 */
class ApiClient {
  constructor(tokenStore, baseUrl = DEFAULT_BASE_URL) {
    this.tokenStore = tokenStore;
    this.baseUrl = baseUrl;
    this._refreshPromise = null; // Dedup concurrent refresh calls
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /** POST /api/v1/auth/register */
  async register(data) {
    return this._request('POST', '/auth/register', data, false);
  }

  /** POST /api/v1/auth/login */
  async login(data) {
    return this._request('POST', '/auth/login', data, false);
  }

  /** POST /api/v1/auth/refresh */
  async refreshTokens(refreshToken) {
    return this._request('POST', '/auth/refresh', { refresh_token: refreshToken }, false);
  }

  /** POST /api/v1/auth/logout */
  async logout() {
    return this._request('POST', '/auth/logout', null, true);
  }

  /** GET /api/v1/sync/pull?since=&type= */
  async pull(since = 0, type = null) {
    let qs = `since=${since}`;
    if (type) qs += `&type=${encodeURIComponent(type)}`;
    return this._request('GET', `/sync/pull?${qs}`, null, true);
  }

  /** POST /api/v1/sync/push */
  async push(blobs) {
    return this._request('POST', '/sync/push', { blobs }, true);
  }

  /** POST /api/v1/sync/ws-ticket */
  async getWsTicket() {
    return this._request('POST', '/sync/ws-ticket', null, true);
  }

  /** GET /api/v1/devices */
  async getDevices() {
    return this._request('GET', '/devices', null, true);
  }

  /** DELETE /api/v1/devices/:id */
  async deleteDevice(deviceId) {
    return this._request('DELETE', `/devices/${deviceId}`, null, true);
  }

  /** POST /api/v1/auth/recover */
  async recover(email) {
    return this._request('POST', '/auth/recover', { email }, false);
  }

  /** PUT /api/v1/auth/password */
  async changePassword(data) {
    return this._request('PUT', '/auth/password', data, true);
  }

  /** POST /api/v1/auth/recover-reset (after client-side recovery) */
  async recoverReset(data) {
    return this._request('POST', '/auth/recover-reset', data, true);
  }

  // ============================================================
  // ADMIN
  // ============================================================

  /** GET /api/v1/admin/users */
  async getUsers() {
    return this._request('GET', '/admin/users', null, true);
  }

  /** PUT /api/v1/admin/users/:id/role */
  async updateUserRole(userId, role) {
    return this._request('PUT', `/admin/users/${userId}/role`, { role }, true);
  }

  /** PUT /api/v1/admin/users/:id/status */
  async updateUserStatus(userId, status) {
    return this._request('PUT', `/admin/users/${userId}/status`, { status }, true);
  }

  /** POST /api/v1/admin/broadcast */
  async broadcast(data) {
    return this._request('POST', '/admin/broadcast', data, true);
  }

  /** GET /api/v1/admin/stats */
  async getAdminStats() {
    return this._request('GET', '/admin/stats', null, true);
  }

  /** GET /api/v1/admin/audit-logs */
  async getAdminAuditLogs(filters = {}) {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '') params.set(key, val);
    }
    const qs = params.toString();
    return this._request('GET', `/admin/audit-logs${qs ? '?' + qs : ''}`, null, true);
  }

  // ============================================================
  // AUDIT LOGS (client push)
  // ============================================================

  /** POST /api/v1/audit-logs — push client logs to server */
  async pushAuditLogs(logs, deviceId) {
    return this._request('POST', '/audit-logs', { logs, device_id: deviceId }, true);
  }

  // ============================================================
  // BADGES (server-authoritative)
  // ============================================================

  /** GET /api/v1/badges */
  async getBadges() {
    return this._request('GET', '/badges', null, true);
  }

  /** GET /api/v1/badges/mine */
  async getMyBadges() {
    return this._request('GET', '/badges/mine', null, true);
  }

  /** GET /api/v1/badges/user/:userId */
  async getUserBadges(userId) {
    return this._request('GET', `/badges/user/${userId}`, null, true);
  }

  /** POST /api/v1/badges/assign (ADMIN) */
  async assignBadge(userId, badgeId) {
    return this._request('POST', '/badges/assign', { userId, badgeId }, true);
  }

  /** POST /api/v1/badges/revoke (ADMIN) */
  async revokeBadge(userId, badgeId) {
    return this._request('POST', '/badges/revoke', { userId, badgeId }, true);
  }

  // ============================================================
  // INBOX (server-authoritative)
  // ============================================================

  /** GET /api/v1/inbox (optional ?since= for incremental) */
  async getInboxMessages(since = null) {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return this._request('GET', `/inbox${qs}`, null, true);
  }

  /** GET /api/v1/inbox/unread-count */
  async getInboxUnreadCount() {
    return this._request('GET', '/inbox/unread-count', null, true);
  }

  /** PUT /api/v1/inbox/:id/read */
  async markInboxRead(messageId) {
    return this._request('PUT', `/inbox/${messageId}/read`, null, true);
  }

  /** PUT /api/v1/inbox/read-all */
  async markInboxAllRead() {
    return this._request('PUT', '/inbox/read-all', null, true);
  }

  /** DELETE /api/v1/inbox/:id */
  async deleteInboxMessage(messageId) {
    return this._request('DELETE', `/inbox/${messageId}`, null, true);
  }

  /** DELETE /api/v1/inbox/read */
  async deleteInboxReadMessages() {
    return this._request('DELETE', '/inbox/read', null, true);
  }

  /** POST /api/v1/inbox/broadcast (ADMIN/DEV) */
  async sendInboxBroadcast(data) {
    return this._request('POST', '/inbox/broadcast', data, true);
  }

  /** GET /api/v1/inbox/broadcast-history (ADMIN/DEV) */
  async getInboxBroadcastHistory(limit = 50) {
    const qs = Number.isFinite(Number(limit)) ? `?limit=${Math.min(Math.max(Math.floor(Number(limit)), 1), 200)}` : '';
    return this._request('GET', `/inbox/broadcast-history${qs}`, null, true);
  }

  // ============================================================
  // INTERNAL
  // ============================================================

  async _request(method, path, body, authenticated, _isRetry = false) {
    const url = new URL(API_PREFIX + path, this.baseUrl);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const headers = {};

    if (authenticated) {
      const tokens = this.tokenStore.getTokens();
      if (!tokens?.access_token) {
        throw new ApiError(401, 'NOT_AUTHENTICATED', 'No access token available');
      }
      headers['Authorization'] = `Bearer ${tokens.access_token}`;
    }

    const payload = body === null || body === undefined ? null : JSON.stringify(body);
    if (payload !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers,
      timeout: REQUEST_TIMEOUT_MS,
    };

    const { statusCode, data } = await new Promise((resolve, reject) => {
      const req = transport.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let parsed;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = raw;
          }
          resolve({ statusCode: res.statusCode, data: parsed });
        });
      });

      req.on('error', (err) => reject(new ApiError(0, 'NETWORK_ERROR', err.message)));
      req.on('timeout', () => {
        req.destroy();
        reject(new ApiError(0, 'TIMEOUT', 'Request timed out'));
      });

      if (payload) req.write(payload);
      req.end();
    });

    // 401 + authenticated + not already retrying → try token refresh
    if (statusCode === 401 && authenticated && !_isRetry) {
      const refreshed = await this._tryRefresh();
      if (refreshed) {
        return this._request(method, path, body, true, true);
      }
    }

    if (statusCode >= 400) {
      const code = data?.code || data?.error || `HTTP_${statusCode}`;
      const message = data?.message || data?.error || `Server returned ${statusCode}`;
      throw new ApiError(statusCode, code, message);
    }

    return data;
  }

  /**
   * Attempt to refresh the access token using the stored refresh token.
   * Deduplicates concurrent refresh calls.
   */
  async _tryRefresh() {
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = (async () => {
      try {
        const tokens = this.tokenStore.getTokens();
        if (!tokens?.refresh_token) return false;

        const result = await this.refreshTokens(tokens.refresh_token);
        this.tokenStore.saveTokens({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        return true;
      } catch {
        // Refresh failed — session is dead
        this.tokenStore.clearTokens();
        return false;
      } finally {
        this._refreshPromise = null;
      }
    })();

    return this._refreshPromise;
  }
}

class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = { ApiClient, ApiError };

