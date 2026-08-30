'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';
import { StatusBadge } from '@/components/DesignSystem/StatusBadge';
import { MonoData } from '@/components/DesignSystem/MonoData';
import { ContractNotConfiguredNotice } from '@/components/DesignSystem/ContractNotConfiguredNotice';
import { getClaimsByPropertyKey, ContractNotConfiguredError } from '@/lib/genlayerClient';
import { TERMINAL_CLAIM_STATUSES, type ClaimRecord } from '@nexuskey/shared';

export default function PropertyClaimsPage({ params }: { params: { propertyKey: string } }) {
  // Full claim history, not just currently-active claims -- a rejected
  // or revoked claim on this property is exactly the kind of thing
  // someone checking a listing should see (e.g. "this address had a
  // rejected claim before"), not have silently disappear. The old
  // active-only version made a property with only a rejected claim on
  // it look completely empty/never-claimed, which is misleading.
  const query = useQuery({
    queryKey: ['claims-by-property', params.propertyKey],
    queryFn: () => getClaimsByPropertyKey(params.propertyKey),
    retry: false,
  });

  const notConfigured = query.error instanceof ContractNotConfiguredError;
  const claims = query.data ?? [];
  const activeClaims = claims.filter((c) => !TERMINAL_CLAIM_STATUSES.includes(c.status));
  const historicalClaims = claims.filter((c) => TERMINAL_CLAIM_STATUSES.includes(c.status));

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-container-max px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <div className="mb-12 flex items-center gap-2 font-mono-data text-mono-data text-on-surface-variant">
          <Link href="/verify" className="hover:text-surface-tint">
            Registry
          </Link>
          <span>/</span>
          <span className="text-surface-tint">{params.propertyKey.slice(0, 16)}…</span>
        </div>

        {notConfigured ? (
          <ContractNotConfiguredNotice action="viewing live claim details" />
        ) : query.isLoading ? (
          <div className="rounded-xl border border-border-subtle p-16 text-center text-on-surface-variant">
            Loading claims…
          </div>
        ) : query.isError ? (
          <div className="rounded-xl border border-dashed border-outline-variant p-16 text-center">
            <h3 className="font-headline-md text-headline-md text-white">Lookup failed</h3>
            <p className="mt-2 text-body-md text-on-surface-variant">
              Something went wrong reaching the registry. Try again.
            </p>
          </div>
        ) : claims.length > 0 ? (
          <div className="space-y-10">
            {activeClaims.length > 0 && (
              <section>
                <h2 className="mb-4 text-label-caps font-label-caps uppercase text-on-surface-variant">
                  Active
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {activeClaims.map((claim) => (
                    <ClaimCard key={claim.claim_id} claim={claim} />
                  ))}
                </div>
              </section>
            )}
            {historicalClaims.length > 0 && (
              <section>
                <h2 className="mb-4 text-label-caps font-label-caps uppercase text-on-surface-variant">
                  Claim History
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {historicalClaims.map((claim) => (
                    <ClaimCard key={claim.claim_id} claim={claim} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-outline-variant p-16 text-center">
            <StatusBadge status="NOT_FOUND" />
            <h3 className="font-headline-md text-headline-md text-white">No claims for this property</h3>
            <p className="max-w-md text-body-md text-on-surface-variant">
              This property has no registered Rental Authority Claim. Absence of a claim is not
              itself a warning sign — but proceed with your own due diligence.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function ClaimCard({ claim }: { claim: ClaimRecord }) {
  return (
    <Link
      href={`/claim/${claim.claim_id}`}
      className="block rounded-xl border border-border-subtle bg-surface-card p-6 transition-all hover:border-surface-tint/50"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <MonoData tone="muted" className="mb-1 block">
            REG-ID: KH-{claim.claim_id}
          </MonoData>
          <h3 className="font-headline-md text-headline-md text-white">{claim.street_address}</h3>
          <p className="text-body-md text-on-surface-variant">
            {claim.city}, {claim.state_or_region}
          </p>
        </div>
        <StatusBadge status={claim.status} />
      </div>
      <p className="text-body-sm text-on-surface-variant">
        Claimed by {claim.claimant_name} — {claim.authority_type.replaceAll('_', ' ').toLowerCase()}
      </p>
    </Link>
  );
}
