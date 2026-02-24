import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { config } from '../config.js';

async function auth(fastify) {
  // Register JWT for access tokens
  await fastify.register(fjwt, {
    secret: config.jwt.accessSecret,
    sign: {
      expiresIn: config.jwt.accessExpiry,
    },
    decoratorName: 'jwt',
  });
}

export const authPlugin = fp(auth, {
  name: 'auth',
});
