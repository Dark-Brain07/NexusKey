import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((r) => r.filename));
}

/**
 * Forward-only migration runner: applies every .sql file in migrations/ in
 * lexical order that hasn't already been recorded in schema_migrations,
 * each inside its own transaction. Idempotent — safe to run on every
 * deploy, which matters for a Fly.io release process that should never
 * require a manual migration step.
 */
async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) {
      // eslint-disable-next-line no-console
      console.log(`skip (already applied): ${file}`);
      continue;
    }
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      // eslint-disable-next-line no-console
      console.log(`applied: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      // eslint-disable-next-line no-console
      console.error(`failed: ${file}`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  // eslint-disable-next-line no-console
  console.log('Migrations complete.');
  await pool.end();
}

runMigrations().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
