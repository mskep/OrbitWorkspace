import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

const direction = process.argv[2]; // 'up' (default) or 'down'

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    if (direction === 'down') {
      // Rollback: drop all tables in reverse order
      console.log('Rolling back all migrations...');
      await client.query(`
        DROP TABLE IF EXISTS sync_cursors CASCADE;
        DROP TABLE IF EXISTS sync_ops CASCADE;
        DROP TABLE IF EXISTS sync_blobs CASCADE;
        DROP TABLE IF EXISTS user_sync_state CASCADE;
        DROP TABLE IF EXISTS sessions CASCADE;
        DROP TABLE IF EXISTS devices CASCADE;
        DROP TABLE IF EXISTS user_crypto CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TABLE IF EXISTS _migrations CASCADE;
      `);
      console.log('All tables dropped.');
      return;
    }

    // Read and apply pending migrations
    const migrationsDir = join(__dirname, 'migrations');
    const migrationFile = '001_initial-schema.sql';

    // Check if already applied
    const { rows } = await client.query(
      'SELECT name FROM _migrations WHERE name = $1',
      [migrationFile],
    );

    if (rows.length > 0) {
      console.log(`Migration ${migrationFile} already applied, skipping.`);
      return;
    }

    // Read and execute migration
    const sql = readFileSync(join(migrationsDir, migrationFile), 'utf-8');
    console.log(`Applying migration: ${migrationFile}...`);

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO _migrations (name) VALUES ($1)', [
      migrationFile,
    ]);
    await client.query('COMMIT');

    console.log(`Migration ${migrationFile} applied successfully.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
