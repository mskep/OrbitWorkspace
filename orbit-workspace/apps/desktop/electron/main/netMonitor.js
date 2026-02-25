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
  }

  start(intervalMs = 60000) {
    // Start with initial check
    this.checkConnection();
    // Check every 60 seconds (instead of 30)
    this.checkInterval = setInterval(() => {
      this.checkConnection();
    }, intervalMs);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
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
          timeout: 10000
        },
        (res) => {
          const success = res.statusCode >= 200 && res.statusCode < 400;

          if (success) {
            this.consecutiveSuccesses++;
            this.consecutiveFailures = 0;

            // Only mark as online after 1 successful check
            if (!this.isOnline && this.consecutiveSuccesses >= 1) {
              this.isOnline = true;
              this.notifyListeners(true);
            } else if (!this.isOnline) {
              this.isOnline = true;
              this.notifyListeners(true);
            }
          }

          resolve(success);
        }
      );

      req.on('error', () => {
        this.consecutiveFailures++;
        this.consecutiveSuccesses = 0;

        // Only mark as offline after 2 consecutive failures to avoid false positives
        if (this.isOnline && this.consecutiveFailures >= 2) {
          this.isOnline = false;
          this.notifyListeners(false);
        }

        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        this.consecutiveFailures++;
        this.consecutiveSuccesses = 0;

        // Only mark as offline after 2 consecutive failures
        if (this.isOnline && this.consecutiveFailures >= 2) {
          this.isOnline = false;
          this.notifyListeners(false);
        }

        resolve(false);
      });

      req.end();
    });
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
