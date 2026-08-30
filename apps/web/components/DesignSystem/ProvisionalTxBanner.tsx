'use client';

import { useEffect, useState } from 'react';
import { waitForTransactionFinalization } from '@/lib/genlayerClient';

type State = 'waiting' | 'finalized' | 'error';

/**
 * GenLayer's ACCEPTED status is not final -- the transaction stays
 * appealable until it reaches FINALIZED. filePropertyClaim/
 * challengePropertyClaim/renewPropertyClaim redirect here as soon as
 * ACCEPTED so filing doesn't feel hung on the appeal window, but this
 * banner makes that provisional state visible instead of silently
 * presenting an appealable filing as fully settled, and clears itself
 * once finalization actually completes.
 */
export function ProvisionalTxBanner({ hash }: { hash: `0x${string}` }) {
  const [state, setState] = useState<State>('waiting');

  useEffect(() => {
    let cancelled = false;
    waitForTransactionFinalization(hash)
      .then(() => {
        if (!cancelled) setState('finalized');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [hash]);

  if (state === 'finalized') return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-status-warning/30 bg-status-warning/5 p-4">
      <div className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-status-warning" aria-hidden="true" />
      <p className="text-body-sm text-on-surface-variant">
        {state === 'waiting' ? (
          <>
            This transaction has been <strong className="text-status-warning">accepted</strong> but is not yet{' '}
            <strong className="text-status-warning">finalized</strong> on GenLayer -- it remains appealable until
            finalization completes. The details below may still change.
          </>
        ) : (
          <>
            Could not confirm on-chain finalization status for this transaction. It was accepted but may still be
            appealable -- verify its status before relying on the details below.
          </>
        )}
      </p>
    </div>
  );
}
