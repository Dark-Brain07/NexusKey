import { describe, it, expect } from 'vitest';
import {
  AUTHORITY_TYPES,
  CHALLENGE_REASONS,
  authorityTypeToCode,
  challengeReasonToCode,
  isAuthorityType,
  isClaimStatus,
  isChallengeReason,
} from '../enums.js';

describe('authorityTypeToCode', () => {
  it('matches the contract.py AUTHORITY_NAMES ordering exactly', () => {
    // These integer codes are load-bearing: a mismatch here silently
    // sends the wrong authority_type integer to file_property_claim.
    expect(authorityTypeToCode('PROPERTY_OWNER')).toBe(0);
    expect(authorityTypeToCode('PROPERTY_MANAGER')).toBe(1);
    expect(authorityTypeToCode('AUTHORIZED_AGENT')).toBe(2);
    expect(authorityTypeToCode('AUTHORIZED_SUBLESSOR')).toBe(3);
    expect(authorityTypeToCode('OTHER_AUTHORIZED_REPRESENTATIVE')).toBe(4);
    expect(authorityTypeToCode('UNKNOWN')).toBe(5);
  });

  it('every AUTHORITY_TYPES entry maps to a unique code', () => {
    const codes = AUTHORITY_TYPES.map(authorityTypeToCode);
    expect(new Set(codes).size).toBe(AUTHORITY_TYPES.length);
  });
});

describe('challengeReasonToCode', () => {
  it('matches the contract.py REASON_NAMES ordering exactly', () => {
    expect(challengeReasonToCode('UNAUTHORIZED_LISTING')).toBe(0);
    expect(challengeReasonToCode('FALSE_PROPERTY_CONTROL')).toBe(1);
    expect(challengeReasonToCode('COPIED_LISTING')).toBe(2);
    expect(challengeReasonToCode('MISREPRESENTED_AUTHORITY')).toBe(3);
    expect(challengeReasonToCode('UNIT_DOES_NOT_MATCH')).toBe(4);
    expect(challengeReasonToCode('EXPIRED_AUTHORITY')).toBe(5);
    expect(challengeReasonToCode('OTHER')).toBe(6);
  });

  it('every CHALLENGE_REASONS entry maps to a unique code', () => {
    const codes = CHALLENGE_REASONS.map(challengeReasonToCode);
    expect(new Set(codes).size).toBe(CHALLENGE_REASONS.length);
  });
});

describe('type guards', () => {
  it('isAuthorityType accepts valid values and rejects invalid ones', () => {
    expect(isAuthorityType('PROPERTY_OWNER')).toBe(true);
    expect(isAuthorityType('NOT_A_REAL_TYPE')).toBe(false);
    expect(isAuthorityType('')).toBe(false);
  });

  it('isClaimStatus accepts valid values and rejects invalid ones', () => {
    expect(isClaimStatus('VERIFIED')).toBe(true);
    expect(isClaimStatus('MADE_UP_STATUS')).toBe(false);
  });

  it('isChallengeReason accepts valid values and rejects invalid ones', () => {
    expect(isChallengeReason('OTHER')).toBe(true);
    expect(isChallengeReason('NOT_A_REASON')).toBe(false);
  });
});
