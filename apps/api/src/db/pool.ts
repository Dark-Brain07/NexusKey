import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

/**
 * Single shared connection pool for the process. The API and the indexer
 * worker (run in the same long-lived Fly.io process for V1 — see
 * src/index.ts) share this pool rather than opening separate connections,
 * which matters for an always-on service where connection churn is a
 * common source of intermittent failures.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  // A background client emitted an error (e.g. connection reset) — log and
  // let the pool recover instead of crashing the always-on process.
  // eslint-disable-next-line no-console
  console.error('Unexpected error on idle Postgres client', err);
});

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
