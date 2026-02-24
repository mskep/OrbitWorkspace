import 'dotenv/config';

const required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const optional = (key, fallback) => process.env[key] || fallback;

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),
  host: optional('HOST', '0.0.0.0'),

  database: {
    url: required('DATABASE_URL'),
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiry: optional('JWT_ACCESS_EXPIRY', '15m'),
    refreshExpiry: optional('JWT_REFRESH_EXPIRY', '30d'),
  },

  cors: {
    origins: optional('CORS_ORIGINS', 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim()),
  },

  // Set TRUST_PROXY=true only when behind a reverse proxy (Nginx, Caddy, etc.)
  // Default false = safe for direct VPS exposure (prevents X-Forwarded-For spoofing)
  trustProxy: optional('TRUST_PROXY', 'false') === 'true',

  rateLimit: {
    enabled: optional('RATE_LIMIT_ENABLED', 'true') === 'true',
  },

  log: {
    level: optional('LOG_LEVEL', 'info'),
  },

  isDev() {
    return this.env === 'development';
  },

  isProd() {
    return this.env === 'production';
  },
};
