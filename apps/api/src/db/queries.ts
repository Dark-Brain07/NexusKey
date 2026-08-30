import type { ClaimRecord, ChallengeRecord } from '@nexuskey/shared';
import { normalizeAddress, computePropertyKey } from '@nexuskey/shared';
import { pool } from './pool.js';

/**
 * Upserts the property row derived from a claim's address fields. The
 * properties table is a read-model only -- computed from whatever claims
 * reference it, never independently authoritative (see docs/DATABASE.md).
 */
export async function upsertPropertyFromClaim(claim: ClaimRecord): Promise<void> {
  const normalized = normalizeAddress({
    country: claim.country,
    stateOrRegion: claim.state_or_region,
    city: claim.city,
    streetAddress: claim.street_address,
    unit: claim.unit,
  });
  const computedKey = await computePropertyKey(normalized.canonicalString);

  await pool.query(
    `INSERT INTO properties (property_key, country, state_or_region, city, normalized_street_address, normalized_unit, display_address, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (property_key) DO UPDATE SET
       display_address = EXCLUDED.display_address,
       updated_at = now()`,
    [
      computedKey,
      normalized.country,
      normalized.stateOrRegion,
      normalized.city,
      normalized.normalizedStreetAddress,
      normalized.normalizedUnit,
      `${claim.street_address}${claim.unit ? `, Unit ${claim.unit}` : ''}`,
    ],
  );
}

export async function upsertClaim(claim: ClaimRecord): Promise<void> {
  await upsertPropertyFromClaim(claim);
  const normalized = normalizeAddress({
    country: claim.country,
    stateOrRegion: claim.state_or_region,
    city: claim.city,
    streetAddress: claim.street_address,
    unit: claim.unit,
  });
  const propertyKey = await computePropertyKey(normalized.canonicalString);

  await pool.query(
    `INSERT INTO claims (
       claim_id, property_key, claimant_wallet, claimant_name, authority_type,
       listing_title, listing_description, evidence_url, status,
       bond_amount_wei, bond_deposited_wei, created_at_chain, verified_at,
       verification_expires_at, challenge_window_ends_at, renewed_from_claim_id,
       revoked_at, indexed_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, now())
     ON CONFLICT (claim_id) DO UPDATE SET
       status = EXCLUDED.status,
       bond_deposited_wei = EXCLUDED.bond_deposited_wei,
       verified_at = EXCLUDED.verified_at,
       verification_expires_at = EXCLUDED.verification_expires_at,
       challenge_window_ends_at = EXCLUDED.challenge_window_ends_at,
       revoked_at = EXCLUDED.revoked_at,
       indexed_at = now()`,
    [
      Number(claim.claim_id),
      propertyKey,
      claim.claimant,
      claim.claimant_name,
      claim.authority_type,
      claim.listing_title,
      claim.listing_description,
      claim.evidence_url,
      claim.status,
      claim.bond_wei,
      claim.bond_deposited,
      claim.created_at,
      claim.verified_at,
      claim.verification_expires_at,
      claim.challenge_window_ends_at,
      claim.renewed_from_claim_id !== null ? Number(claim.renewed_from_claim_id) : null,
      claim.revoked_at,
    ],
  );

  // A VERIFIED row whose verification_expires_at has already passed is
  // stale -- it reads as active on-chain only until someone calls
  // claim_expired_bond, but this cache should never surface it as active
  // discovery/search metadata in the meantime (same rule the contract
  // itself applies in _active_claims_for_property).
  await pool.query(
    `UPDATE properties SET active_claim_count = (
       SELECT count(*) FROM claims
       WHERE property_key = $1
         AND (
           status IN ('PENDING','CONTEST_WINDOW','CHALLENGED')
           OR (status = 'VERIFIED' AND verification_expires_at > now())
         )
     ) WHERE property_key = $1`,
    [propertyKey],
  );
}

export async function upsertChallenge(challenge: ChallengeRecord): Promise<void> {
  await pool.query(
    `INSERT INTO challenges (
       challenge_id, claim_id, challenger_wallet, reason, evidence_url,
       supporting_info, bond_amount_wei, status, resolution_code,
       created_at_chain, resolved_at, indexed_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     ON CONFLICT (challenge_id) DO UPDATE SET
       status = EXCLUDED.status,
       resolution_code = EXCLUDED.resolution_code,
       resolved_at = EXCLUDED.resolved_at,
       indexed_at = now()`,
    [
      Number(challenge.challenge_id),
      Number(challenge.claim_id),
      challenge.challenger,
      challenge.reason,
      challenge.evidence_url,
      challenge.supporting_info,
      challenge.bond_wei,
      challenge.status,
      challenge.resolution,
      challenge.created_at,
      challenge.resolved_at,
    ],
  );
}

export interface PropertySearchRow {
  property_key: string;
  city: string;
  state_or_region: string;
  display_address: string | null;
  active_claim_count: number;
  latest_claim_status: string | null;
}

export async function searchProperties(
  q: string | undefined,
  city: string | undefined,
  stateOrRegion: string | undefined,
  page: number,
  pageSize: number,
): Promise<{ rows: PropertySearchRow[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (q) {
    params.push(`%${q.toUpperCase()}%`);
    conditions.push(
      `(normalized_street_address ILIKE $${params.length} OR display_address ILIKE $${params.length})`,
    );
  }
  if (city) {
    params.push(city.toUpperCase());
    conditions.push(`city = $${params.length}`);
  }
  if (stateOrRegion) {
    params.push(stateOrRegion.toUpperCase());
    conditions.push(`state_or_region = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await pool.query<{ count: string }>(
    `SELECT count(*) FROM properties ${whereClause}`,
    params,
  );

  params.push(pageSize, (page - 1) * pageSize);
  const rows = await pool.query<PropertySearchRow>(
    `SELECT
       properties.property_key, properties.city, properties.state_or_region,
       properties.display_address, properties.active_claim_count,
       (
         SELECT status FROM claims
         WHERE claims.property_key = properties.property_key
         ORDER BY claims.created_at_chain DESC
         LIMIT 1
       ) AS latest_claim_status
     FROM properties ${whereClause}
     ORDER BY updated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { rows: rows.rows, total: Number(countResult.rows[0]?.count ?? 0) };
}

export interface ChallengeableClaimRow {
  claim_id: string;
  claimant_name: string;
  authority_type: string;
  status: string;
  verified_at: string | null;
  verification_expires_at: string | null;
  challenge_window_ends_at: string | null;
  display_address: string | null;
  city: string;
  state_or_region: string;
}

/**
 * Discovery index for challengers: claims currently open to a challenge
 * (mirrors challenge_property_claim's own eligibility check in
 * contract.py -- VERIFIED-and-still-valid or CONTEST_WINDOW, and no
 * already-open challenge) so a wallet can browse for disputes instead of
 * needing to already know a specific address to search for. Like every
 * other backend-index read, this is a discovery aid only -- the claim
 * page itself re-reads live contract state before anyone can actually
 * file a challenge.
 */
export async function listChallengeableClaims(
  page: number,
  pageSize: number,
): Promise<{ rows: ChallengeableClaimRow[]; total: number }> {
  const whereClause = `
    WHERE claims.status IN ('CONTEST_WINDOW', 'VERIFIED')
      AND (claims.status != 'VERIFIED' OR claims.verification_expires_at > now())
      AND NOT EXISTS (
        SELECT 1 FROM challenges
        WHERE challenges.claim_id = claims.claim_id AND challenges.status = 'PENDING'
      )
  `;

  const countResult = await pool.query<{ count: string }>(`SELECT count(*) FROM claims ${whereClause}`);

  const rows = await pool.query<ChallengeableClaimRow>(
    `SELECT
       claims.claim_id, claims.claimant_name, claims.authority_type, claims.status,
       claims.verified_at, claims.verification_expires_at, claims.challenge_window_ends_at,
       properties.display_address, properties.city, properties.state_or_region
     FROM claims
     JOIN properties ON properties.property_key = claims.property_key
     ${whereClause}
     ORDER BY claims.created_at_chain DESC
     LIMIT $1 OFFSET $2`,
    [pageSize, (page - 1) * pageSize],
  );

  return { rows: rows.rows, total: Number(countResult.rows[0]?.count ?? 0) };
}

export async function getClaimsByWallet(wallet: string): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT * FROM claims WHERE lower(claimant_wallet) = lower($1) ORDER BY created_at_chain DESC`,
    [wallet],
  );
  return result.rows;
}

export async function getChallengesByWallet(wallet: string): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT * FROM challenges WHERE lower(challenger_wallet) = lower($1) ORDER BY created_at_chain DESC`,
    [wallet],
  );
  return result.rows;
}

/**
 * Claim IDs the indexer still needs to (re-)fetch from chain: every ID
 * beyond the highest one already indexed (new filings), plus every
 * already-indexed row whose status can still change on-chain (REJECTED,
 * EXPIRED, and REVOKED are the only truly terminal claim states -- a
 * PENDING/CONTEST_WINDOW/CHALLENGED/VERIFIED row can always transition
 * later via resolution, challenge, or expiry). Replaces a blind 1..total
 * full rescan every poll, which was the direct cause of exhausting
 * GenLayer's shared public StudioNet RPC quota (5,000 req/day) almost
 * immediately once there were more than a handful of claims.
 */
export async function getClaimIdsNeedingSync(totalClaims: number): Promise<number[]> {
  if (totalClaims <= 0) return [];
  const result = await pool.query<{ claim_id: string }>(
    `SELECT claim_id FROM claims WHERE status NOT IN ('REJECTED', 'EXPIRED', 'REVOKED')`,
  );
  const nonTerminal = result.rows.map((r) => Number(r.claim_id));
  const maxIndexedResult = await pool.query<{ max: string | null }>(`SELECT max(claim_id) AS max FROM claims`);
  const maxIndexed = Number(maxIndexedResult.rows[0]?.max ?? 0);
  const ids = new Set(nonTerminal);
  for (let id = maxIndexed + 1; id <= totalClaims; id++) ids.add(id);
  return Array.from(ids).sort((a, b) => a - b);
}

/**
 * Same "new IDs plus still-mutable rows" logic as getClaimIdsNeedingSync,
 * for challenges. RESOLVED_CLAIMANT_WINS and RESOLVED_CHALLENGER_WINS are
 * the only terminal challenge states -- PENDING can still resolve later.
 */
export async function getChallengeIdsNeedingSync(totalChallenges: number): Promise<number[]> {
  if (totalChallenges <= 0) return [];
  const result = await pool.query<{ challenge_id: string }>(
    `SELECT challenge_id FROM challenges WHERE status NOT IN ('RESOLVED_CLAIMANT_WINS', 'RESOLVED_CHALLENGER_WINS')`,
  );
  const nonTerminal = result.rows.map((r) => Number(r.challenge_id));
  const maxIndexedResult = await pool.query<{ max: string | null }>(
    `SELECT max(challenge_id) AS max FROM challenges`,
  );
  const maxIndexed = Number(maxIndexedResult.rows[0]?.max ?? 0);
  const ids = new Set(nonTerminal);
  for (let id = maxIndexed + 1; id <= totalChallenges; id++) ids.add(id);
  return Array.from(ids).sort((a, b) => a - b);
}
