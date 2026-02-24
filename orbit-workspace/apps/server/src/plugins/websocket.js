import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import crypto from 'node:crypto';

async function ws(fastify) {
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB max
      clientTracking: false, // We track connections ourselves
    },
  });

  // Map<userId, Map<deviceId, WebSocket>>
  const connections = new Map();

  // Ticket store: Map<ticketId, { userId, deviceId, expiresAt }>
  // Tickets are single-use, short-lived (30s), and replace raw JWT in WS URL.
  // This prevents JWT leaking into proxy logs, browser history, or network tools.
  const wsTickets = new Map();

  fastify.decorate('wsConnections', connections);

  /**
   * Issue a one-time-use WS ticket.
   * Client calls POST /api/v1/sync/ws-ticket (authenticated),
   * receives { ticket }, then connects to /api/v1/sync/realtime?ticket=<ticket>.
   * The ticket is valid for 30 seconds and can only be used once.
   */
  fastify.decorate('issueWsTicket', (userId, deviceId) => {
    const ticket = crypto.randomBytes(32).toString('hex');
    wsTickets.set(ticket, {
      userId,
      deviceId,
      expiresAt: Date.now() + 30_000, // 30 seconds
    });
    return ticket;
  });

  /**
   * Broadcast metadata events to all devices of a user EXCEPT the sender.
   * Never sends encrypted content — only event metadata.
   */
  fastify.decorate('wsBroadcastToUser', (userId, senderDeviceId, events) => {
    const userDevices = connections.get(userId);
    if (!userDevices) return;

    const payload = JSON.stringify({ type: 'sync_events', events });

    for (const [deviceId, socket] of userDevices) {
      if (deviceId === senderDeviceId) continue;
      if (socket.readyState === 1) {
        try {
          socket.send(payload);
        } catch (err) {
          fastify.log.warn(`WS broadcast failed for device=${deviceId}: ${err.message}`);
        }
      }
    }
  });

  /**
   * Send to a specific user+device.
   */
  fastify.decorate('wsSendToDevice', (userId, deviceId, data) => {
    const userDevices = connections.get(userId);
    if (!userDevices) return;
    const socket = userDevices.get(deviceId);
    if (socket && socket.readyState === 1) {
      try {
        socket.send(JSON.stringify(data));
      } catch (err) {
        fastify.log.warn(`WS send failed for device=${deviceId}: ${err.message}`);
      }
    }
  });

  // WebSocket route — registered at top level so it inherits fastify.jwt
  fastify.get('/api/v1/sync/realtime', { websocket: true }, async (socket, request) => {
    let userId, deviceId;

    try {
      // Extract ticket from query string
      let ticket;
      try {
        const url = new URL(request.url, 'http://localhost');
        ticket = url.searchParams.get('ticket');
      } catch {
        socket.close(4400, 'Malformed request');
        return;
      }

      if (!ticket) {
        socket.close(4401, 'Missing ticket');
        return;
      }

      // Validate and consume the one-time ticket
      const ticketData = wsTickets.get(ticket);
      wsTickets.delete(ticket); // Consume immediately (single-use)

      if (!ticketData) {
        socket.close(4401, 'Invalid or already-used ticket');
        return;
      }

      if (Date.now() > ticketData.expiresAt) {
        socket.close(4401, 'Ticket expired');
        return;
      }

      userId = ticketData.userId;
      deviceId = ticketData.deviceId;

      // DB check: verify user is still active and device still exists
      const { rows } = await fastify.pg.query(
        `SELECT u.status, d.id AS device_id
         FROM users u
         LEFT JOIN devices d ON d.id = $2 AND d.user_id = u.id
         WHERE u.id = $1`,
        [userId, deviceId],
      );

      if (rows.length === 0 || rows[0].status !== 'active') {
        socket.close(4403, 'Account disabled');
        return;
      }

      if (!rows[0].device_id) {
        socket.close(4403, 'Device revoked');
        return;
      }
    } catch (err) {
      fastify.log.error(`WS auth error: ${err.message}`);
      socket.close(4401, 'Authentication failed');
      return;
    }

    // Track connection
    if (!connections.has(userId)) {
      connections.set(userId, new Map());
    }

    const userDevices = connections.get(userId);

    // Enforce 1 connection per device — close old one
    const existing = userDevices.get(deviceId);
    if (existing && existing.readyState === 1) {
      existing.close(4409, 'Replaced by new connection');
    }

    userDevices.set(deviceId, socket);
    fastify.log.info(`WS connected: user=${userId} device=${deviceId}`);

    // Send initial ack
    socket.send(JSON.stringify({
      type: 'connected',
      device_id: deviceId,
      timestamp: Date.now(),
    }));

    // Heartbeat: ping every 30s
    const pingInterval = setInterval(() => {
      if (socket.readyState === 1) {
        socket.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    // Handle incoming messages
    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    // Cleanup on close
    socket.on('close', () => {
      clearInterval(pingInterval);
      const devices = connections.get(userId);
      if (devices) {
        devices.delete(deviceId);
        if (devices.size === 0) {
          connections.delete(userId);
        }
      }
      fastify.log.info(`WS disconnected: user=${userId} device=${deviceId}`);
    });

    socket.on('error', (err) => {
      fastify.log.error(`WS error: user=${userId} device=${deviceId}: ${err.message}`);
    });
  });

  // Cleanup expired tickets every 60s (prevent memory leak from unused tickets)
  const ticketCleanup = setInterval(() => {
    const now = Date.now();
    for (const [ticket, data] of wsTickets) {
      if (now > data.expiresAt) {
        wsTickets.delete(ticket);
      }
    }
  }, 60_000);

  // Cleanup all connections on shutdown
  fastify.addHook('onClose', async () => {
    clearInterval(ticketCleanup);
    for (const [, devices] of connections) {
      for (const [, socket] of devices) {
        try { socket.close(1001, 'Server shutting down'); } catch {}
      }
    }
    connections.clear();
    wsTickets.clear();
  });
}

export const websocketPlugin = fp(ws, {
  name: 'websocket',
  dependencies: ['auth'],
});
