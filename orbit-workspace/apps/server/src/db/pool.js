import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.database.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000, // 30s max per query — prevents runaway queries
  query_timeout: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});
