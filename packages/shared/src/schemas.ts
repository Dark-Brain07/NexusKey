import { z } from 'zod';
import {
  AUTHORITY_TYPES,
  CLAIM_STATUSES,
  EVIDENCE_RESULTS,
  CONFLICT_RESULTS,
  CHALLENGE_REASONS,
  CHALLENGE_STATUSES,
  CHALLENGE_RESOLUTIONS,
} from './enums.js';

export const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid 0x-prefixed 20-byte address');

export const evidenceUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine((url) => url.startsWith('https://') || url.startsWith('http://'), {
    message: 'Evidence URL must use http or https',
  })
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        // Reject obviously non-public hosts client-side as a first line of
        // defense; the backend performs a stricter SSRF check (DNS
        // resolution + private-range block) before ever fetching server-side.
        // URL's .hostname returns IPv6 hosts with brackets (e.g. "[::1]"),
        // not the bare "::1" -- compare against both forms.
        const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
        return !blocked.includes(parsed.hostname);
      } catch {
        return false;
      }
    },
    { message: 'Evidence URL must be a publicly accessible address' },
  );

export const claimSubmissionSchema = z.object({
  country: z.string().min(2).max(56),
  stateOrRegion: z.string().min(2).max(56),
  city: z.string().min(1).max(85),
  streetAddress: z.string().min(3).max(160),
  unit: z.string().max(32).optional(),
  claimantName: z.string().min(2).max(120),
  authorityType: z.enum(AUTHORITY_TYPES),
  listingTitle: z.string().min(3).max(120),
  listingDescription: z.string().min(10).max(2000),
  evidenceUrl: evidenceUrlSchema,
  imageReferences: z.array(z.string().url()).max(10).default([]),
});
export type ClaimSubmission = z.infer<typeof claimSubmissionSchema>;

/**
 * Mirrors the exact JSON shape returned by the deployed contract's
 * get_claim() / get_claims_by_property_key() / get_active_claims_for_property()
 * (see contracts/NexusKey/contract.py, NexusKey._claim_to_dict) -- snake_case
 * field names, because that's what actually comes back over the wire from
 * a GenLayer view call. Deliberately not camelCased at this boundary: a
 * transformation step is one more place field names could silently drift
 * from the contract's real output.
 */
export const claimRecordSchema = z.object({
  claim_id: z.union([z.string(), z.number()]),
  claimant: walletAddressSchema,
  claimant_name: z.string(),
  property_key: z.string(),
  country: z.string(),
  state_or_region: z.string(),
  city: z.string(),
  street_address: z.string(),
  unit: z.string(),
  authority_type: z.enum(AUTHORITY_TYPES),
  listing_title: z.string(),
  listing_description: z.string(),
  evidence_url: z.string(),
  status: z.enum(CLAIM_STATUSES),
  is_currently_verified: z.boolean(),
  bond_wei: z.string(),
  bond_deposited: z.string(),
  created_at: z.string(),
  verified_at: z.string().nullable(),
  verification_expires_at: z.string().nullable(),
  challenge_window_ends_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  evidence_result: z.enum(EVIDENCE_RESULTS).nullable(),
  conflict_result: z.enum(CONFLICT_RESULTS).nullable(),
  renewed_from_claim_id: z.union([z.string(), z.number()]).nullable(),
  has_open_challenge: z.boolean(),
  open_challenge_id: z.union([z.string(), z.number()]).nullable(),
});
export type ClaimRecord = z.infer<typeof claimRecordSchema>;

export const challengeSubmissionSchema = z.object({
  claimId: z.string(),
  reason: z.enum(CHALLENGE_REASONS),
  evidenceUrl: evidenceUrlSchema,
  supportingInfo: z.string().max(2000).optional().default(''),
});
export type ChallengeSubmission = z.infer<typeof challengeSubmissionSchema>;

/** Mirrors contract.py's get_challenge() output exactly -- see claimRecordSchema's note above. */
export const challengeRecordSchema = z.object({
  challenge_id: z.union([z.string(), z.number()]),
  claim_id: z.union([z.string(), z.number()]),
  challenger: walletAddressSchema,
  reason: z.enum(CHALLENGE_REASONS),
  evidence_url: z.string(),
  supporting_info: z.string(),
  status: z.enum(CHALLENGE_STATUSES),
  resolution: z.enum(CHALLENGE_RESOLUTIONS).nullable(),
  bond_wei: z.string(),
  bond_deposited: z.string(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
});
export type ChallengeRecord = z.infer<typeof challengeRecordSchema>;

export const propertySearchQuerySchema = z.object({
  q: z.string().min(2).max(200).optional(),
  city: z.string().max(85).optional(),
  stateOrRegion: z.string().max(56).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type PropertySearchQuery = z.infer<typeof propertySearchQuerySchema>;

export const challengeableClaimsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type ChallengeableClaimsQuery = z.infer<typeof challengeableClaimsQuerySchema>;

export const evidenceResultSchema = z.enum(EVIDENCE_RESULTS);
export const conflictResultSchema = z.enum(CONFLICT_RESULTS);
