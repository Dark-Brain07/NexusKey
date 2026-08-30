'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import {
  resolvePropertyClaim,
  finalizeUncontestedClaim,
  revokePropertyClaim,
  claimExpiredBond,
} from '@/lib/genlayerClient';
import type { ClaimRecord } from '@nexuskey/shared';
import type { Address } from 'genlayer-js/types';

export type ClaimActionState = { status: 'idle' } | { status: 'pending' } | { status: 'error'; message: string };

/**
 * Single source of truth for "what can be done with this claim right
 * now, and how" -- shared by the claim details page and every dashboard
 * card so the two surfaces can never show different actions for the
 * same claim. Every write here invalidates both the single-claim query
 * key (detail page) and the wallet-claims list query key (dashboard),
 * since either surface might be the one mounted when an action runs.
 */
export function useClaimActions(claim: ClaimRecord, claimId: string) {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [actionState, setActionState] = useState<ClaimActionState>({ status: 'idle' });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['claim', claimId] });
    if (address) {
      await queryClient.invalidateQueries({ queryKey: ['claims-by-wallet', address] });
    }
  }

  function run(action: (provider: unknown, account: Address) => Promise<unknown>) {
    return async () => {
      if (!address) return;
      setActionState({ status: 'pending' });
      try {
        const provider = (window as unknown as { ethereum?: unknown }).ethereum;
        await action(provider, address as Address);
        await invalidate();
        setActionState({ status: 'idle' });
      } catch (err) {
        setActionState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Transaction failed. Try again.',
        });
      }
    };
  }

  const handleResolve = run((p, a) => resolvePropertyClaim(p, a, claimId));
  const handleFinalize = run((p, a) => finalizeUncontestedClaim(p, a, claimId));
  const handleClaimExpiredBond = run((p, a) => claimExpiredBond(p, a, claimId));
  const handleRevoke = run(async (p, a) => {
    // Bond consequence genuinely differs by current status (see
    // contract.py's revoke_property_claim): revoking before a claim has
    // ever reached VERIFIED refunds the bond in full; revoking an
    // already-VERIFIED claim forfeits it entirely (protocol reserve, no
    // refund) -- a deliberate bait-and-switch deterrent, not a bug. The
    // confirm dialog must say which one is about to happen, since a
    // claimant filing this from CONTEST_WINDOW right after clicking
    // "Finalize Now" would otherwise have no idea the outcome just
    // changed from refund to forfeiture.
    const consequence =
      claim.status === 'VERIFIED'
        ? 'This claim is already VERIFIED. Revoking it now will FORFEIT your bond entirely -- no refund.'
        : 'Your bond will be refunded in full.';
    if (typeof window !== 'undefined' && !window.confirm(`Revoke this claim? This cannot be undone. ${consequence}`)) {
      throw new Error('Revocation cancelled.');
    }
    return revokePropertyClaim(p, a, claimId);
  });

  const isClaimant = Boolean(address) && address?.toLowerCase() === claim.claimant.toLowerCase();
  const canRevoke = isClaimant && !['REJECTED', 'EXPIRED', 'REVOKED', 'CHALLENGED'].includes(claim.status);
  const canRenew = isClaimant && ['REJECTED', 'EXPIRED', 'REVOKED'].includes(claim.status);
  const naturallyExpired = claim.status === 'VERIFIED' && !claim.is_currently_verified;
  const canResolve = claim.status === 'PENDING';
  // finalize_uncontested_claim reverts on-chain until the contest window
  // has actually elapsed (contract.py: elapsed < 0 -> "contest window has
  // not yet closed") -- claim.status alone flips to CONTEST_WINDOW the
  // moment the window *opens*, well before it closes, so gating on status
  // alone let the button sit enabled (and revert) for the whole window.
  const windowElapsed = Boolean(claim.challenge_window_ends_at) && new Date(claim.challenge_window_ends_at as string).getTime() <= Date.now();
  const canFinalize = claim.status === 'CONTEST_WINDOW' && windowElapsed;
  const canClaimExpiredBond = naturallyExpired;

  return {
    isConnected,
    actionState,
    isClaimant,
    canRevoke,
    canRenew,
    canResolve,
    canFinalize,
    canClaimExpiredBond,
    naturallyExpired,
    windowElapsed,
    handleResolve,
    handleFinalize,
    handleRevoke,
    handleClaimExpiredBond,
  };
}
