/**
 * Database migration runner.
 * Reads all *.sql files from /migrations/ in alphabetical order,
 * applies only those not yet recorded in schema_migrations, and
 * tracks each applied migration so it never runs twice.
 *
 * Usage:
 *   npm run db:migrate
 *   npx tsx scripts/migrate.ts
 */

import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Ensure UTF-8 for Cyrillic content in SQL files
    await client.query("SET client_encoding = 'UTF8'");

    // Create tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Load already-applied versions
    const { rows } = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    const applied = new Set(rows.map(r => r.version));

    if (applied.size > 0) {
      console.log(`Already applied: ${[...applied].join(', ')}`);
    }

    // Collect migration files sorted alphabetically
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found in migrations/');
      return;
    }

    let applied_count = 0;
    let skipped_count = 0;

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');

      if (applied.has(version)) {
        console.log(`  skip  ${file}`);
        skipped_count++;
        continue;
      }

      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`  apply ${file} ... `);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        await client.query('COMMIT');
        console.log('done');
        applied_count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.log('FAILED');
        throw new Error(
          `Migration "${file}" failed:\n${(err as Error).message}`
        );
      }
    }

    console.log('');
    if (applied_count === 0) {
      console.log('Database is already up to date.');
    } else {
      console.log(`Applied ${applied_count} migration(s). Skipped ${skipped_count}.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('\nMigration runner error:', err.message);
  process.exit(1);
});
