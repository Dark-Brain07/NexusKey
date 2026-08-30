import { describe, it, expect } from 'vitest';
import { extractWriteResult, assertTransactionAccepted } from '../genlayerClient';

/**
 * extractWriteResult is what filePropertyClaim/challengePropertyClaim/
 * renewPropertyClaim use to read the real claim/challenge ID straight off
 * the write call's decoded receipt (consensus_data.leader_receipt[0].result)
 * instead of guessing it from the global total_claims/total_challenges
 * counter -- that guess was racy under concurrent filers. These tests pin
 * the receipt shape this depends on so a genlayer-js upgrade that changes
 * it fails loudly here instead of silently misrouting a redirect.
 */
describe('extractWriteResult', () => {
  it('reads the decoded result off a StudioNet-shaped receipt', () => {
    const receipt = {
      consensus_data: {
        leader_receipt: [{ result: 42 }],
      },
    };
    expect(extractWriteResult(receipt)).toBe(42);
  });

  it('reads a string result unchanged', () => {
    const receipt = {
      consensus_data: {
        leader_receipt: [{ result: '7' }],
      },
    };
    expect(extractWriteResult(receipt)).toBe('7');
  });

  it('returns undefined when leader_receipt is missing', () => {
    expect(extractWriteResult({ consensus_data: {} })).toBeUndefined();
  });

  it('returns undefined when leader_receipt is empty', () => {
    expect(extractWriteResult({ consensus_data: { leader_receipt: [] } })).toBeUndefined();
  });

  it('returns undefined when consensus_data is missing entirely', () => {
    expect(extractWriteResult({})).toBeUndefined();
  });

  it('returns undefined for a null or undefined receipt', () => {
    expect(extractWriteResult(null)).toBeUndefined();
    expect(extractWriteResult(undefined)).toBeUndefined();
  });

  it('takes only the first leader receipt when multiple are present', () => {
    const receipt = {
      consensus_data: {
        leader_receipt: [{ result: 1 }, { result: 2 }],
      },
    };
    expect(extractWriteResult(receipt)).toBe(1);
  });
});

/**
 * assertTransactionAccepted guards against two distinct ways a receipt
 * can look superficially fine while the write never actually took
 * effect on-chain -- both confirmed against real StudioNet transactions,
 * not just theory:
 *
 * 1. `waitForTransactionReceipt({ status: ACCEPTED })` resolves on the
 *    FIRST *decided* status the transaction reaches, which can already
 *    be FINALIZED by the time the first poll catches it (or, on the bad
 *    side, UNDETERMINED/CANCELED/LEADER_TIMEOUT/VALIDATORS_TIMEOUT).
 * 2. A transaction can reach a fine status (ACCEPTED/FINALIZED) with the
 *    leader's own execution_result: 'SUCCESS', while the transaction's
 *    real consensus vote outcome (`result_name` -- confirmed to be the
 *    populated field on StudioNet; `resultName` is always undefined
 *    there) was MAJORITY_DISAGREE. GenVM finalizes such a transaction
 *    anyway, but does NOT commit its state change -- verified live by
 *    re-reading the contract afterward and finding the write never
 *    applied.
 */
// A receipt shape helper: only an acceptable status + an agreeing
// result_name + a SUCCESS leader-receipt execution_result should ever
// count as a trustworthy write. Every test below builds off this
// baseline and breaks exactly one field.
function acceptedSuccessReceipt(overrides: Record<string, unknown> = {}) {
  return {
    statusName: 'ACCEPTED',
    result_name: 'MAJORITY_AGREE',
    consensus_data: { leader_receipt: [{ execution_result: 'SUCCESS' }] },
    ...overrides,
  };
}

describe('assertTransactionAccepted', () => {
  it('does not throw for a genuinely ACCEPTED, agreeing, successful receipt', () => {
    expect(() => assertTransactionAccepted(acceptedSuccessReceipt(), 'Claim filing')).not.toThrow();
  });

  it('does not throw when the receipt has already raced ahead to FINALIZED', () => {
    expect(() =>
      assertTransactionAccepted(acceptedSuccessReceipt({ statusName: 'FINALIZED' }), 'Claim filing'),
    ).not.toThrow();
  });

  it('does not throw when result_name is a plain AGREE (small validator set, not MAJORITY_AGREE)', () => {
    expect(() =>
      assertTransactionAccepted(acceptedSuccessReceipt({ result_name: 'AGREE' }), 'Claim filing'),
    ).not.toThrow();
  });

  it('does not throw when result_name is absent but execution_result is SUCCESS (field not populated on this network path)', () => {
    const receipt = acceptedSuccessReceipt();
    delete (receipt as { result_name?: string }).result_name;
    expect(() => assertTransactionAccepted(receipt, 'Claim filing')).not.toThrow();
  });

  it('throws when the decided status is UNDETERMINED', () => {
    expect(() =>
      assertTransactionAccepted(acceptedSuccessReceipt({ statusName: 'UNDETERMINED' }), 'Claim filing'),
    ).toThrow(/did not reach an accepted status/);
  });

  it('throws when the decided status is CANCELED', () => {
    expect(() =>
      assertTransactionAccepted(acceptedSuccessReceipt({ statusName: 'CANCELED' }), 'Challenge filing'),
    ).toThrow(/did not reach an accepted status/);
  });

  it('throws when statusName is missing entirely', () => {
    expect(() => assertTransactionAccepted({}, 'Claim filing')).toThrow(/did not reach an accepted status/);
  });

  // The core live-discovered bug: validators majority-disagreeing means
  // the write's state change was never committed, even though the
  // leader's own execution completed without error and the transaction
  // reached a nominally "decided" status.
  it('throws when validators majority-disagreed on the outcome, even with a SUCCESS execution_result', () => {
    expect(() =>
      assertTransactionAccepted(acceptedSuccessReceipt({ result_name: 'MAJORITY_DISAGREE' }), 'Claim resolution'),
    ).toThrow(/validators did not agree on the outcome \(MAJORITY_DISAGREE\)/);
  });

  it('throws on NO_MAJORITY', () => {
    expect(() =>
      assertTransactionAccepted(acceptedSuccessReceipt({ result_name: 'NO_MAJORITY' }), 'Claim filing'),
    ).toThrow(/validators did not agree on the outcome/);
  });

  it('throws on DETERMINISTIC_VIOLATION', () => {
    expect(() =>
      assertTransactionAccepted(acceptedSuccessReceipt({ result_name: 'DETERMINISTIC_VIOLATION' }), 'Claim filing'),
    ).toThrow(/validators did not agree on the outcome/);
  });

  it('throws when consensus agreed but the leader receipt execution_result is not SUCCESS', () => {
    expect(() =>
      assertTransactionAccepted(
        acceptedSuccessReceipt({ consensus_data: { leader_receipt: [{ execution_result: 'ERROR' }] } }),
        'Claim resolution',
      ),
    ).toThrow(/contract execution did not report success/);
  });

  // Fail closed, not fail open: every write in this module fetches a
  // fullTransaction receipt from StudioNet, so execution_result is always
  // expected to be present. A receipt missing it entirely is an
  // unexpected shape, not proof of success -- silently treating "we
  // couldn't check" as "success" would be exactly the fail-open bug this
  // guard exists to prevent.
  it('throws when consensus_data is missing entirely', () => {
    const receipt = acceptedSuccessReceipt();
    delete (receipt as { consensus_data?: unknown }).consensus_data;
    expect(() => assertTransactionAccepted(receipt, 'Claim filing')).toThrow(
      /contract execution did not report success \(missing execution_result\)/,
    );
  });

  it('throws when leader_receipt is an empty array', () => {
    expect(() =>
      assertTransactionAccepted(
        acceptedSuccessReceipt({ consensus_data: { leader_receipt: [] } }),
        'Claim filing',
      ),
    ).toThrow(/missing execution_result/);
  });

  it('throws when execution_result itself is absent from the leader receipt', () => {
    expect(() =>
      assertTransactionAccepted(
        acceptedSuccessReceipt({ consensus_data: { leader_receipt: [{}] } }),
        'Claim filing',
      ),
    ).toThrow(/missing execution_result/);
  });
});
