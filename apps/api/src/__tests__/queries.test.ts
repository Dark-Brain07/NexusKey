import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import type { ClaimRecord, ChallengeRecord } from '@nexuskey/shared';
import { pool } from '../db/pool.js';
import {
  upsertClaim,
  upsertChallenge,
  getClaimsByWallet,
  searchProperties,
  getClaimIdsNeedingSync,
  getChallengeIdsNeedingSync,
} from '../db/queries.js';

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await pool.query('DELETE FROM challenges');
  await pool.query('DELETE FROM claim_status_history');
  await pool.query('DELETE FROM claims');
  await pool.query('DELETE FROM properties');
});

function makeClaim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
  return {
    claim_id: 1,
    claimant: '[OLDER_CONTRACT_ADDRESS]',
    claimant_name: 'Apex Property Mgmt',
    property_key: 'a'.repeat(64),
    country: 'US',
    state_or_region: 'NY',
    city: 'New York',
    street_address: '123 Main Street',
    unit: '4B',
    authority_type: 'PROPERTY_MANAGER',
    listing_title: 'Cozy 2BR near downtown',
    listing_description: 'A lovely two bedroom apartment close to transit.',
    evidence_url: 'https://example.com/evidence',
    status: 'VERIFIED',
    is_currently_verified: true,
    bond_wei: '50000000000000000000',
    bond_deposited: '50000000000000000000',
    created_at: '2026-01-01T00:00:00+00:00',
    verified_at: '2026-01-01T00:05:00+00:00',
    // Relative to "now", not a hardcoded date -- a fixed past-tense date
    // here silently turns a "currently VERIFIED" fixture into an expired
    // one as real time passes, which previously broke active_claim_count
    // assertions once the fixture date fell behind the test run's clock.
    verification_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    challenge_window_ends_at: null,
    revoked_at: null,
    evidence_result: 'EVIDENCE_VERIFIED',
    conflict_result: 'NO_CONFLICT',
    renewed_from_claim_id: null,
    has_open_challenge: false,
    open_challenge_id: null,
    ...overrides,
  };
}

function makeChallenge(overrides: Partial<ChallengeRecord> = {}): ChallengeRecord {
  return {
    challenge_id: 1,
    claim_id: 1,
    challenger: '0x0000000000000000000000000000000000000002',
    reason: 'UNAUTHORIZED_LISTING',
    evidence_url: 'https://example.com/challenge-evidence',
    supporting_info: 'This claim looks fraudulent.',
    status: 'PENDING',
    resolution: null,
    bond_wei: '50000000000000000000',
    bond_deposited: '50000000000000000000',
    created_at: '2026-01-02T00:00:00+00:00',
    resolved_at: null,
    ...overrides,
  };
}

describe('upsertClaim', () => {
  it('inserts a new claim and its derived property row', async () => {
    await upsertClaim(makeClaim());

    const claimRow = await pool.query('SELECT * FROM claims WHERE claim_id = 1');
    expect(claimRow.rows).toHaveLength(1);
    expect(claimRow.rows[0].claimant_name).toBe('Apex Property Mgmt');
    expect(claimRow.rows[0].status).toBe('VERIFIED');

    const propertyRow = await pool.query('SELECT * FROM properties');
    expect(propertyRow.rows).toHaveLength(1);
    expect(propertyRow.rows[0].active_claim_count).toBe(1);
  });

  it('is idempotent -- re-upserting the same claim_id updates rather than duplicates', async () => {
    await upsertClaim(makeClaim({ status: 'PENDING' }));
    await upsertClaim(makeClaim({ status: 'VERIFIED' }));

    const result = await pool.query('SELECT * FROM claims WHERE claim_id = 1');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe('VERIFIED');
  });

  it('recomputes active_claim_count when a claim moves to a terminal status', async () => {
    await upsertClaim(makeClaim({ status: 'VERIFIED' }));
    let property = await pool.query('SELECT active_claim_count FROM properties');
    expect(property.rows[0].active_claim_count).toBe(1);

    await upsertClaim(makeClaim({ status: 'EXPIRED' }));
    property = await pool.query('SELECT active_claim_count FROM properties');
    expect(property.rows[0].active_claim_count).toBe(0);
  });

  it('excludes a naturally-expired VERIFIED claim from active_claim_count', async () => {
    // Still status VERIFIED (claim_expired_bond hasn't been called yet),
    // but verification_expires_at is already in the past -- this cached
    // count must not treat it as active, mirroring the contract's own
    // _active_claims_for_property rule.
    await upsertClaim(
      makeClaim({ status: 'VERIFIED', verification_expires_at: '2020-01-01T00:00:00+00:00' }),
    );
    const property = await pool.query('SELECT active_claim_count FROM properties');
    expect(property.rows[0].active_claim_count).toBe(0);
  });

  it('two claims with equivalent addresses (different casing/abbreviations) resolve to the same property_key', async () => {
    await upsertClaim(
      makeClaim({
        claim_id: 1,
        street_address: '123 Main Street',
        unit: 'Unit 4B',
      }),
    );
    await upsertClaim(
      makeClaim({
        claim_id: 2,
        street_address: '123 Main St.',
        unit: 'Apt. 4-B',
      }),
    );

    const properties = await pool.query('SELECT property_key, active_claim_count FROM properties');
    expect(properties.rows).toHaveLength(1);
    expect(properties.rows[0].active_claim_count).toBe(2);
  });
});

describe('upsertChallenge', () => {
  it('inserts a challenge row linked to its claim', async () => {
    await upsertClaim(makeClaim());
    await upsertChallenge(makeChallenge());

    const result = await pool.query('SELECT * FROM challenges WHERE challenge_id = 1');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].claim_id).toBe('1');
    expect(result.rows[0].status).toBe('PENDING');
  });
});

describe('getClaimsByWallet', () => {
  it('returns only claims for the requested wallet, case-insensitively', async () => {
    await upsertClaim(makeClaim({ claim_id: 1, claimant: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }));
    await upsertClaim(makeClaim({ claim_id: 2, claimant: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' }));

    const rows = await getClaimsByWallet('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(rows).toHaveLength(1);
    expect((rows[0] as { claim_id: string }).claim_id).toBe('1');
  });
});

describe('searchProperties', () => {
  it('finds a property by partial street address, case-insensitively', async () => {
    await upsertClaim(makeClaim());
    const { rows, total } = await searchProperties('main street', undefined, undefined, 1, 20);
    expect(total).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.city).toBe('NEW YORK');
  });

  it('filters by city', async () => {
    await upsertClaim(makeClaim({ city: 'New York' }));
    await upsertClaim(makeClaim({ claim_id: 2, city: 'Boston', street_address: '55 Oak Ave' }));

    const { total } = await searchProperties(undefined, 'Boston', undefined, 1, 20);
    expect(total).toBe(1);
  });
});

describe('getClaimIdsNeedingSync', () => {
  it('includes every ID beyond the highest already-indexed claim', async () => {
    await upsertClaim(makeClaim({ claim_id: 1, status: 'REJECTED' }));
    const ids = await getClaimIdsNeedingSync(4);
    expect(ids).toEqual([2, 3, 4]);
  });

  it('includes an already-indexed row only if its status is still non-terminal', async () => {
    await upsertClaim(makeClaim({ claim_id: 1, status: 'PENDING' }));
    await upsertClaim(makeClaim({ claim_id: 2, status: 'REJECTED' }));
    await upsertClaim(makeClaim({ claim_id: 3, status: 'VERIFIED' }));
    await upsertClaim(makeClaim({ claim_id: 4, status: 'EXPIRED' }));
    await upsertClaim(makeClaim({ claim_id: 5, status: 'REVOKED' }));

    const ids = await getClaimIdsNeedingSync(5);
    // 1 (PENDING) and 3 (VERIFIED) can still change on-chain; 2/4/5 are
    // terminal and must not be re-fetched every poll.
    expect(ids).toEqual([1, 3]);
  });

  it('returns an empty array when nothing is new and everything indexed is terminal', async () => {
    await upsertClaim(makeClaim({ claim_id: 1, status: 'REJECTED' }));
    const ids = await getClaimIdsNeedingSync(1);
    expect(ids).toEqual([]);
  });

  it('returns an empty array when there are no claims at all', async () => {
    expect(await getClaimIdsNeedingSync(0)).toEqual([]);
  });
});

describe('getChallengeIdsNeedingSync', () => {
  it('includes every ID beyond the highest already-indexed challenge', async () => {
    await upsertClaim(makeClaim());
    await upsertChallenge(makeChallenge({ challenge_id: 1, status: 'RESOLVED_CLAIMANT_WINS' }));

    const ids = await getChallengeIdsNeedingSync(3);
    expect(ids).toEqual([2, 3]);
  });

  it('re-includes an already-indexed PENDING challenge but not a resolved one', async () => {
    await upsertClaim(makeClaim());
    await upsertChallenge(makeChallenge({ challenge_id: 1, status: 'PENDING' }));
    await upsertChallenge(makeChallenge({ challenge_id: 2, status: 'RESOLVED_CHALLENGER_WINS' }));

    const ids = await getChallengeIdsNeedingSync(2);
    expect(ids).toEqual([1]);
  });
});
