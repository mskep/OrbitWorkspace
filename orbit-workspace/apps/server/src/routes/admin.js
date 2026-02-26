import { authenticateStrict } from '../hooks/authenticate.js';
import { authorize } from '../hooks/authorize.js';
import * as adminService from '../services/adminService.js';
import * as statsService from '../services/statsService.js';
import * as auditService from '../services/auditService.js';
import { rateLimitConfigs } from '../hooks/rateLimits.js';

export async function adminRoutes(fastify) {
  // All admin routes: strict JWT auth + ADMIN role verified against DB
  fastify.addHook('onRequest', authenticateStrict);
  fastify.addHook('onRequest', authorize({ minRole: 'ADMIN', dbCheck: true }));

  // GET /api/v1/admin/stats — server-aggregated overview statistics
  fastify.get('/stats', {
    config: { rateLimit: rateLimitConfigs.admin },
  }, async () => {
    const stats = await statsService.getStats(fastify.pg);
    // Attach live WS connection count
    stats.wsConnectedUsers = fastify.wsConnections ? fastify.wsConnections.size : 0;
    return { stats };
  });

  // GET /api/v1/admin/audit-logs — query all users' audit logs
  fastify.get('/audit-logs', {
    config: { rateLimit: rateLimitConfigs.admin },
    schema: {
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          action: { type: 'string', maxLength: 120 },
          category: { type: 'string', maxLength: 60 },
          severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'] },
          status: { type: 'string', enum: ['success', 'error', 'denied'] },
          search: { type: 'string', maxLength: 200 },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 500, default: 200 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    return auditService.getLogs(fastify.pg, request.query);
  });

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
