import { authenticateStrict } from '../hooks/authenticate.js';
import { authorize } from '../hooks/authorize.js';
import * as adminService from '../services/adminService.js';
import { rateLimitConfigs } from '../hooks/rateLimits.js';

export async function adminRoutes(fastify) {
  // All admin routes: strict JWT auth + ADMIN role verified against DB
  fastify.addHook('onRequest', authenticateStrict);
  fastify.addHook('onRequest', authorize({ minRole: 'ADMIN', dbCheck: true }));

  // GET /api/v1/admin/users
  fastify.get('/users', {
    config: { rateLimit: rateLimitConfigs.admin },
  }, async () => {
    return adminService.listUsers(fastify.pg);
  });

  // PUT /api/v1/admin/users/:id/role
  fastify.put('/users/:id/role', {
    config: { rateLimit: rateLimitConfigs.admin },
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['ADMIN', 'DEV', 'PREMIUM', 'USER'] },
        },
        additionalProperties: false,
      },
    },
  }, async (request) => {
    return adminService.updateUserRole(
      fastify.pg,
      request.user.sub,
      request.params.id,
      request.body.role,
    );
  });

  // PUT /api/v1/admin/users/:id/status
  fastify.put('/users/:id/status', {
    config: { rateLimit: rateLimitConfigs.admin },
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['active', 'disabled'] },
        },
        additionalProperties: false,
      },
    },
  }, async (request) => {
    return adminService.updateUserStatus(
      fastify.pg,
      request.user.sub,
      request.params.id,
      request.body.status,
    );
  });

  // POST /api/v1/admin/broadcast
  fastify.post('/broadcast', {
    config: { rateLimit: rateLimitConfigs.admin },
    schema: {
      body: {
        type: 'object',
        required: ['message', 'type'],
        properties: {
          message: { type: 'string', minLength: 1, maxLength: 1000 },
          type: { type: 'string', enum: ['announcement', 'maintenance', 'update', 'security'] },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    await adminService.broadcast(
      fastify,
      request.user.sub,
      request.body.message,
      request.body.type,
    );
    return reply.status(204).send();
  });
}
