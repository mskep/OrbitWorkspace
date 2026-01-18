const WebSocket = require('ws');

/**
 * WebSocket Server for real-time log broadcasting
 */
class WebSocketServer {
  constructor(port = 9876) {
    this.port = port;
    this.wss = null;
    this.clients = new Set();
  }

  /**
   * Start WebSocket server
   */
  start() {
    try {
      this.wss = new WebSocket.Server({ port: this.port });

      this.wss.on('connection', (ws) => {
        console.log('[WebSocket] Client connected');
        this.clients.add(ws);

        ws.on('close', () => {
          console.log('[WebSocket] Client disconnected');
          this.clients.delete(ws);
        });

        ws.on('error', (error) => {
          console.error('[WebSocket] Error:', error);
          this.clients.delete(ws);
        });

        // Send welcome message
        ws.send(JSON.stringify({
          type: 'connected',
          message: 'WebSocket connected'
        }));
      });

      console.log(`[WebSocket] Server started on port ${this.port}`);
    } catch (error) {
      console.error('[WebSocket] Failed to start server:', error);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(event, data) {
    const message = JSON.stringify({
      event,
      data,
      timestamp: Date.now()
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('[WebSocket] Failed to send to client:', error);
        }
      }
    });
  }

  /**
   * Stop WebSocket server
   */
  stop() {
    if (this.wss) {
      this.clients.forEach((client) => {
        client.close();
      });
      this.wss.close();
      console.log('[WebSocket] Server stopped');
    }
  }

  /**
   * Get number of connected clients
   */
  getClientCount() {
    return this.clients.size;
  }
}

module.exports = WebSocketServer;
