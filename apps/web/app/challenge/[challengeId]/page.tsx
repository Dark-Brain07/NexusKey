'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';
import { StatusBadge } from '@/components/DesignSystem/StatusBadge';
import { MonoData } from '@/components/DesignSystem/MonoData';
import { ContractNotConfiguredNotice } from '@/components/DesignSystem/ContractNotConfiguredNotice';
import { ProvisionalTxBanner } from '@/components/DesignSystem/ProvisionalTxBanner';
import { Button } from '@/components/DesignSystem/Button';
import { getChallenge, resolvePropertyChallenge, ContractNotConfiguredError } from '@/lib/genlayerClient';
import { isContractConfigured } from '@/lib/env';
import { CHALLENGE_REASON_LABELS, formatGen, type ChallengeReason, type ChallengeRecord } from '@nexuskey/shared';
import type { Address } from 'genlayer-js/types';

const RESOLUTION_LABELS: Record<string, string> = {
  CLAIMANT_AUTHORIZED: 'Claimant Authorized',
  CHALLENGER_CORRECT: 'Challenger Correct',
  UNCERTAIN: 'Uncertain — No Penalty',
};

export default function ChallengeDetailsPage({ params }: { params: { challengeId: string } }) {
  const searchParams = useSearchParams();
  const pendingTx = searchParams.get('pendingTx');

  const query = useQuery({
    queryKey: ['challenge', params.challengeId],
    queryFn: () => getChallenge(params.challengeId),
    retry: false,
  });

  const notConfigured = query.error instanceof ContractNotConfiguredError;

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <div className="mb-12 flex items-center gap-2 font-mono-data text-mono-data text-on-surface-variant">
          <Link href="/dashboard/challenges" className="hover:text-surface-tint">
            Challenges
          </Link>
          <span>/</span>
          <span className="text-status-error">#{params.challengeId}</span>
        </div>

        {pendingTx && /^0x[a-fA-F0-9]+$/.test(pendingTx) && (
          <ProvisionalTxBanner hash={pendingTx as `0x${string}`} />
        )}

        {notConfigured ? (
          <ContractNotConfiguredNotice action="viewing live challenge details" />
        ) : query.isLoading ? (
          <div className="rounded-xl border border-border-subtle p-16 text-center text-on-surface-variant">
            Loading challenge…
          </div>
        ) : query.isError || !query.data ? (
          <div className="rounded-xl border border-dashed border-outline-variant p-16 text-center">
            <StatusBadge status="NOT_FOUND" />
            <h3 className="mt-4 font-headline-md text-headline-md text-white">Challenge not found</h3>
            <p className="mt-2 text-body-md text-on-surface-variant">
              No challenge exists with identifier #{params.challengeId}.
            </p>
          </div>
        ) : (
          <ChallengeDetail challenge={query.data} challengeId={params.challengeId} />
        )}
      </main>
      <Footer />
    </>
  );
}

function ChallengeDetail({ challenge, challengeId }: { challenge: ChallengeRecord; challengeId: string }) {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ status: 'idle' | 'pending'; error?: string }>({ status: 'idle' });

  async function handleResolve() {
    if (!address) return;
    setState({ status: 'pending' });
    try {
      const provider = (window as unknown as { ethereum?: unknown }).ethereum;
      await resolvePropertyChallenge(provider, address as Address, challengeId);
      await queryClient.invalidateQueries({ queryKey: ['challenge', challengeId] });
      setState({ status: 'idle' });
    } catch (err) {
      setState({ status: 'idle', error: err instanceof Error ? err.message : 'Resolution failed.' });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <StatusBadge status={challenge.status} className="!px-4 !py-2 !text-body-md" />
          {challenge.resolution && (
            <span className="rounded-full bg-surface-container-high px-3 py-1 text-label-caps font-label-caps uppercase text-on-surface-variant">
              {RESOLUTION_LABELS[challenge.resolution] ?? challenge.resolution}
            </span>
          )}
        </div>
        <h1 className="mb-2 font-headline-lg text-headline-lg text-primary">
          Challenge #{challengeId} — {CHALLENGE_REASON_LABELS[challenge.reason as ChallengeReason] ?? challenge.reason}
        </h1>
        <Link href={`/claim/${challenge.claim_id}`} className="text-body-md text-surface-tint hover:underline">
          View claim KH-{challenge.claim_id} →
        </Link>
      </div>

      {challenge.status === 'PENDING' && (
        <div className="rounded-lg border border-status-warning/20 bg-status-warning/5 p-6">
          <p className="mb-4 text-body-sm text-status-warning">
            This challenge hasn&apos;t been resolved yet — GenLayer validator consensus hasn&apos;t
            judged the claim&apos;s evidence against the challenger&apos;s evidence. Resolution is
            permissionless: anyone can trigger it, not just the claimant or challenger.
          </p>
          {isContractConfigured && isConnected ? (
            <Button variant="danger" loading={state.status === 'pending'} disabled={state.status === 'pending'} onClick={handleResolve}>
              Resolve Challenge
            </Button>
          ) : (
            <p className="text-body-sm text-on-surface-variant">Connect a wallet to resolve it.</p>
          )}
          {state.error && <p className="mt-2 text-body-sm text-status-error">{state.error}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="border border-border-subtle bg-surface-card p-6">
          <span className="mb-3 block text-label-caps font-label-caps uppercase text-on-surface-variant">
            Challenger
          </span>
          <MonoData tone="accent">{challenge.challenger}</MonoData>
        </div>
        <div className="border border-border-subtle bg-surface-card p-6">
          <span className="mb-3 block text-label-caps font-label-caps uppercase text-on-surface-variant">
            Bond
          </span>
          <MonoData>{formatGen(challenge.bond_deposited)} deposited</MonoData>
        </div>
      </div>

      <div className="border border-border-subtle bg-surface-card p-6">
        <span className="mb-3 block text-label-caps font-label-caps uppercase text-on-surface-variant">
          Evidence
        </span>
        <a
          href={challenge.evidence_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-center justify-between gap-3 border border-border-subtle bg-surface-container-lowest p-4 text-body-sm text-primary hover:bg-surface-container-low"
        >
          <span className="truncate">{challenge.evidence_url}</span>
          <span className="flex-shrink-0 text-status-error">↗</span>
        </a>
        {challenge.supporting_info && (
          <p className="mt-4 text-body-md text-on-surface-variant">{challenge.supporting_info}</p>
        )}
      </div>
    </div>
  );
}
