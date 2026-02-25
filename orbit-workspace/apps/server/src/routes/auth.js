import * as authService from '../services/authService.js';
import { authenticate, authenticateStrict } from '../hooks/authenticate.js';
import { rateLimitConfigs } from '../hooks/rateLimits.js';

export async function authRoutes(fastify) {
  // POST /api/v1/auth/register
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'username', 'password', 'salt', 'encrypted_master_key', 'recovery_blob', 'kdf_params', 'device_name', 'device_fingerprint'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 255 },
          username: { type: 'string', minLength: 3, maxLength: 32, pattern: '^[a-zA-Z0-9_-]+$' },
          password: { type: 'string', minLength: 8, maxLength: 128 },
          salt: { type: 'string', minLength: 1 },
          encrypted_master_key: { type: 'string', minLength: 1 },
          recovery_blob: { type: 'string', minLength: 1 },
          kdf_params: {
            type: 'object',
            required: ['algorithm', 'memoryCost', 'timeCost', 'parallelism', 'hashLength'],
            properties: {
              algorithm: { type: 'string' },
              memoryCost: { type: 'integer' },
              timeCost: { type: 'integer' },
              parallelism: { type: 'integer' },
              hashLength: { type: 'integer' },
            },
          },
          device_name: { type: 'string', minLength: 1, maxLength: 100 },
          device_fingerprint: { type: 'string', minLength: 1, maxLength: 255 },
        },
        additionalProperties: false,
      },
    },
    config: {
      rateLimit: rateLimitConfigs.register,
    },
  }, async (request, reply) => {
    const result = await authService.register(
      fastify.pg, fastify.jwt, request.body,
    );
    return reply.status(201).send(result);
  });

  // POST /api/v1/auth/login
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['identifier', 'password', 'device_name', 'device_fingerprint'],
        properties: {
          identifier: { type: 'string', minLength: 1, maxLength: 255 },
          password: { type: 'string', minLength: 1, maxLength: 128 },
          device_name: { type: 'string', minLength: 1, maxLength: 100 },
          device_fingerprint: { type: 'string', minLength: 1, maxLength: 255 },
        },
        additionalProperties: false,
      },
    },
    config: {
      rateLimit: rateLimitConfigs.login,
    },
  }, async (request) => {
    return authService.login(fastify.pg, fastify.jwt, request.body);
  });

  // POST /api/v1/auth/refresh
  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request) => {
    return authService.refresh(fastify.pg, fastify.jwt, request.body.refresh_token);
  });

  // POST /api/v1/auth/logout (authenticated)
  fastify.post('/logout', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    await authService.logout(fastify.pg, request.user.sub, request.user.did);
    return reply.status(204).send();
  });

  // POST /api/v1/auth/recover
  // Generic response to prevent user enumeration.
  // The recovery_blob is useless without the .orbit-recovery file.
  fastify.post('/recover', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
        additionalProperties: false,
      },
    },
    config: {
      rateLimit: rateLimitConfigs.recover,
    },
  }, async (request) => {
    const result = await authService.recover(fastify.pg, request.body.email);
    // Always return 200 — never reveal if email exists
    return result || { recovery_blob: null, salt: null, kdf_params: null };
  });

  // POST /api/v1/auth/recover-reset (authenticated — after client-side recovery)
  // The user has proven recovery key possession locally; this syncs the new crypto to the server.
  fastify.post('/recover-reset', {
    onRequest: [authenticateStrict],
    schema: {
      body: {
        type: 'object',
        required: ['new_password', 'new_salt', 'new_encrypted_master_key', 'new_kdf_params'],
        properties: {
          new_password: { type: 'string', minLength: 8, maxLength: 128 },
          new_salt: { type: 'string', minLength: 1 },
          new_encrypted_master_key: { type: 'string', minLength: 1 },
          new_kdf_params: {
            type: 'object',
            required: ['algorithm', 'memoryCost', 'timeCost', 'parallelism', 'hashLength'],
            properties: {
              algorithm: { type: 'string' },
              memoryCost: { type: 'integer' },
              timeCost: { type: 'integer' },
              parallelism: { type: 'integer' },
              hashLength: { type: 'integer' },
            },
          },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    await authService.recoverReset(fastify.pg, request.user.sub, request.body);
    return reply.status(200).send({ message: 'Password reset via recovery, all sessions revoked' });
  });

  // PUT /api/v1/auth/password (strict auth — DB check for immediate revocation)
  fastify.put('/password', {
    onRequest: [authenticateStrict],
    schema: {
      body: {
        type: 'object',
        required: ['old_password', 'new_password', 'new_salt', 'new_encrypted_master_key', 'new_kdf_params'],
        properties: {
          old_password: { type: 'string', minLength: 1, maxLength: 128 },
          new_password: { type: 'string', minLength: 8, maxLength: 128 },
          new_salt: { type: 'string', minLength: 1 },
          new_encrypted_master_key: { type: 'string', minLength: 1 },
          new_kdf_params: {
            type: 'object',
            required: ['algorithm', 'memoryCost', 'timeCost', 'parallelism', 'hashLength'],
            properties: {
              algorithm: { type: 'string' },
              memoryCost: { type: 'integer' },
              timeCost: { type: 'integer' },
              parallelism: { type: 'integer' },
              hashLength: { type: 'integer' },
            },
          },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    await authService.changePassword(fastify.pg, request.user.sub, request.body);
    return reply.status(200).send({ message: 'Password changed, all sessions revoked' });
  });
}
