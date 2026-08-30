import { describe, it, expect } from 'vitest';
import { claimSubmissionSchema, claimRecordSchema, evidenceUrlSchema, walletAddressSchema } from '../schemas.js';

describe('evidenceUrlSchema', () => {
  it('accepts valid public http(s) URLs', () => {
    expect(evidenceUrlSchema.safeParse('https://example.com/evidence').success).toBe(true);
    expect(evidenceUrlSchema.safeParse('http://example.com/evidence').success).toBe(true);
  });

  it('rejects non-URL strings', () => {
    expect(evidenceUrlSchema.safeParse('not a url').success).toBe(false);
  });

  it('rejects localhost and loopback addresses (first-line SSRF defense)', () => {
    expect(evidenceUrlSchema.safeParse('http://localhost/evidence').success).toBe(false);
    expect(evidenceUrlSchema.safeParse('http://127.0.0.1/evidence').success).toBe(false);
    expect(evidenceUrlSchema.safeParse('http://[::1]/evidence').success).toBe(false);
  });
});

describe('walletAddressSchema', () => {
  it('accepts a valid checksummed-length 0x address', () => {
    expect(walletAddressSchema.safeParse('[OLDER_CONTRACT_ADDRESS]').success).toBe(true);
  });

  it('rejects malformed addresses', () => {
    expect(walletAddressSchema.safeParse('not-an-address').success).toBe(false);
    expect(walletAddressSchema.safeParse('0x123').success).toBe(false);
  });
});

describe('claimSubmissionSchema', () => {
  const validClaim = {
    country: 'US',
    stateOrRegion: 'NY',
    city: 'New York',
    streetAddress: '123 Main Street',
    unit: '4B',
    claimantName: 'Apex Property Mgmt',
    authorityType: 'PROPERTY_MANAGER',
    listingTitle: 'Cozy 2BR near downtown',
    listingDescription: 'A lovely two bedroom apartment close to transit.',
    evidenceUrl: 'https://example.com/evidence',
    imageReferences: [],
  };

  it('accepts a fully valid submission', () => {
    expect(claimSubmissionSchema.safeParse(validClaim).success).toBe(true);
  });

  it('rejects an invalid authorityType not in the fixed enum', () => {
    const result = claimSubmissionSchema.safeParse({ ...validClaim, authorityType: 'LANDLORD' });
    expect(result.success).toBe(false);
  });

  it('rejects a listingDescription that is too short', () => {
    const result = claimSubmissionSchema.safeParse({ ...validClaim, listingDescription: 'short' });
    expect(result.success).toBe(false);
  });

  it('defaults imageReferences to an empty array when omitted', () => {
    const { imageReferences: _omit, ...withoutImages } = validClaim;
    const result = claimSubmissionSchema.safeParse(withoutImages);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imageReferences).toEqual([]);
    }
  });
});

describe('claimRecordSchema', () => {
  it('parses a well-formed contract get_claim() response (snake_case)', () => {
    const raw = {
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
      listing_title: 'Cozy 2BR',
      listing_description: 'A lovely two bedroom apartment.',
      evidence_url: 'https://example.com/evidence',
      status: 'VERIFIED',
      is_currently_verified: true,
      bond_wei: '50000000000000000000',
      bond_deposited: '50000000000000000000',
      created_at: '2026-01-01T00:00:00+00:00',
      verified_at: '2026-01-01T00:05:00+00:00',
      verification_expires_at: '2026-04-01T00:05:00+00:00',
      challenge_window_ends_at: null,
      revoked_at: null,
      evidence_result: 'EVIDENCE_VERIFIED',
      conflict_result: 'NO_CONFLICT',
      renewed_from_claim_id: null,
      has_open_challenge: false,
      open_challenge_id: null,
    };
    const result = claimRecordSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it('rejects a response with an unrecognized status value', () => {
    const raw = { claim_id: 1, status: 'MADE_UP_STATUS' };
    expect(claimRecordSchema.safeParse(raw).success).toBe(false);
  });

  it('accepts conflict_result: NOT_APPLICABLE (regression -- this exact value broke every claim resolved with no pre-existing conflict, i.e. the common case, until it was added to CONFLICT_RESULTS)', () => {
    const raw = {
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
      listing_title: 'Cozy 2BR',
      listing_description: 'A lovely two bedroom apartment.',
      evidence_url: 'https://example.com/evidence',
      status: 'CONTEST_WINDOW',
      is_currently_verified: false,
      bond_wei: '50000000000000000000',
      bond_deposited: '50000000000000000000',
      created_at: '2026-01-01T00:00:00+00:00',
      verified_at: null,
      verification_expires_at: null,
      challenge_window_ends_at: '2026-01-04T00:00:00+00:00',
      revoked_at: null,
      evidence_result: 'EVIDENCE_INSUFFICIENT',
      conflict_result: 'NOT_APPLICABLE',
      renewed_from_claim_id: null,
      has_open_challenge: false,
      open_challenge_id: null,
    };
    const result = claimRecordSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });
});
