import fp from 'fastify-plugin';
import { pool } from '../db/pool.js';

async function database(fastify) {
  // Decorate Fastify with the pg pool
  fastify.decorate('pg', pool);

  // Test connection on startup
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT NOW() AS now');
    fastify.log.info(`PostgreSQL connected: ${rows[0].now}`);
  } finally {
    client.release();
  }

  // Cleanup on shutdown
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing PostgreSQL pool...');
    await pool.end();
  });
}

export const databasePlugin = fp(database, {
  name: 'database',
});
