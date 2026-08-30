/**
 * Single-indexer-instance guard via a Postgres session-level advisory
 * lock. NexusKey-api intentionally runs multiple Fly machines for API
 * uptime, but only one of them should poll GenLayer's shared public
 * StudioNet RPC (5,000 req/day quota, shared across everyone using it) --
 * every machine independently polling was directly responsible for
 * exhausting that quota.
 *
 * A session-level advisory lock (pg_try_advisory_lock, not
 * pg_advisory_xact_lock) is held for the lifetime of one Postgres
 * connection, not one transaction -- so it stays held across the whole
 * process's life, and is automatically released by Postgres itself the
 * instant that connection closes for any reason (graceful shutdown,
 * crash, machine restart, network partition). That's what gives this
 * failover for free: if the leader machine dies, its connection drops,
 * Postgres releases the lock, and the next machine's retry loop picks it
 * up within one lock-check interval -- no coordination service needed.
 *
 * This deliberately opens its own dedicated client via `pool.connect()`
 * and never returns it to the pool (no `.release()` while held) --
 * returning it would let the pool hand the same physical connection to
 * an unrelated query, which would silently drop the advisory lock out
 * from under the indexer.
 */
import type pg from 'pg';
import { pool } from '../db/pool.js';

// Arbitrary fixed 64-bit-safe key -- any two processes calling
// pg_try_advisory_lock with the same key contend for the same lock.
// Value has no meaning beyond "identifies the NexusKey indexer role."
const INDEXER_LOCK_KEY = 84_721_063;

let lockedClient: pg.PoolClient | null = null;

/** True if THIS process currently holds the indexer lock. */
export function isIndexerLeader(): boolean {
  return lockedClient !== null;
}

/**
 * Attempts to acquire the lock once (non-blocking). Returns true if this
 * process is now (or already was) the leader. Safe to call repeatedly --
 * a process that already holds the lock returns true immediately without
 * opening a second connection.
 */
export async function tryAcquireIndexerLock(): Promise<boolean> {
  if (lockedClient) return true;
  const client = await pool.connect();
  try {
    const result = await client.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock($1) AS acquired', [
      INDEXER_LOCK_KEY,
    ]);
    if (result.rows[0]?.acquired) {
      lockedClient = client;
      // Detect the connection dying out from under us (network blip,
      // Postgres restart) so isIndexerLeader() reflects reality instead
      // of reporting a stale "still leader" -- the retry loop in
      // worker.ts will then re-attempt acquisition on its next tick.
      client.once('error', () => {
        if (lockedClient === client) lockedClient = null;
      });
      return true;
    }
    client.release();
    return false;
  } catch (err) {
    client.release();
    throw err;
  }
}

/** Releases the lock and closes the dedicated connection, if held. Call on graceful shutdown. */
export async function releaseIndexerLock(): Promise<void> {
  if (!lockedClient) return;
  const client = lockedClient;
  lockedClient = null;
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [INDEXER_LOCK_KEY]);
  } finally {
    client.release();
  }
}
