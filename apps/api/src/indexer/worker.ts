/**
 * Blockchain event synchronization worker.
 *
 * Incremental sync: each poll only re-fetches claim/challenge IDs that
 * are new since the last poll, or whose cached status can still change
 * on-chain (see getClaimIdsNeedingSync/getChallengeIdsNeedingSync in
 * db/queries.ts) -- not a full 1..total rescan every cycle. The earlier
 * full-rescan approach, combined with running on every Fly machine
 * independently, exhausted GenLayer's shared public StudioNet RPC quota
 * (5,000 req/day) almost immediately once there were more than a
 * handful of claims.
 *
 * Only one machine actually polls at a time (see leaderLock.ts) --
 * NexusKey-api intentionally runs multiple machines for API uptime, but
 * indexing is a single-writer role. A machine that isn't the leader
 * keeps retrying to acquire the lock so it can take over if the leader
 * dies, without ever polling chain state itself in the meantime.
 *
 * Inert until NexusKey_CONTRACT_ADDRESS and GENLAYER_RPC_URL are both
 * configured -- see requireContractAddress() in config/env.ts. Running
 * with no configured contract is a documented, expected state, not an
 * error condition that should crash the always-on process.
 */
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { env } from '../config/env.js';
import { claimRecordSchema, challengeRecordSchema } from '@nexuskey/shared';
import { upsertClaim, upsertChallenge, getClaimIdsNeedingSync, getChallengeIdsNeedingSync } from '../db/queries.js';
import { tryAcquireIndexerLock, isIndexerLeader, releaseIndexerLock } from './leaderLock.js';

const POLL_INTERVAL_MS = 15_000;
// If the leader doesn't hold the lock yet, how often it retries acquiring
// it -- deliberately the same cadence as a normal poll so failover is
// fast, but this path never calls the GenLayer RPC at all.
const LOCK_RETRY_INTERVAL_MS = 15_000;
// After a rate-limit error, stop polling chain state entirely for this
// long before trying again, instead of hammering an already-exhausted
// shared quota every 15s (which only delays it recovering for everyone).
const RATE_LIMIT_BACKOFF_MS = 15 * 60_000;

let pollHandle: ReturnType<typeof setInterval> | undefined;
let inFlight = false;
let rateLimitedUntil = 0;

function getIndexerClient() {
  const chain = env.GENLAYER_RPC_URL
    ? { ...studionet, rpcUrls: { default: { http: [env.GENLAYER_RPC_URL] } } }
    : studionet;
  return createClient({ chain });
}

async function readContract<T>(functionName: string, args: unknown[] = []): Promise<T> {
  const client = getIndexerClient();
  const result = await client.readContract({
    address: env.NexusKey_CONTRACT_ADDRESS as `0x${string}`,
    functionName,
    args: args as never,
    jsonSafeReturn: true,
  });
  return result as T;
}

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /rate limit/i.test(message);
}

async function syncClaims(totalClaims: number): Promise<void> {
  const claimIds = await getClaimIdsNeedingSync(totalClaims);
  for (const claimId of claimIds) {
    try {
      const raw = await readContract('get_claim', [claimId]);
      const claim = claimRecordSchema.parse(raw);
      await upsertClaim(claim);
    } catch (err) {
      // A single bad/missing claim must not abort the whole sync cycle --
      // log and continue so one malformed row doesn't starve every other
      // claim of indexing.
      // eslint-disable-next-line no-console
      console.error(`indexer: failed to sync claim ${claimId}:`, err);
      if (isRateLimitError(err)) throw err;
    }
  }
}

async function syncChallenges(totalChallenges: number): Promise<void> {
  const challengeIds = await getChallengeIdsNeedingSync(totalChallenges);
  for (const challengeId of challengeIds) {
    try {
      const raw = await readContract('get_challenge', [challengeId]);
      const challenge = challengeRecordSchema.parse(raw);
      await upsertChallenge(challenge);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`indexer: failed to sync challenge ${challengeId}:`, err);
      if (isRateLimitError(err)) throw err;
    }
  }
}

async function pollOnce(): Promise<void> {
  if (!env.NexusKey_CONTRACT_ADDRESS || !env.GENLAYER_RPC_URL) {
    return;
  }
  if (Date.now() < rateLimitedUntil) {
    return;
  }
  if (inFlight) {
    // Previous cycle is still running (slow RPC) -- skip this tick rather
    // than overlapping two scans against the same rows.
    return;
  }
  inFlight = true;
  try {
    const config = await readContract<{ total_claims: string; total_challenges: string }>(
      'get_protocol_configuration',
    );
    await syncClaims(Number(config.total_claims));
    await syncChallenges(Number(config.total_challenges));
  } catch (err) {
    if (isRateLimitError(err)) {
      rateLimitedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
      // eslint-disable-next-line no-console
      console.error(
        `indexer: hit GenLayer RPC rate limit, backing off for ${RATE_LIMIT_BACKOFF_MS / 60_000} minutes`,
      );
    } else {
      throw err;
    }
  } finally {
    inFlight = false;
  }
}

async function tick(): Promise<void> {
  if (!isIndexerLeader()) {
    const acquired = await tryAcquireIndexerLock();
    if (!acquired) return;
    // eslint-disable-next-line no-console
    console.log('indexer: acquired leader lock, starting to poll chain state');
  }
  await pollOnce();
}

export function startIndexer(): void {
  if (pollHandle) return;
  const interval = Math.min(POLL_INTERVAL_MS, LOCK_RETRY_INTERVAL_MS);
  pollHandle = setInterval(() => {
    tick().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Indexer tick failed (will retry next interval):', err);
    });
  }, interval);
  pollHandle.unref();
}

export async function stopIndexer(): Promise<void> {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = undefined;
  }
  await releaseIndexerLock();
}
