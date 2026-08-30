'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';
import { ContractNotConfiguredNotice } from '@/components/DesignSystem/ContractNotConfiguredNotice';
import { StatusBadge } from '@/components/DesignSystem/StatusBadge';
import { MonoData } from '@/components/DesignSystem/MonoData';
import { Button } from '@/components/DesignSystem/Button';
import { isContractConfigured } from '@/lib/env';
import { getChallengeIdsByWallet } from '@/lib/apiClient';
import { getChallenge, resolvePropertyChallenge } from '@/lib/genlayerClient';
import { CHALLENGE_REASON_LABELS, formatGen, type ChallengeReason, type ChallengeRecord } from '@NexusKey/shared';
import type { Address } from 'genlayer-js/types';

export default function ChallengerDashboardPage() {
  const { isConnected, address } = useAccount();

  // Same pattern as the claimant dashboard: the backend index only tells
  // us which challenge IDs belong to this wallet -- actual content is
  // always a live contract read, since the backend row shape doesn't
  // match ChallengeRecord (different column names, no bond_deposited).
  const idsQuery = useQuery({
    queryKey: ['challenge-ids-by-wallet', address],
    queryFn: () => getChallengeIdsByWallet(address as string),
    enabled: Boolean(address) && isContractConfigured,
    retry: false,
  });

  const challengeQueries = useQueries({
    queries: (idsQuery.data ?? []).map((challengeId) => ({
      queryKey: ['challenge', challengeId],
      queryFn: () => getChallenge(challengeId),
      enabled: isContractConfigured,
      retry: false,
    })),
  });

  const challenges: { challengeId: string; challenge: ChallengeRecord }[] = (idsQuery.data ?? [])
    .map((challengeId, i) => ({ challengeId, challenge: challengeQueries[i]?.data }))
    .filter((entry): entry is { challengeId: string; challenge: ChallengeRecord } => Boolean(entry.challenge));

  const loading = idsQuery.isLoading || challengeQueries.some((q) => q.isLoading);

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-container-max px-margin-mobile pb-20 pt-32 md:px-margin-desktop">
        <div className="mb-12">
          <span className="mb-2 block text-label-caps font-label-caps uppercase text-status-error">
            Dispute Resolution
          </span>
          <h1 className="font-display text-display text-white">Challenger Dashboard</h1>
          <p className="mt-4 max-w-2xl text-body-lg text-on-surface-variant">
            Track challenges you&apos;ve filed, their bond status, and resolution outcomes.
          </p>
        </div>

        {!isConnected ? (
          <EmptyPanel title="Connect your wallet" body="Connect the wallet you use to file challenges to see this dashboard." />
        ) : !isContractConfigured ? (
          <ContractNotConfiguredNotice action="loading your challenges" />
        ) : loading ? (
          <div className="rounded-xl border border-border-subtle p-16 text-center text-on-surface-variant">
            Loading your challenges…
          </div>
        ) : idsQuery.isError ? (
          <EmptyPanel
            title="Couldn't load your challenges"
            body="The registry index is temporarily unavailable. Try again shortly."
          />
        ) : challenges.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {challenges.map(({ challengeId, challenge }) => (
              <ChallengeCard key={challengeId} challengeId={challengeId} challenge={challenge} />
            ))}
          </div>
        ) : (
          <EmptyPanel
            title="No challenges yet"
            body="Search the registry to find a claim you believe is invalid."
            action={
              <Link href="/verify">
                <Button variant="secondary">Search the Registry</Button>
              </Link>
            }
          />
        )}
      </main>
      <Footer />
    </>
  );
}

function ChallengeCard({ challengeId, challenge }: { challengeId: string; challenge: ChallengeRecord }) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ status: 'idle' | 'pending'; error?: string }>({ status: 'idle' });

  async function handleResolve() {
    if (!address) return;
    setState({ status: 'pending' });
    try {
      const provider = (window as unknown as { ethereum?: unknown }).ethereum;
      await resolvePropertyChallenge(provider, address as Address, challengeId);
      await queryClient.invalidateQueries({ queryKey: ['challenge', challengeId] });
      await queryClient.invalidateQueries({ queryKey: ['challenges-by-wallet', address] });
      setState({ status: 'idle' });
    } catch (err) {
      setState({ status: 'idle', error: err instanceof Error ? err.message : 'Resolution failed.' });
    }
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-card p-6 transition-all hover:border-status-error/50">
      <Link href={`/challenge/${challengeId}`} className="block">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <MonoData tone="muted" className="mb-1 block">
              Challenge #{challengeId} on KH-{challenge.claim_id}
            </MonoData>
            <h3 className="font-headline-md text-headline-md text-white">
              {CHALLENGE_REASON_LABELS[challenge.reason as ChallengeReason] ?? challenge.reason}
            </h3>
          </div>
          <StatusBadge status={challenge.status} />
        </div>
        <p className="text-body-sm text-on-surface-variant">
          Bond: <MonoData tone="accent">{formatGen(challenge.bond_deposited)}</MonoData> deposited
        </p>
      </Link>
      {challenge.status === 'PENDING' && (
        <div className="mt-3">
          <Button
            variant="secondary"
            className="text-body-sm"
            loading={state.status === 'pending'}
            disabled={state.status === 'pending'}
            onClick={handleResolve}
          >
            Resolve Now
          </Button>
          {state.error && <p className="mt-2 text-body-sm text-status-error">{state.error}</p>}
        </div>
      )}
    </div>
  );
}

function EmptyPanel({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-outline-variant p-16 text-center">
      <h3 className="font-headline-md text-headline-md text-white">{title}</h3>
      <p className="max-w-md text-body-md text-on-surface-variant">{body}</p>
      {action}
    </div>
  );
}
