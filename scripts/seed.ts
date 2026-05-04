/**
 * Database seed runner.
 * Runs all *.sql files from /seeds/ in alphabetical order.
 * Each seed file is idempotent (guards with ON CONFLICT / COUNT checks).
 *
 * Usage:
 *   npm run db:seed
 *   npx tsx scripts/seed.ts
 *
 * Options:
 *   --file 01_demo_restaurant   Run a single seed file by name prefix
 */

import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const SEEDS_DIR = join(__dirname, '..', 'seeds');

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  // Optional single-file filter: --file <prefix>
  const fileArg = process.argv.indexOf('--file');
  const filter = fileArg !== -1 ? process.argv[fileArg + 1] : null;

  try {
    await client.query("SET client_encoding = 'UTF8'");

    let files = readdirSync(SEEDS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (filter) {
      files = files.filter(f => f.startsWith(filter));
      if (files.length === 0) {
        console.error(`No seed files match prefix "${filter}"`);
        process.exit(1);
      }
    }

    if (files.length === 0) {
      console.log('No seed files found in seeds/');
      return;
    }

    for (const file of files) {
      const sql = readFileSync(join(SEEDS_DIR, file), 'utf8');
      process.stdout.write(`  seed  ${file} ... `);
      try {
        await client.query(sql);
        console.log('done');
      } catch (err) {
        console.log('FAILED');
        throw new Error(
          `Seed "${file}" failed:\n${(err as Error).message}`
        );
      }
    }

    console.log('\nSeeding complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('\nSeed runner error:', err.message);
  process.exit(1);
});
