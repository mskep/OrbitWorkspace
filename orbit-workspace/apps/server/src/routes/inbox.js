import { authenticateStrict } from '../hooks/authenticate.js';
import { authorize } from '../hooks/authorize.js';
import * as inboxService from '../services/inboxService.js';
import { rateLimitConfigs } from '../hooks/rateLimits.js';

export async function inboxRoutes(fastify) {
  // All inbox routes require authentication
  fastify.addHook('onRequest', authenticateStrict);

  // GET /api/v1/inbox — get all messages for current user
  fastify.get('/', {
    config: { rateLimit: rateLimitConfigs.standard },
    schema: {
      querystring: {
        type: 'object',
        properties: {
          since: { type: 'string', description: 'ISO timestamp cursor for incremental sync' },
        },
      },
    },
  }, async (request) => {
    if (request.query.since) {
      return inboxService.getMessagesSince(fastify.pg, request.user.sub, request.query.since);
    }
    return inboxService.getMessages(fastify.pg, request.user.sub);
  });

  // GET /api/v1/inbox/broadcast-history — admin/dev global history
  fastify.get('/broadcast-history', {
    config: { rateLimit: rateLimitConfigs.admin },
    onRequest: authorize({ minRole: 'DEV', dbCheck: true }),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
  }, async (request) => {
    return inboxService.getBroadcastHistory(fastify.pg, request.query.limit || 50);
  });

  // GET /api/v1/inbox/unread-count — get unread count
  fastify.get('/unread-count', {
    config: { rateLimit: rateLimitConfigs.standard },
  }, async (request) => {
    return inboxService.getUnreadCount(fastify.pg, request.user.sub);
  });

  // PUT /api/v1/inbox/:id/read — mark message as read
  fastify.put('/:id/read', {
    config: { rateLimit: rateLimitConfigs.standard },
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request) => {
    return inboxService.markAsRead(fastify.pg, request.user.sub, request.params.id);
  });

  // PUT /api/v1/inbox/read-all — mark all as read
  fastify.put('/read-all', {
    config: { rateLimit: rateLimitConfigs.standard },
  }, async (request) => {
    return inboxService.markAllAsRead(fastify.pg, request.user.sub);
  });

  // DELETE /api/v1/inbox/:id — delete a message
  fastify.delete('/:id', {
    config: { rateLimit: rateLimitConfigs.standard },
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request) => {
    return inboxService.deleteMessage(fastify.pg, request.user.sub, request.params.id);
  });

  // DELETE /api/v1/inbox/read — delete all read messages
  fastify.delete('/read', {
    config: { rateLimit: rateLimitConfigs.standard },
  }, async (request) => {
    return inboxService.deleteReadMessages(fastify.pg, request.user.sub);
  });

  // POST /api/v1/inbox/broadcast — send broadcast (ADMIN/DEV only)
  fastify.post('/broadcast', {
    config: { rateLimit: rateLimitConfigs.admin },
    onRequest: authorize({ minRole: 'DEV', dbCheck: true }),
    schema: {
      body: {
        type: 'object',
        required: ['title', 'message'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          message: { type: 'string', minLength: 1, maxLength: 2000 },
          target: { type: 'string', enum: ['all', 'user'], default: 'all' },
          userId: { type: 'string', format: 'uuid' },
          category: {
            type: 'string',
            enum: ['admin-broadcast', 'admin-maintenance', 'admin-update', 'admin-security'],
            default: 'admin-broadcast',
          },
        },
        additionalProperties: false,
      },
    },
  }, async (request) => {
    return inboxService.sendBroadcast(
      fastify.pg,
      fastify,
      request.user.sub,
      request.body,
    );
  });
}
