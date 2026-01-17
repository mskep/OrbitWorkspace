const https = require('https');

class NetworkMonitor {
  constructor() {
    this.isOnline = true;
    this.checkInterval = null;
    this.listeners = [];
  }

  start(intervalMs = 30000) {
    this.checkConnection();
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
      const req = https.request(
        {
          method: 'HEAD',
          hostname: 'www.google.com',
          path: '/',
          timeout: 5000
        },
        (res) => {
          const wasOnline = this.isOnline;
          this.isOnline = res.statusCode >= 200 && res.statusCode < 400;

          if (wasOnline !== this.isOnline) {
            this.notifyListeners(this.isOnline);
          }

          resolve(this.isOnline);
        }
      );

      req.on('error', () => {
        const wasOnline = this.isOnline;
        this.isOnline = false;

        if (wasOnline !== this.isOnline) {
          this.notifyListeners(this.isOnline);
        }

        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        const wasOnline = this.isOnline;
        this.isOnline = false;

        if (wasOnline !== this.isOnline) {
          this.notifyListeners(this.isOnline);
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
