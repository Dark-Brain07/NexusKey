/**
 * Canonical enum values shared by the frontend, backend, and the GenLayer
 * Intelligent Contract. These strings are the wire format — the contract
 * stores and returns them verbatim, so changing a value here requires a
 * matching change in contracts/NexusKey/contract.py and a migration plan.
 */

export const AUTHORITY_TYPES = [
  'PROPERTY_OWNER',
  'PROPERTY_MANAGER',
  'AUTHORIZED_AGENT',
  'AUTHORIZED_SUBLESSOR',
  'OTHER_AUTHORIZED_REPRESENTATIVE',
  'UNKNOWN',
] as const;
export type AuthorityType = (typeof AUTHORITY_TYPES)[number];

export const AUTHORITY_TYPE_LABELS: Record<AuthorityType, string> = {
  PROPERTY_OWNER: 'Property Owner',
  PROPERTY_MANAGER: 'Property Manager',
  AUTHORIZED_AGENT: 'Authorized Agent',
  AUTHORIZED_SUBLESSOR: 'Authorized Sublessor',
  OTHER_AUTHORIZED_REPRESENTATIVE: 'Other Authorized Representative',
  UNKNOWN: 'Unknown / Unspecified',
};

export const AUTHORITY_TYPE_DESCRIPTIONS: Record<AuthorityType, string> = {
  PROPERTY_OWNER: 'Holds legal title to the property.',
  PROPERTY_MANAGER: 'Contracted by the owner to manage and rent the property on their behalf.',
  AUTHORIZED_AGENT: 'A real-estate agent or representative authorized to advertise the unit.',
  AUTHORIZED_SUBLESSOR: 'A current tenant with a lease that permits subletting this unit.',
  OTHER_AUTHORIZED_REPRESENTATIVE:
    'Another party with documented authorization to advertise or rent this property.',
  UNKNOWN:
    'Authority type not yet declared or unclear from the evidence provided. Not automatically treated as fraudulent — validators assess the submitted evidence on its merits.',
};

/**
 * Mirrors contract.py's STATUS_NAMES exactly (7 values). An earlier draft
 * of this array had 3 extra values (VERIFICATION_REQUIRED,
 * RESOLVED_CLAIMANT_WINS, RESOLVED_CHALLENGER_WINS) left over from the
 * README's original state-machine sketch before the deployed contract's
 * state machine was simplified -- a claim's status field can never
 * actually hold those values; only CHALLENGE_STATUSES uses
 * RESOLVED_CLAIMANT_WINS/RESOLVED_CHALLENGER_WINS (for a challenge's own
 * status, a distinct field from a claim's status).
 */
export const CLAIM_STATUSES = [
  'PENDING',
  'CONTEST_WINDOW',
  'CHALLENGED',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
  'REVOKED',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** Statuses in which a claim is not final and may still transition. */
export const ACTIVE_CLAIM_STATUSES: ClaimStatus[] = [
  'PENDING',
  'CONTEST_WINDOW',
  'CHALLENGED',
  'VERIFIED',
];

/** Statuses considered terminal — no further transitions except renewal (which opens a new claim). */
export const TERMINAL_CLAIM_STATUSES: ClaimStatus[] = ['REJECTED', 'EXPIRED', 'REVOKED'];

export const EVIDENCE_RESULTS = [
  'EVIDENCE_VERIFIED',
  'EVIDENCE_INSUFFICIENT',
  'EVIDENCE_CONTRADICTED',
] as const;
export type EvidenceResult = (typeof EVIDENCE_RESULTS)[number];

export const CONFLICT_RESULTS = [
  'NO_CONFLICT',
  'AUTHORIZED_SECONDARY_CLAIM',
  'LIKELY_UNAUTHORIZED_DUPLICATE',
  'CONFLICTING_CLAIM',
  'UNCERTAIN',
  // The contract returns this when a claim was resolved with no other
  // active claims on the same property to compare against -- CONFLICT_NOT_APPLICABLE
  // in contract.py's CONFLICT_NAMES. Omitting it here was a real schema/
  // contract mismatch: every claim resolved without a pre-existing
  // conflict (the common case) failed to parse, breaking both the
  // frontend claim-details read and the backend indexer for that claim.
  'NOT_APPLICABLE',
] as const;
export type ConflictResult = (typeof CONFLICT_RESULTS)[number];

export const EVIDENCE_RESULT_LABELS: Record<EvidenceResult, string> = {
  EVIDENCE_VERIFIED: 'Evidence Verified',
  EVIDENCE_INSUFFICIENT: 'Evidence Insufficient',
  EVIDENCE_CONTRADICTED: 'Evidence Contradicted',
};

export const CONFLICT_RESULT_LABELS: Record<ConflictResult, string> = {
  NO_CONFLICT: 'No Conflicting Claims',
  AUTHORIZED_SECONDARY_CLAIM: 'Authorized Secondary Claim',
  LIKELY_UNAUTHORIZED_DUPLICATE: 'Likely Unauthorized Duplicate',
  CONFLICTING_CLAIM: 'Conflicting Claim',
  UNCERTAIN: 'Uncertain',
  NOT_APPLICABLE: 'Not Applicable',
};

export const CHALLENGE_REASONS = [
  'UNAUTHORIZED_LISTING',
  'FALSE_PROPERTY_CONTROL',
  'COPIED_LISTING',
  'MISREPRESENTED_AUTHORITY',
  'UNIT_DOES_NOT_MATCH',
  'EXPIRED_AUTHORITY',
  'OTHER',
] as const;
export type ChallengeReason = (typeof CHALLENGE_REASONS)[number];

export const CHALLENGE_REASON_LABELS: Record<ChallengeReason, string> = {
  UNAUTHORIZED_LISTING: 'This listing was posted without authorization',
  FALSE_PROPERTY_CONTROL: 'The claimant does not control this property',
  COPIED_LISTING: 'This listing was copied from another source',
  MISREPRESENTED_AUTHORITY: 'The claimant misrepresented their authority type',
  UNIT_DOES_NOT_MATCH: 'The evidence does not match the specific unit claimed',
  EXPIRED_AUTHORITY: "The claimant's authority (lease, contract, agency) has ended",
  OTHER: 'Other (explain in supporting information)',
};

export const CHALLENGE_STATUSES = ['PENDING', 'RESOLVED_CLAIMANT_WINS', 'RESOLVED_CHALLENGER_WINS'] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export const CHALLENGE_RESOLUTIONS = [
  'CLAIMANT_AUTHORIZED',
  'CHALLENGER_CORRECT',
  'UNCERTAIN',
] as const;
export type ChallengeResolution = (typeof CHALLENGE_RESOLUTIONS)[number];

/** Type guards — used at every boundary where untrusted string input becomes an enum. */
export const isAuthorityType = (v: string): v is AuthorityType =>
  (AUTHORITY_TYPES as readonly string[]).includes(v);
export const isClaimStatus = (v: string): v is ClaimStatus =>
  (CLAIM_STATUSES as readonly string[]).includes(v);
export const isEvidenceResult = (v: string): v is EvidenceResult =>
  (EVIDENCE_RESULTS as readonly string[]).includes(v);
export const isConflictResult = (v: string): v is ConflictResult =>
  (CONFLICT_RESULTS as readonly string[]).includes(v);
export const isChallengeReason = (v: string): v is ChallengeReason =>
  (CHALLENGE_REASONS as readonly string[]).includes(v);
export const isChallengeResolution = (v: string): v is ChallengeResolution =>
  (CHALLENGE_RESOLUTIONS as readonly string[]).includes(v);

/**
 * The contract accepts authority_type and challenge reason as integer
 * codes (see contracts/NexusKey/contract.py AUTHORITY_NAMES / REASON_NAMES),
 * not strings. These arrays are authored in the same order as the
 * contract's dicts by construction, so the index *is* the contract's
 * integer code — no separate mapping table to drift out of sync.
 */
export function authorityTypeToCode(value: AuthorityType): number {
  return AUTHORITY_TYPES.indexOf(value);
}
export function challengeReasonToCode(value: ChallengeReason): number {
  return CHALLENGE_REASONS.indexOf(value);
}
