const WebSocket = require('ws');

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const PING_INTERVAL_MS = 25_000;

/**
 * WebSocketClient — Manages a persistent WebSocket connection to the server.
 *
 * Protocol:
 *   1. Client calls POST /api/v1/sync/ws-ticket (via ApiClient) to get a one-time ticket
 *   2. Client connects to wss://api.orbitenv.com/api/v1/sync/realtime?ticket=<ticket>
 *   3. Server sends { type: 'connected', device_id, timestamp }
 *   4. Server pushes { type: 'sync_events', events: [...] } when other devices push data
 *   5. Client uses ping/pong to keep the connection alive
 *
 * Auto-reconnects with exponential backoff on disconnect.
 */
class WebSocketClient {
  constructor(apiClient, baseUrl = process.env.ORBIT_WS_URL || 'wss://api.orbitenv.com') {
    this.apiClient = apiClient;
    this.baseUrl = baseUrl;
    this.ws = null;
    this._listeners = new Map(); // event → Set<callback>
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._pingInterval = null;
    this._active = false; // Whether we should be connected
    this._deviceId = null;
  }

  /**
   * Start the WebSocket connection.
   * Acquires a ticket and connects. Auto-reconnects on disconnect.
   */
  async connect() {
    this._active = true;
    this._reconnectAttempts = 0;
    await this._doConnect();
  }

  /**
   * Disconnect and stop reconnecting.
   */
  disconnect() {
    this._active = false;
    this._clearTimers();
    if (this.ws) {
      try { this.ws.close(1000, 'Client disconnect'); } catch { /* ignore */ }
      this.ws = null;
    }
  }

  /**
   * Register an event listener.
   * Events: 'connected', 'sync_events', 'disconnected', 'error'
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
  }

  off(event, callback) {
    this._listeners.get(event)?.delete(callback);
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ============================================================
  // INTERNAL
  // ============================================================

  async _doConnect() {
    if (!this._active) return;

    try {
      // Get one-time ticket from server
      const { ticket } = await this.apiClient.getWsTicket();

      const wsUrl = `${this.baseUrl}/api/v1/sync/realtime?ticket=${ticket}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this._reconnectAttempts = 0;
        this._startPing();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this._emit(msg.type, msg);
        } catch { /* ignore malformed messages */ }
      });

      this.ws.on('close', (code, reason) => {
        this._clearTimers();
        this._emit('disconnected', { code, reason: reason?.toString() });
        if (this._active && code !== 1000) {
          this._scheduleReconnect();
        }
      });

      this.ws.on('error', (err) => {
        this._emit('error', { message: err.message });
      });

    } catch (err) {
      this._emit('error', { message: err.message });
      if (this._active) {
        this._scheduleReconnect();
      }
    }
  }

  _scheduleReconnect() {
    if (!this._active || this._reconnectTimer) return;

    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this._reconnectAttempts),
      RECONNECT_MAX_MS,
    );
    this._reconnectAttempts++;

    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      await this._doConnect();
    }, delay);
  }

  _startPing() {
    this._clearPing();
    this._pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch { /* ignore */ }
      }
    }, PING_INTERVAL_MS);
  }

  _clearPing() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  _clearTimers() {
    this._clearPing();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  _emit(event, data) {
    const callbacks = this._listeners.get(event);
    if (!callbacks) return;
    for (const cb of callbacks) {
      try { cb(data); } catch (err) {
        console.error(`WebSocketClient: listener error on "${event}":`, err.message);
      }
    }
  }
}

module.exports = WebSocketClient;
