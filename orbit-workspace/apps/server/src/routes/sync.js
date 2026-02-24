import { authenticateStrict } from '../hooks/authenticate.js';
import * as syncService from '../services/syncService.js';
import { rateLimitConfigs } from '../hooks/rateLimits.js';

export async function syncRoutes(fastify) {
  // All sync routes require strict auth (DB check for immediate revocation)
  fastify.addHook('onRequest', authenticateStrict);

  // Update device last_seen on every sync request
  fastify.addHook('onRequest', async (request) => {
    if (request.user?.did) {
      await fastify.pg.query(
        'UPDATE devices SET last_seen_at = NOW() WHERE id = $1',
        [request.user.did],
      ).catch(() => {}); // Non-blocking
    }
  });

  // POST /api/v1/sync/ws-ticket — get a one-time ticket for WebSocket connection
  // Client flow: 1) POST /ws-ticket → { ticket }  2) WS /realtime?ticket=<ticket>
  // This avoids leaking JWT in URL (proxy logs, browser history, network tools).
  fastify.post('/ws-ticket', {
    config: {
      rateLimit: { ...rateLimitConfigs.syncPull, max: 10 },
    },
  }, async (request) => {
    const ticket = fastify.issueWsTicket(request.user.sub, request.user.did);
    return { ticket };
  });

  // GET /api/v1/sync/pull?since=<clock>&type=<entity_type>
  fastify.get('/pull', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          since: { type: 'string', default: '0' },
          type: { type: 'string' },
        },
      },
    },
    config: {
      rateLimit: rateLimitConfigs.syncPull,
    },
  }, async (request) => {
    return syncService.pull(
      fastify.pg,
      request.user.sub,
      request.user.did,
      { since: request.query.since, type: request.query.type },
    );
  });

  // POST /api/v1/sync/push
  fastify.post('/push', {
    schema: {
      body: {
        type: 'object',
        required: ['blobs'],
        properties: {
          blobs: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
              type: 'object',
              required: ['op_id', 'entity_type', 'entity_id', 'version', 'iv', 'ciphertext', 'tag'],
              properties: {
                op_id: { type: 'string', minLength: 1 },
                entity_type: { type: 'string', minLength: 1 },
                entity_id: { type: 'string', minLength: 1 },
                version: { type: 'integer', minimum: 1 },
                iv: { type: 'string', minLength: 1 },
                ciphertext: { type: 'string', minLength: 1 },
                tag: { type: 'string', minLength: 1 },
                deleted: { type: 'boolean', default: false },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
    config: {
      rateLimit: rateLimitConfigs.syncPush,
    },
  }, async (request) => {
    const result = await syncService.push(
      fastify.pg,
      request.user.sub,
      request.user.did,
      request.body.blobs,
    );

    // Notify other devices via WebSocket (metadata only)
    if (result.accepted.length > 0 && fastify.wsConnections) {
      const events = result.accepted
        .filter((a) => a.status !== 'already_applied')
        .map((a) => ({
          event: 'sync',
          entity_type: a.entity_type,
          entity_id: a.entity_id,
          server_clock: a.server_clock,
        }));

      if (events.length > 0) {
        fastify.wsBroadcastToUser(request.user.sub, request.user.did, events);
      }
    }

    return result;
  });
}
