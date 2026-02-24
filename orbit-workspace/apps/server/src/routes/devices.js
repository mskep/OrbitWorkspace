import { authenticateStrict } from '../hooks/authenticate.js';
import * as deviceService from '../services/deviceService.js';

export async function deviceRoutes(fastify) {
  // All device routes require strict auth (DB check for immediate revocation)
  fastify.addHook('onRequest', authenticateStrict);

  // GET /api/v1/devices
  fastify.get('/', async (request) => {
    return deviceService.listDevices(fastify.pg, request.user.sub);
  });

  // DELETE /api/v1/devices/:id
  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    await deviceService.revokeDevice(
      fastify.pg,
      request.user.sub,
      request.params.id,
      request.user.did,
    );

    // Close WebSocket for the revoked device
    if (fastify.wsConnections) {
      const userDevices = fastify.wsConnections.get(request.user.sub);
      if (userDevices) {
        const socket = userDevices.get(request.params.id);
        if (socket && socket.readyState === 1) {
          socket.close(4403, 'Device revoked');
        }
      }
    }

    return reply.status(204).send();
  });
}
