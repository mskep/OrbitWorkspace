import Fastify from 'fastify';
import { config } from './config.js';
import { databasePlugin } from './plugins/database.js';
import { authPlugin } from './plugins/auth.js';
import { websocketPlugin } from './plugins/websocket.js';
import { authRoutes } from './routes/auth.js';
import { syncRoutes } from './routes/sync.js';
import { deviceRoutes } from './routes/devices.js';
import { adminRoutes } from './routes/admin.js';
import { badgeRoutes } from './routes/badges.js';
import { inboxRoutes } from './routes/inbox.js';
import { auditLogRoutes } from './routes/auditLogs.js';

const buildApp = async () => {
  const app = Fastify({
    logger: {
      level: config.log.level,
      ...(config.isDev() && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      }),
    },
    // Only trust proxy headers when behind a reverse proxy (Nginx, Caddy, etc.)
    // When exposed directly, X-Forwarded-For can be spoofed to bypass rate limits
    trustProxy: config.trustProxy,
  });

  // --- Global error handler ---
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;

    // Never leak internal details in production
    if (statusCode >= 500) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: config.isProd() ? 'An unexpected error occurred' : error.message,
      });
    }

    return reply.status(statusCode).send({
      error: error.name || 'Error',
      message: error.message,
      ...(error.code && { code: error.code }),
    });
  });

  // --- Plugins ---
  await app.register(databasePlugin);
  await app.register(authPlugin);
  await app.register(websocketPlugin);

  // --- Security ---
  const helmet = await import('@fastify/helmet');
  await app.register(helmet.default, {
    contentSecurityPolicy: false, // API server, no HTML
  });

  const cors = await import('@fastify/cors');
  await app.register(cors.default, {
    origin: config.cors.origins,
    credentials: true,
  });

  // --- Rate limiting ---
  if (config.rateLimit.enabled) {
    const rateLimit = await import('@fastify/rate-limit');
    await app.register(rateLimit.default, {
      global: true,
      max: 200,
      timeWindow: '1 minute',
    });
  }

  // --- Health check ---
  app.get('/health', async () => {
    // Quick DB check
    const client = await app.pg.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // --- API Routes ---
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(syncRoutes, { prefix: '/sync' });
      await api.register(deviceRoutes, { prefix: '/devices' });
      await api.register(adminRoutes, { prefix: '/admin' });
      await api.register(badgeRoutes, { prefix: '/badges' });
      await api.register(inboxRoutes, { prefix: '/inbox' });
      await api.register(auditLogRoutes, { prefix: '/audit-logs' });
    },
    { prefix: '/api/v1' },
  );

  // --- Graceful shutdown ---
  const shutdown = async (signal) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return app;
};

// --- Start ---
try {
  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Orbit server listening on ${config.host}:${config.port}`);
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}
