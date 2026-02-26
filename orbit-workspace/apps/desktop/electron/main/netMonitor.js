const https = require('https');
const http = require('http');

const HEALTH_URL = new URL(process.env.ORBIT_API_URL || 'https://api.orbitenv.com');

class NetworkMonitor {
  constructor() {
    this.isOnline = true;
    this.checkInterval = null;
    this.listeners = [];
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this._normalInterval = 30000;
    this._fastInterval = 5000; // Fast polling when offline to detect recovery quickly
  }

  start(intervalMs = 30000) {
    this._normalInterval = intervalMs;
    // Initial check
    this.checkConnection();
    this._scheduleNext();

    // Listen to Electron/OS network change events for instant detection
    try {
      const { app } = require('electron');
      app.whenReady().then(() => {
        const { net } = require('electron');
        // Electron's net.online is a quick first signal
        if (typeof net.isOnline === 'function' || net.online !== undefined) {
          // Poll the Electron net.online flag alongside our health check
          setInterval(() => {
            const electronOnline = typeof net.isOnline === 'function' ? net.isOnline() : net.online;
            if (!electronOnline && this.isOnline) {
              // Electron says offline — run an immediate health check to confirm
              this.checkConnection();
            }
          }, 3000);
        }
      });
    } catch { /* not in Electron context */ }
  }

  _scheduleNext() {
    if (this.checkInterval) clearTimeout(this.checkInterval);
    const delay = this.isOnline ? this._normalInterval : this._fastInterval;
    this.checkInterval = setTimeout(() => {
      this.checkConnection();
      this._scheduleNext();
    }, delay);
  }

  stop() {
    if (this.checkInterval) {
      clearTimeout(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async checkConnection() {
    return new Promise((resolve) => {
      const transport = HEALTH_URL.protocol === 'https:' ? https : http;
      const req = transport.request(
        {
          method: 'HEAD',
          hostname: HEALTH_URL.hostname,
          port: HEALTH_URL.port || (HEALTH_URL.protocol === 'https:' ? 443 : 80),
          path: '/health',
          timeout: 8000
        },
        (res) => {
          const success = res.statusCode >= 200 && res.statusCode < 400;

          if (success) {
            this.consecutiveSuccesses++;
            this.consecutiveFailures = 0;

            if (!this.isOnline) {
              this.isOnline = true;
              this.notifyListeners(true);
              this._scheduleNext(); // Switch back to normal interval
            }
          }

          resolve(success);
        }
      );

      req.on('error', () => {
        this._handleFailure();
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        this._handleFailure();
        resolve(false);
      });

      req.end();
    });
  }

  _handleFailure() {
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;

    // Mark offline after 2 consecutive failures
    if (this.isOnline && this.consecutiveFailures >= 2) {
      this.isOnline = false;
      this.notifyListeners(false);
      this._scheduleNext(); // Switch to fast interval
    }
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  notifyListeners(online) {
    this.listeners.forEach(callback => {
      try {
        callback(online);
      } catch (error) {
        console.error('Error in network listener:', error);
      }
    });
  }

  getStatus() {
    return this.isOnline;
  }
}

module.exports = NetworkMonitor;
