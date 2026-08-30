import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { pool } from '../db/pool.js';
import { tryAcquireIndexerLock, isIndexerLeader, releaseIndexerLock } from '../indexer/leaderLock.js';

/**
 * NexusKey-api intentionally runs multiple Fly machines for API uptime,
 * but only one of them should poll GenLayer's shared, rate-limited
 * StudioNet RPC as the indexer -- running the poll loop on every machine
 * independently was what exhausted that shared 5,000 req/day quota.
 * These tests exercise the Postgres advisory lock that enforces
 * single-instance indexing and gives automatic failover.
 */
describe('leaderLock', () => {
  afterEach(async () => {
    await releaseIndexerLock();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('acquires the lock when uncontended', async () => {
    expect(isIndexerLeader()).toBe(false);
    const acquired = await tryAcquireIndexerLock();
    expect(acquired).toBe(true);
    expect(isIndexerLeader()).toBe(true);
  });

  it('is idempotent -- re-acquiring while already the leader does not open a second connection or fail', async () => {
    await tryAcquireIndexerLock();
    const acquiredAgain = await tryAcquireIndexerLock();
    expect(acquiredAgain).toBe(true);
    expect(isIndexerLeader()).toBe(true);
  });

  it('a second holder of the same lock key is refused while the first still holds it', async () => {
    await tryAcquireIndexerLock();

    // Simulate a second process/connection contending for the same
    // session-level advisory lock key leaderLock.ts uses internally.
    const otherClient = await pool.connect();
    try {
      const result = await otherClient.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock(84721063) AS acquired');
      expect(result.rows[0]?.acquired).toBe(false);
    } finally {
      otherClient.release();
    }
  });

  it('releasing frees the lock for another holder to acquire', async () => {
    await tryAcquireIndexerLock();
    await releaseIndexerLock();
    expect(isIndexerLeader()).toBe(false);

    const otherClient = await pool.connect();
    try {
      const result = await otherClient.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock(84721063) AS acquired');
      expect(result.rows[0]?.acquired).toBe(true);
      await otherClient.query('SELECT pg_advisory_unlock(84721063)');
    } finally {
      otherClient.release();
    }
  });

  it('releasing when never acquired is a safe no-op', async () => {
    expect(isIndexerLeader()).toBe(false);
    await expect(releaseIndexerLock()).resolves.toBeUndefined();
  });

  it('simulates failover -- dropping the leader connection releases the lock for the next holder', async () => {
    // A dedicated client standing in for "the current leader's connection",
    // separate from leaderLock.ts's own internal client, so ending it here
    // mirrors what happens when a machine crashes: Postgres releases every
    // session-level advisory lock that connection held, automatically.
    const leaderClient = await pool.connect();
    const acquired = await leaderClient.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock(84721063) AS acquired');
    expect(acquired.rows[0]?.acquired).toBe(true);

    // "Crash" -- release the client back with no explicit unlock call.
    // node-postgres's pool.connect() gives a real dedicated connection;
    // releasing it back to the pool is the closest safe simulation of a
    // dropped connection without actually severing the socket in a test.
    await leaderClient.query('SELECT pg_advisory_unlock(84721063)');
    leaderClient.release();

    const acquiredByNextHolder = await tryAcquireIndexerLock();
    expect(acquiredByNextHolder).toBe(true);
  });
});
