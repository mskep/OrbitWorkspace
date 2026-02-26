import { authenticateStrict } from '../hooks/authenticate.js';
import * as auditService from '../services/auditService.js';
import { rateLimitConfigs } from '../hooks/rateLimits.js';

export async function auditLogRoutes(fastify) {
  // All audit-log routes require authentication
  fastify.addHook('onRequest', authenticateStrict);

  // POST /api/v1/audit-logs — push a batch of client audit logs
  fastify.post('/', {
    config: { rateLimit: rateLimitConfigs.syncPush },
    schema: {
      body: {
        type: 'object',
        required: ['logs'],
        properties: {
          logs: {
            type: 'array',
            minItems: 1,
            maxItems: 200,
            items: {
              type: 'object',
              required: ['action'],
              properties: {
                action: { type: 'string', maxLength: 120 },
                category: { type: 'string', maxLength: 60 },
                severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'] },
                status: { type: 'string', enum: ['success', 'error', 'denied'] },
                target_type: { type: 'string', maxLength: 60 },
                target_id: { type: 'string', maxLength: 120 },
                details: { type: 'object' },
              },
              additionalProperties: false,
            },
          },
          device_id: { type: 'string', format: 'uuid' },
        },
        additionalProperties: false,
      },
    },
  }, async (request) => {
    // Resolve username from DB (JWT only has sub/role/did)
    const { rows } = await fastify.pg.query(
      'SELECT username FROM users WHERE id = $1', [request.user.sub],
    );
    const username = rows[0]?.username || null;

    return auditService.pushLogs(
      fastify.pg,
      request.user.sub,
      username,
      request.body.device_id || request.user.did || null,
      request.ip,
      request.body.logs,
    );
  });
}
