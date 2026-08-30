/**
 * Local mirror of protocol constants for UI display and pre-flight
 * estimates only (e.g. "You will bond 50 GEN" shown before the wallet
 * transaction is signed).
 *
 * This is NOT authoritative. The Intelligent Contract's own
 * get_protocol_configuration() read method is the source of truth, and the
 * frontend must fetch and reconcile against it — never assume these values
 * match what the deployed contract will actually enforce. Drift between
 * this file and the deployed contract is a display bug, not a security
 * bug, precisely because nothing here gates a real transfer.
 */

export const PROTOCOL_DEFAULTS = {
  /** GEN, in whole tokens — converted to wei (u256) at the call site. */
  CLAIM_BOND_MINIMUM_GEN: 50,
  CHALLENGE_BOND_MINIMUM_GEN: 50,
  /** Seconds. */
  CONTEST_WINDOW_SECONDS: 60 * 60 * 24 * 3, // 3 days
  VERIFICATION_VALIDITY_SECONDS: 60 * 60 * 24 * 90, // 90 days
} as const;

export const GEN_DECIMALS = 18;

export function genToWeiString(genAmount: number): string {
  if (!Number.isFinite(genAmount) || genAmount < 0) {
    throw new Error('genAmount must be a non-negative finite number');
  }
  const [whole, fraction = ''] = genAmount.toString().split('.');
  const fractionPadded = (fraction + '0'.repeat(GEN_DECIMALS)).slice(0, GEN_DECIMALS);
  const combined = `${whole}${fractionPadded}`.replace(/^0+(?=\d)/, '');
  return combined;
}

export function weiStringToGen(weiAmount: string): number {
  const padded = weiAmount.padStart(GEN_DECIMALS + 1, '0');
  const whole = padded.slice(0, -GEN_DECIMALS) || '0';
  const fraction = padded.slice(-GEN_DECIMALS);
  return Number(`${whole}.${fraction}`);
}

/** Wei amount as a display string in GEN, e.g. "50 GEN" -- trims trailing
 * fractional zeros so a whole-number bond doesn't show "50.000000...0 GEN". */
export function formatGen(weiAmount: string): string {
  const gen = weiStringToGen(weiAmount);
  const trimmed = gen.toFixed(6).replace(/\.?0+$/, '');
  return `${trimmed} GEN`;
}

/** Seconds as a display string in the largest whole unit that fits, e.g.
 * 259200 -> "3 days", 90 -> "90 seconds", 5400 -> "90 minutes". */
export function formatDuration(seconds: number): string {
  const units: [string, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [label, secondsPerUnit] of units) {
    if (seconds >= secondsPerUnit) {
      const count = Math.round(seconds / secondsPerUnit);
      return `${count} ${label}${count === 1 ? '' : 's'}`;
    }
  }
  return '0 seconds';
}
