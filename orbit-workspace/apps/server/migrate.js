import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
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
      // Rollback: get applied migrations in reverse order
      const { rows: applied } = await client.query(
        'SELECT name FROM _migrations ORDER BY id DESC',
      );

      if (applied.length === 0) {
        console.log('No migrations to roll back.');
        return;
      }

      // Look for corresponding .down.sql files, fall back to DROP ALL
      const migrationsDir = join(__dirname, 'migrations');
      let rolledBack = false;

      for (const { name } of applied) {
        const downFile = name.replace('.sql', '.down.sql');
        try {
          const downSql = readFileSync(join(migrationsDir, downFile), 'utf-8');
          console.log(`Rolling back: ${name}...`);
          await client.query('BEGIN');
          await client.query(downSql);
          await client.query('DELETE FROM _migrations WHERE name = $1', [name]);
          await client.query('COMMIT');
          console.log(`Rolled back: ${name}`);
          rolledBack = true;
        } catch {
          // No .down.sql file — skip individual rollback
        }
      }

      if (!rolledBack) {
        // Fallback: drop all known tables
        console.log('No .down.sql files found. Dropping all tables...');
        await client.query(`
          DROP TABLE IF EXISTS inbox_messages CASCADE;
          DROP TABLE IF EXISTS user_badges CASCADE;
          DROP TABLE IF EXISTS badges CASCADE;
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
      }
      return;
    }

    // ── UP: scan migrations dir, apply pending in order ──
    const migrationsDir = join(__dirname, 'migrations');
    const allFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
      .sort(); // lexicographic: 001_*, 002_*, ...

    // Get already-applied migrations
    const { rows: applied } = await client.query('SELECT name FROM _migrations');
    const appliedSet = new Set(applied.map((r) => r.name));

    let appliedCount = 0;

    for (const file of allFiles) {
      if (appliedSet.has(file)) {
        console.log(`  ✓ ${file} (already applied)`);
        continue;
      }

      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      console.log(`  → Applying: ${file}...`);

      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');

      console.log(`  ✓ ${file} applied.`);
      appliedCount++;
    }

    if (appliedCount === 0) {
      console.log('All migrations already applied.');
    } else {
      console.log(`\n${appliedCount} migration(s) applied successfully.`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
