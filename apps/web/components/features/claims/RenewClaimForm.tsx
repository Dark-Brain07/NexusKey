'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { Button } from '@/components/DesignSystem/Button';
import { renewPropertyClaim } from '@/lib/genlayerClient';
import { PROTOCOL_DEFAULTS, evidenceUrlSchema } from '@NexusKey/shared';
import type { Address } from 'genlayer-js/types';

/**
 * Renewal only asks for evidence/listing fields -- property, claimant
 * name, and authority type carry over from the original claim on-chain
 * (contract.py's renew_property_claim reuses them), so re-collecting
 * them here would be redundant and risks the renewal drifting from the
 * property it's actually renewing. Shared by the claim details page and
 * every dashboard card's action panel.
 */
export function RenewClaimForm({ claimId, onDone }: { claimId: string; onDone: () => void }) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [listingTitle, setListingTitle] = useState('');
  const [listingDescription, setListingDescription] = useState('');
  const [state, setState] = useState<{
    status: 'idle' | 'pending';
    error?: string;
    newClaimId?: string;
    pendingTx?: `0x${string}`;
  }>({
    status: 'idle',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    const parsed = evidenceUrlSchema.safeParse(evidenceUrl);
    if (!parsed.success) {
      setState({ status: 'idle', error: parsed.error.issues[0]?.message ?? 'Invalid evidence URL.' });
      return;
    }
    if (listingTitle.trim().length < 3 || listingDescription.trim().length < 10) {
      setState({ status: 'idle', error: 'Listing title and description are required.' });
      return;
    }
    setState({ status: 'pending' });
    try {
      const provider = (window as unknown as { ethereum?: unknown }).ethereum;
      // newClaimId comes from the write call's decoded return value, not a
      // re-read of the global total_claims counter -- that read is racy
      // under concurrent filers and can pick up someone else's claim ID.
      //
      // renew_property_claim only files the renewal -- like any fresh
      // claim, it still needs its own separate resolve_property_claim
      // call (permissionless, triggered from the new claim's own page).
      // This deliberately does NOT chain that call inline: it's a slow,
      // consensus-based nondet round, and chaining it here means a slow
      // or failed resolution reports "Renewal failed" even when the
      // bonded renewal filing itself succeeded -- the exact failure mode
      // already removed from the ordinary claim/challenge filing flows.
      const { claimId: newClaimId, hash } = await renewPropertyClaim(
        provider,
        address as Address,
        claimId,
        evidenceUrl,
        listingTitle,
        listingDescription,
        PROTOCOL_DEFAULTS.CLAIM_BOND_MINIMUM_GEN,
      );
      await queryClient.invalidateQueries({ queryKey: ['claim', claimId] });
      await queryClient.invalidateQueries({ queryKey: ['claims-by-wallet', address] });
      setState({ status: 'idle', newClaimId, pendingTx: hash });
    } catch (err) {
      setState({ status: 'idle', error: err instanceof Error ? err.message : 'Renewal failed.' });
    }
  }

  if (state.newClaimId) {
    return (
      <div className="border border-status-verified/20 bg-status-verified/5 p-6">
        <p className="text-body-sm text-status-verified">
          Renewed as{' '}
          <Link
            href={`/claim/${state.newClaimId}${state.pendingTx ? `?pendingTx=${state.pendingTx}` : ''}`}
            className="underline"
          >
            claim KH-{state.newClaimId}
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border border-border-subtle bg-surface-card p-6">
      <span className="block text-label-caps font-label-caps uppercase text-on-surface-variant">
        Renew Claim — {PROTOCOL_DEFAULTS.CLAIM_BOND_MINIMUM_GEN} GEN bond required
      </span>
      <div className="space-y-2">
        <label className="block text-label-caps font-label-caps uppercase text-on-surface-variant">
          Evidence URL
        </label>
        <input
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="https://"
          className="w-full border-0 border-b border-border-subtle bg-surface-container-lowest py-3 text-body-md text-primary placeholder:text-on-surface-variant/30 focus:border-surface-tint focus:outline-none"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-label-caps font-label-caps uppercase text-on-surface-variant">
          Listing Title
        </label>
        <input
          value={listingTitle}
          onChange={(e) => setListingTitle(e.target.value)}
          className="w-full border-0 border-b border-border-subtle bg-surface-container-lowest py-3 text-body-md text-primary focus:border-surface-tint focus:outline-none"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-label-caps font-label-caps uppercase text-on-surface-variant">
          Listing Description
        </label>
        <textarea
          value={listingDescription}
          onChange={(e) => setListingDescription(e.target.value)}
          rows={3}
          className="w-full border-0 border-b border-border-subtle bg-surface-container-lowest py-3 text-body-md text-primary focus:border-surface-tint focus:outline-none"
        />
      </div>
      {state.error && <p className="text-body-sm text-status-error">{state.error}</p>}
      <div className="flex gap-3">
        <Button type="submit" loading={state.status === 'pending'} disabled={state.status === 'pending'}>
          Submit Renewal
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
