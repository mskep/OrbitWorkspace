import { authenticateStrict } from '../hooks/authenticate.js';
import { authorize } from '../hooks/authorize.js';
import * as badgeService from '../services/badgeService.js';
import { rateLimitConfigs } from '../hooks/rateLimits.js';

export async function badgeRoutes(fastify) {
  // All badge routes require authentication
  fastify.addHook('onRequest', authenticateStrict);

  // GET /api/v1/badges — list all available badges (any authenticated user)
  fastify.get('/', {
    config: { rateLimit: rateLimitConfigs.standard },
  }, async () => {
    return badgeService.listBadges(fastify.pg);
  });

  // GET /api/v1/badges/user/:userId — get badges for a user (owner or ADMIN)
  fastify.get('/user/:userId', {
    config: { rateLimit: rateLimitConfigs.standard },
    schema: {
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    // Only owner or admin can query a specific user's badges
    if (request.user.sub !== request.params.userId && request.user.role !== 'ADMIN' && request.user.role !== 'DEV') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot view another user\'s badges' });
    }
    return badgeService.getUserBadges(fastify.pg, request.params.userId);
  });

  // GET /api/v1/badges/mine — get current user's badges
  fastify.get('/mine', {
    config: { rateLimit: rateLimitConfigs.standard },
  }, async (request) => {
    return badgeService.getUserBadges(fastify.pg, request.user.sub);
  });

  // POST /api/v1/badges/assign — assign badge (ADMIN only)
  fastify.post('/assign', {
    config: { rateLimit: rateLimitConfigs.admin },
    onRequest: authorize({ minRole: 'ADMIN', dbCheck: true }),
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'badgeId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          badgeId: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request) => {
    return badgeService.assignBadge(
      fastify.pg,
      fastify,
      request.user.sub,
      request.body.userId,
      request.body.badgeId,
    );
  });

  // POST /api/v1/badges/revoke — revoke badge (ADMIN only)
  fastify.post('/revoke', {
    config: { rateLimit: rateLimitConfigs.admin },
    onRequest: authorize({ minRole: 'ADMIN', dbCheck: true }),
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'badgeId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          badgeId: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request) => {
    return badgeService.revokeBadge(
      fastify.pg,
      fastify,
      request.user.sub,
      request.body.userId,
      request.body.badgeId,
    );
  });
}
