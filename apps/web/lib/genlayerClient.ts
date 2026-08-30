import { createClient } from 'genlayer-js';
import { TransactionStatus, type Address, type TransactionHash } from 'genlayer-js/types';
import { studioNetChain } from './wagmiConfig';
import { isContractConfigured, publicEnv } from './env';
import {
  claimRecordSchema,
  challengeRecordSchema,
  authorityTypeToCode,
  challengeReasonToCode,
  genToWeiString,
  type ClaimRecord,
  type ChallengeRecord,
  type ClaimSubmission,
  type ChallengeSubmission,
} from '@NexusKey/shared';

/**
 * Thrown by every read/write in this module until
 * NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS is set to a real deployed address.
 * Pages must catch this and render <ContractNotConfiguredNotice />.
 */
export class ContractNotConfiguredError extends Error {
  constructor() {
    super(
      'The NexusKey Intelligent Contract has not been deployed yet, or its address has not been ' +
        'configured (NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS is empty).',
    );
    this.name = 'ContractNotConfiguredError';
  }
}

function requireContractAddress(): Address {
  if (!isContractConfigured || !publicEnv.NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS) {
    throw new ContractNotConfiguredError();
  }
  return publicEnv.NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS as Address;
}

/**
 * Single shared read-only client for view calls -- no account needed,
 * matching the product rule that public verification lookups never
 * require a wallet.
 */
let readClient: ReturnType<typeof createClient> | null = null;
function getReadClient() {
  if (!readClient) {
    readClient = createClient({ chain: studioNetChain });
  }
  return readClient;
}

async function readContract<T>(functionName: string, args: unknown[] = []): Promise<T> {
  const address = requireContractAddress();
  const client = getReadClient();
  const result = await client.readContract({
    address,
    functionName,
    args: args as never,
    jsonSafeReturn: true,
  });
  return result as T;
}

export async function getClaimStatus(claimId: string): Promise<ClaimRecord['status']> {
  const raw = await readContract<{ status: string }>('get_claim_status', [Number(claimId)]);
  return raw.status as ClaimRecord['status'];
}

export async function getClaim(claimId: string): Promise<ClaimRecord> {
  const raw = await readContract('get_claim', [Number(claimId)]);
  return claimRecordSchema.parse(raw);
}

export async function getActiveClaimsForProperty(propertyKey: string): Promise<ClaimRecord[]> {
  const raw = await readContract<unknown[]>('get_active_claims_for_property', [propertyKey]);
  return raw.map((entry) => claimRecordSchema.parse(entry));
}

export async function getClaimsByPropertyKey(propertyKey: string): Promise<ClaimRecord[]> {
  const raw = await readContract<unknown[]>('get_claims_by_property_key', [propertyKey]);
  return raw.map((entry) => claimRecordSchema.parse(entry));
}

export async function getChallenge(challengeId: string): Promise<ChallengeRecord> {
  const raw = await readContract('get_challenge', [Number(challengeId)]);
  return challengeRecordSchema.parse(raw);
}

export async function getProtocolConfiguration(): Promise<{
  claimBondMinWei: string;
  challengeBondMinWei: string;
  contestWindowSeconds: number;
  verificationValiditySeconds: number;
  totalClaims: string;
  totalChallenges: string;
}> {
  const raw = await readContract<{
    claim_bond_min: string;
    challenge_bond_min: string;
    contest_window_seconds: number;
    verification_validity_seconds: number;
    total_claims: string;
    total_challenges: string;
  }>('get_protocol_configuration');
  return {
    claimBondMinWei: raw.claim_bond_min,
    challengeBondMinWei: raw.challenge_bond_min,
    contestWindowSeconds: raw.contest_window_seconds,
    verificationValiditySeconds: raw.verification_validity_seconds,
    totalClaims: raw.total_claims,
    totalChallenges: raw.total_challenges,
  };
}

/**
 * Write path. Requires the connected wallet's EIP-1193 provider (from
 * wagmi/RainbowKit's active connector) and account address -- callers get
 * these from `useAccount()` / the connector, never from this module,
 * since only a 'use client' component in an active wallet session has
 * them. V1 wiring targets injected-wallet providers (MetaMask, browser
 * extension wallets); WalletConnect-only sessions route through a
 * different provider shape that isn't wired here yet.
 */
async function getWriteClient(provider: unknown, account: Address) {
  return createClient({ chain: studioNetChain, provider: provider as never, account });
}

/**
 * `fullTransaction` is a real, documented-in-source runtime option on
 * genlayer-js's `waitForTransactionReceipt` (it skips the receipt
 * simplification step that renames/drops fields), but it's missing from
 * the package's own .d.ts, so passing it directly is a type error. This
 * narrowly-scoped cast is the one place that gap is worked around, so a
 * receipt read here has `statusName`/`resultName` available for
 * assertTransactionAccepted to check.
 */
async function waitForFullReceipt(
  client: { waitForTransactionReceipt: (args: { hash: TransactionHash; status?: TransactionStatus }) => Promise<unknown> },
  hash: TransactionHash,
  status: TransactionStatus,
): Promise<unknown> {
  return client.waitForTransactionReceipt({ hash, status, fullTransaction: true } as never);
}

/**
 * Extracts the decoded return value of a write call from its confirmed
 * receipt. On StudioNet, `waitForTransactionReceipt` always decodes the
 * leader's execution result onto `consensus_data.leader_receipt[0].result`
 * before simplifying the receipt -- this is the contract's actual
 * `return claim_id` / `return challenge_id` value, not a guess.
 * Using this instead of re-reading the global total_claims/total_challenges
 * counter avoids the race where a concurrent filer bumps that counter
 * first and this caller gets redirected to someone else's claim.
 */
export function extractWriteResult(receipt: unknown): unknown {
  const leaderReceipt = (
    receipt as { consensus_data?: { leader_receipt?: Array<{ result?: unknown }> } }
  )?.consensus_data?.leader_receipt;
  return leaderReceipt?.[0]?.result;
}

// `waitForTransactionReceipt({ status: ACCEPTED })` resolves on the FIRST
// *decided* status the transaction reaches -- which, empirically against
// live StudioNet, can already be FINALIZED by the time the first poll
// catches it (GenVM can race straight past ACCEPTED). Requiring exact
// equality to ACCEPTED would wrongly reject a transaction that's actually
// further along and fine; UNDETERMINED/CANCELED/LEADER_TIMEOUT/
// VALIDATORS_TIMEOUT are the genuinely bad decided states.
const ACCEPTABLE_STATUS_NAMES: string[] = [TransactionStatus.ACCEPTED, TransactionStatus.FINALIZED];

// The transaction-level consensus vote outcome. Confirmed empirically
// against a real StudioNet transaction whose leader executed without
// error (execution_result: 'SUCCESS') but whose validators disagreed
// with each other (result_name: 'MAJORITY_DISAGREE') -- GenVM finalized
// the transaction anyway, WITHOUT committing its state change. A
// same-instance re-read of the contract confirmed the write never took
// effect. Only these two outcomes mean the majority of validators
// actually agreed on the same result.
const ACCEPTABLE_RESULT_NAMES: string[] = ['AGREE', 'MAJORITY_AGREE'];

/**
 * `resultName` (camelCase) is computed by genlayer-js's non-Studio decode
 * path and confirmed (via a live StudioNet transaction) to always be
 * `undefined` on this app's network -- the field that's actually
 * populated is `result_name` (snake_case, passed through verbatim from
 * StudioNet's own API response). A prior version of this function checked
 * `resultName`, which silently no-op'd on every real transaction. This
 * must run against a `fullTransaction: true` receipt.
 */
export function assertTransactionAccepted(receipt: unknown, actionDescription: string): void {
  const tx = receipt as {
    statusName?: string;
    result_name?: string;
    consensus_data?: { leader_receipt?: Array<{ execution_result?: string }> };
  };
  if (!tx.statusName || !ACCEPTABLE_STATUS_NAMES.includes(tx.statusName)) {
    throw new Error(
      `${actionDescription} did not reach an accepted status (got ${tx.statusName ?? 'unknown'}). ` +
        'The transaction may have failed or timed out at the validator level -- check your dashboard before retrying.',
    );
  }
  if (tx.result_name !== undefined && !ACCEPTABLE_RESULT_NAMES.includes(tx.result_name)) {
    throw new Error(
      `${actionDescription} reached a decided status, but validators did not agree on the outcome ` +
        `(${tx.result_name}) -- the write's state change was not committed. Safe to retry.`,
    );
  }
  // Consensus agreeing is not the same as the leader's contract execution
  // actually succeeding -- e.g. an unhandled Python exception in the
  // leader's run can still be what validators agreed happened. Every
  // write in this module goes through `waitForFullReceipt` against
  // StudioNet, so this field is expected on every real receipt -- fail
  // closed if it's missing (unexpected receipt shape) rather than
  // silently treating "we couldn't check" as "success."
  const executionResult = tx.consensus_data?.leader_receipt?.[0]?.execution_result;
  if (executionResult !== 'SUCCESS') {
    throw new Error(
      `${actionDescription} reached consensus, but contract execution did not report success ` +
        `(${executionResult ?? 'missing execution_result'}).`,
    );
  }
}

/**
 * ACCEPTED is not final on GenLayer -- the transaction is still appealable
 * until it reaches FINALIZED (see GenLayer's optimistic-consensus model).
 * This is a best-effort background wait for callers that want to know when
 * a filing is truly settled; it is intentionally never awaited inline in
 * the write functions below, since blocking the UI on the full appeal
 * window would make every filing feel hung. Callers should treat a
 * rejection here as "still provisional," not as proof the filing reverted.
 */
export async function waitForTransactionFinalization(hash: `0x${string}`): Promise<void> {
  const client = getReadClient();
  await client.waitForTransactionReceipt({
    hash: hash as TransactionHash,
    status: TransactionStatus.FINALIZED,
  });
}

export async function filePropertyClaim(
  provider: unknown,
  account: Address,
  propertyKey: string,
  values: ClaimSubmission,
  bondGen: number,
): Promise<{ hash: `0x${string}`; claimId: string }> {
  const address = requireContractAddress();
  const client = await getWriteClient(provider, account);
  const hash = await client.writeContract({
    address,
    functionName: 'file_property_claim',
    args: [
      propertyKey,
      values.country,
      values.stateOrRegion,
      values.city,
      values.streetAddress,
      values.unit ?? '',
      values.claimantName,
      authorityTypeToCode(values.authorityType),
      values.listingTitle,
      values.listingDescription,
      values.evidenceUrl,
    ],
    value: BigInt(genToWeiString(bondGen)),
  });
  const receipt = await waitForFullReceipt(client, hash, TransactionStatus.ACCEPTED);
  assertTransactionAccepted(receipt, 'Claim filing');
  const result = extractWriteResult(receipt);
  if (result === undefined || result === null) {
    throw new Error('Claim filed, but the contract did not return a claim ID.');
  }
  return { hash, claimId: String(result) };
}

export async function challengePropertyClaim(
  provider: unknown,
  account: Address,
  values: ChallengeSubmission,
  bondGen: number,
): Promise<{ hash: `0x${string}`; challengeId: string }> {
  const address = requireContractAddress();
  const client = await getWriteClient(provider, account);
  const hash = await client.writeContract({
    address,
    functionName: 'challenge_property_claim',
    args: [
      Number(values.claimId),
      challengeReasonToCode(values.reason),
      values.evidenceUrl,
      values.supportingInfo ?? '',
    ],
    value: BigInt(genToWeiString(bondGen)),
  });
  const receipt = await waitForFullReceipt(client, hash, TransactionStatus.ACCEPTED);
  assertTransactionAccepted(receipt, 'Challenge filing');
  const result = extractWriteResult(receipt);
  if (result === undefined || result === null) {
    throw new Error('Challenge filed, but the contract did not return a challenge ID.');
  }
  return { hash, challengeId: String(result) };
}

export async function revokePropertyClaim(
  provider: unknown,
  account: Address,
  claimId: string,
): Promise<`0x${string}`> {
  const address = requireContractAddress();
  const client = await getWriteClient(provider, account);
  const hash = await client.writeContract({
    address,
    functionName: 'revoke_property_claim',
    args: [Number(claimId)],
    value: BigInt(0),
  });
  const receipt = await waitForFullReceipt(client, hash, TransactionStatus.ACCEPTED);
  assertTransactionAccepted(receipt, 'Claim revocation');
  return hash;
}

/**
 * Runs the evidence (and, if the property has other active claims,
 * conflict) assessment for a claim that's still PENDING. This is a
 * *separate* call from file_property_claim by contract design -- filing
 * is fast and deterministic, resolution runs GenLayer validator
 * consensus and can take a few minutes, so the contract splits them so a
 * claimant is never blocked mid-transaction on a slow nondet round.
 * resolve_property_claim is permissionless -- anyone can call it, not
 * just the claimant -- so a claim left unresolved (e.g. a page reload
 * before the frontend's auto-follow-up ran) can always be unstuck later
 * without needing the original filer to come back.
 */
export async function resolvePropertyClaim(
  provider: unknown,
  account: Address,
  claimId: string,
): Promise<`0x${string}`> {
  const address = requireContractAddress();
  const client = await getWriteClient(provider, account);
  const hash = await client.writeContract({
    address,
    functionName: 'resolve_property_claim',
    args: [Number(claimId)],
    value: BigInt(0),
  });
  const receipt = await waitForFullReceipt(client, hash, TransactionStatus.ACCEPTED);
  assertTransactionAccepted(receipt, 'Claim resolution');
  return hash;
}


export async function finalizeUncontestedClaim(
  provider: unknown,
  account: Address,
  claimId: string,
): Promise<`0x${string}`> {
  const address = requireContractAddress();
  const client = await getWriteClient(provider, account);
  const hash = await client.writeContract({
    address,
    functionName: 'finalize_uncontested_claim',
    args: [Number(claimId)],
    value: BigInt(0),
  });
  const receipt = await waitForFullReceipt(client, hash, TransactionStatus.ACCEPTED);
  assertTransactionAccepted(receipt, 'Uncontested-claim finalization');
  return hash;
}

/**
 * Runs the challenge-judgement nondet round and settles both bonds --
 * the exact same "separate resolution step" pattern as
 * resolve_property_claim, and just as easy to leave permanently stuck if
 * nothing ever calls it. Permissionless: anyone can trigger this, not
 * just the claimant or challenger.
 */
export async function resolvePropertyChallenge(
  provider: unknown,
  account: Address,
  challengeId: string,
): Promise<`0x${string}`> {
  const address = requireContractAddress();
  const client = await getWriteClient(provider, account);
  const hash = await client.writeContract({
    address,
    functionName: 'resolve_property_challenge',
    args: [Number(challengeId)],
    value: BigInt(0),
  });
  const receipt = await waitForFullReceipt(client, hash, TransactionStatus.ACCEPTED);
  assertTransactionAccepted(receipt, 'Challenge resolution');
  return hash;
}

/**
 * Formalizes EXPIRED status on a VERIFIED claim past its validity window
 * and returns the claimant's bond in full. Permissionless.
 */
export async function claimExpiredBond(
  provider: unknown,
  account: Address,
  claimId: string,
): Promise<`0x${string}`> {
  const address = requireContractAddress();
  const client = await getWriteClient(provider, account);
  const hash = await client.writeContract({
    address,
    functionName: 'claim_expired_bond',
    args: [Number(claimId)],
    value: BigInt(0),
  });
  const receipt = await waitForFullReceipt(client, hash, TransactionStatus.ACCEPTED);
  assertTransactionAccepted(receipt, 'Expired-bond claim');
  return hash;
}

/**
 * Files a renewal claim linked to a prior claim that is EXPIRED,
 * REJECTED, or REVOKED (the only states the contract accepts -- renewing
 * from an active VERIFIED claim is out of scope by design, see
 * docs/GENLAYER_CONTRACT.md). Requires a fresh bond; returns the new
 * claim's on-chain transaction hash. Like a fresh filing, the new claim
 * still needs resolve_property_claim called afterward.
 */
export async function renewPropertyClaim(
  provider: unknown,
  account: Address,
  originalClaimId: string,
  evidenceUrl: string,
  listingTitle: string,
  listingDescription: string,
  bondGen: number,
): Promise<{ hash: `0x${string}`; claimId: string }> {
  const address = requireContractAddress();
  const client = await getWriteClient(provider, account);
  const hash = await client.writeContract({
    address,
    functionName: 'renew_property_claim',
    args: [Number(originalClaimId), evidenceUrl, listingTitle, listingDescription],
    value: BigInt(genToWeiString(bondGen)),
  });
  const receipt = await waitForFullReceipt(client, hash, TransactionStatus.ACCEPTED);
  assertTransactionAccepted(receipt, 'Claim renewal');
  const result = extractWriteResult(receipt);
  if (result === undefined || result === null) {
    throw new Error('Claim renewed, but the contract did not return a claim ID.');
  }
  return { hash, claimId: String(result) };
}
