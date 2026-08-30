'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useQuery, useQueries } from '@tanstack/react-query';
import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';
import { ContractNotConfiguredNotice } from '@/components/DesignSystem/ContractNotConfiguredNotice';
import { StatusBadge } from '@/components/DesignSystem/StatusBadge';
import { MonoData } from '@/components/DesignSystem/MonoData';
import { Button } from '@/components/DesignSystem/Button';
import { ClaimActionButtons } from '@/components/features/claims/ClaimActionButtons';
import { isContractConfigured } from '@/lib/env';
import { getClaimIdsByWallet } from '@/lib/apiClient';
import { getClaim } from '@/lib/genlayerClient';
import { formatGen, type ClaimRecord } from '@nexuskey/shared';

export default function ClaimantDashboardPage() {
  const { isConnected, address } = useAccount();

  // The backend index is used only to discover which claim IDs belong to
  // this wallet -- fast, but not authoritative. Every claim's actual
  // displayed content below comes from a direct, live contract read (see
  // claimQueries), never from the backend's own copy of the fields,
  // which uses different column names and doesn't store everything
  // ClaimRecord needs (see apiClient.ts).
  const idsQuery = useQuery({
    queryKey: ['claim-ids-by-wallet', address],
    queryFn: () => getClaimIdsByWallet(address as string),
    enabled: Boolean(address) && isContractConfigured,
    retry: false,
  });

  const claimQueries = useQueries({
    queries: (idsQuery.data ?? []).map((claimId) => ({
      queryKey: ['claim', claimId],
      queryFn: () => getClaim(claimId),
      enabled: isContractConfigured,
      retry: false,
    })),
  });

  const claims: { claimId: string; claim: ClaimRecord }[] = (idsQuery.data ?? [])
    .map((claimId, i) => ({ claimId, claim: claimQueries[i]?.data }))
    .filter((entry): entry is { claimId: string; claim: ClaimRecord } => Boolean(entry.claim));

  const claimsLoading = idsQuery.isLoading || claimQueries.some((q) => q.isLoading);

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-container-max px-margin-mobile pb-20 pt-32 md:px-margin-desktop">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="mb-2 block text-label-caps font-label-caps uppercase text-surface-tint">
              Identity Registry
            </span>
            <h1 className="font-display text-display text-white">Claimant Dashboard</h1>
            <p className="mt-4 max-w-2xl text-body-lg text-on-surface-variant">
              Manage your bonded property claims and monitor verification status.
            </p>
          </div>
          <Link href="/claim/new">
            <Button>File a New Claim</Button>
          </Link>
        </div>

        {!isConnected ? (
          <EmptyPanel
            title="Connect your wallet"
            body="Connect the wallet you use to file claims to see your dashboard."
          />
        ) : !isContractConfigured ? (
          <ContractNotConfiguredNotice action="loading your claims" />
        ) : claimsLoading ? (
          <div className="rounded-xl border border-border-subtle p-16 text-center text-on-surface-variant">
            Loading your claims…
          </div>
        ) : idsQuery.isError ? (
          <EmptyPanel
            title="Couldn't load your claims"
            body="The registry index is temporarily unavailable. Try again shortly."
          />
        ) : claims.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {claims.map(({ claimId, claim }) => (
              <div
                key={claimId}
                className="rounded-xl border border-border-subtle bg-surface-card p-6 transition-all hover:border-surface-tint/50"
              >
                <Link href={`/claim/${claimId}`} className="block">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <MonoData tone="muted" className="mb-1 block">
                        KH-{claimId}
                      </MonoData>
                      <h3 className="font-headline-md text-headline-md text-white">{claim.street_address}</h3>
                      <p className="text-body-md text-on-surface-variant">
                        {claim.city}, {claim.state_or_region}
                      </p>
                    </div>
                    <StatusBadge status={claim.status} />
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    Bond: <MonoData tone="accent">{formatGen(claim.bond_deposited)}</MonoData> deposited
                  </p>
                </Link>
                <ClaimActionButtons claim={claim} claimId={claimId} compact />
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel
            title="No claims yet"
            body="File your first Rental Authority Claim to see it tracked here."
            action={
              <Link href="/claim/new">
                <Button variant="secondary">File a Claim</Button>
              </Link>
            }
          />
        )}
      </main>
      <Footer />
    </>
  );
}

function EmptyPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-outline-variant p-16 text-center">
      <h3 className="font-headline-md text-headline-md text-white">{title}</h3>
      <p className="max-w-md text-body-md text-on-surface-variant">{body}</p>
      {action}
    </div>
  );
}
