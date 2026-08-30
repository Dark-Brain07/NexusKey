'use client';

import { useState } from 'react';
import { Button } from '@/components/DesignSystem/Button';
import { RenewClaimForm } from './RenewClaimForm';
import { useClaimActions } from '@/lib/useClaimActions';
import { isContractConfigured } from '@/lib/env';
import type { ClaimRecord } from '@NexusKey/shared';

/**
 * Renders whichever actions actually apply to this claim right now --
 * used identically on the claim details page and every dashboard card,
 * via useClaimActions, so the two surfaces can never disagree about what
 * a claim's current state allows.
 */
export function ClaimActionButtons({
  claim,
  claimId,
  compact = false,
}: {
  claim: ClaimRecord;
  claimId: string;
  compact?: boolean;
}) {
  const {
    isConnected,
    actionState,
    canRevoke,
    canRenew,
    canResolve,
    canFinalize,
    canClaimExpiredBond,
    handleResolve,
    handleFinalize,
    handleRevoke,
    handleClaimExpiredBond,
  } = useClaimActions(claim, claimId);
  const [showRenewForm, setShowRenewForm] = useState(false);

  const pending = actionState.status === 'pending';
  // The claim is in CONTEST_WINDOW but the window hasn't closed yet --
  // finalize_uncontested_claim would revert on-chain if called now, so
  // show it visibly grayed out rather than hiding it outright: revoking
  // is always open during this window (full refund), finalizing opens
  // only once the window closes.
  const finalizeWaitingOnWindow = claim.status === 'CONTEST_WINDOW' && !canFinalize;
  const nothingToShow =
    !canResolve && !canFinalize && !finalizeWaitingOnWindow && !canClaimExpiredBond && !canRevoke && !canRenew;

  if (nothingToShow) return null;
  if (!isContractConfigured) return null;

  if (!isConnected) {
    return (
      <p className={compact ? 'text-body-sm text-on-surface-variant' : 'mt-2 text-body-sm text-on-surface-variant'}>
        Connect a wallet to manage this claim.
      </p>
    );
  }

  const size = compact ? 'text-body-sm' : '';
  // CONTEST_WINDOW is the one state where "advance this claim" (Finalize)
  // and "end this claim" (Revoke) can both be genuinely available at
  // once (once the window has closed) -- they're alternatives with
  // different bond outcomes, not two steps to do in sequence. Surface
  // that explicitly rather than letting two unrelated-looking buttons
  // sit side by side with no explanation.
  const hasConflictingActions = canFinalize && canRevoke;

  return (
    <div className={compact ? 'mt-3 flex flex-wrap gap-2' : 'space-y-3'} onClick={(e) => e.stopPropagation()}>
      {hasConflictingActions && (
        <p className="w-full text-body-sm text-status-warning">
          Choose one: finalizing verifies this claim (bond stays locked); revoking ends it now and
          refunds your bond. Doing both in sequence forfeits the bond instead of refunding it.
        </p>
      )}
      {canResolve && (
        <Button variant="secondary" className={size} loading={pending} disabled={pending} onClick={handleResolve}>
          Resolve Now
        </Button>
      )}
      {canFinalize && (
        <Button variant="secondary" className={size} loading={pending} disabled={pending} onClick={handleFinalize}>
          Finalize Now
        </Button>
      )}
      {finalizeWaitingOnWindow && (
        <Button variant="secondary" className={size} disabled title="Opens once the contest window closes">
          Finalize (window open)
        </Button>
      )}
      {canClaimExpiredBond && (
        <Button
          variant="secondary"
          className={size}
          loading={pending}
          disabled={pending}
          onClick={handleClaimExpiredBond}
        >
          Claim Expired Bond
        </Button>
      )}
      {canRevoke && (
        <Button
          variant={hasConflictingActions ? 'danger' : 'secondary'}
          className={size}
          loading={pending}
          disabled={pending}
          onClick={handleRevoke}
        >
          Revoke Claim
        </Button>
      )}
      {canRenew && (
        <Button
          variant="secondary"
          className={size}
          onClick={(e) => {
            e.stopPropagation();
            setShowRenewForm((v) => !v);
          }}
        >
          {showRenewForm ? 'Cancel Renewal' : 'Renew Claim'}
        </Button>
      )}
      {actionState.status === 'error' && (
        <p className="w-full text-body-sm text-status-error">{actionState.message}</p>
      )}
      {showRenewForm && (
        <div className="w-full" onClick={(e) => e.stopPropagation()}>
          <RenewClaimForm claimId={claimId} onDone={() => setShowRenewForm(false)} />
        </div>
      )}
    </div>
  );
}
