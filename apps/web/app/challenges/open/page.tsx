'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';
import { StatusBadge } from '@/components/DesignSystem/StatusBadge';
import { MonoData } from '@/components/DesignSystem/MonoData';
import { Pagination } from '@/components/DesignSystem/Pagination';
import { getChallengeableClaims } from '@/lib/apiClient';
import { AUTHORITY_TYPE_LABELS, type AuthorityType } from '@nexuskey/shared';

/**
 * Browse-for-disputes discovery page: every claim currently open to a
 * challenge (VERIFIED-and-still-valid, or CONTEST_WINDOW, with no
 * already-open challenge -- the same eligibility contract.py's
 * challenge_property_claim itself enforces). Before this page existed,
 * the only way to find a claim worth challenging was to already know
 * its address (via /verify) or its direct URL -- there was no way to
 * just look for disputes. This is a backend-index read for discovery
 * only; the claim's own page still re-reads live contract state before
 * anyone can actually file.
 */
export default function OpenChallengesPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['challengeable-claims', page],
    queryFn: () => getChallengeableClaims(page),
    retry: false,
  });
  const claims = query.data?.data ?? [];

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-container-max px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <div className="mb-12">
          <span className="mb-2 block text-label-caps font-label-caps uppercase text-status-error">
            Dispute Resolution
          </span>
          <h1 className="mb-4 font-display text-display text-white">Claims Open to Challenge</h1>
          <p className="max-w-2xl text-body-lg text-on-surface-variant">
            Every claim currently eligible for a challenge — verified (and still valid) or in its
            contest window, with no dispute already open. Browse here if you believe a listing is
            misrepresented, even if you don&apos;t already know its exact address.
          </p>
        </div>

        {query.isLoading ? (
          <div className="rounded-xl border border-border-subtle p-16 text-center text-on-surface-variant">
            Loading open claims…
          </div>
        ) : query.isError ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-outline-variant p-16 text-center">
            <h3 className="font-headline-md text-headline-md text-white">Couldn&apos;t load the list</h3>
            <p className="max-w-md text-body-md text-on-surface-variant">
              The registry index is temporarily unavailable. Try again shortly.
            </p>
          </div>
        ) : claims.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {claims.map((claim) => (
              <Link
                key={claim.claim_id}
                href={`/claim/${claim.claim_id}`}
                className="block rounded-xl border border-border-subtle bg-surface-card p-6 transition-all hover:border-status-error/50"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <MonoData tone="muted" className="mb-1 block">
                      KH-{claim.claim_id}
                    </MonoData>
                    <h3 className="font-headline-md text-headline-md text-white">
                      {claim.display_address ?? 'Address on file'}
                    </h3>
                    <p className="text-body-md text-on-surface-variant">
                      {claim.city}, {claim.state_or_region}
                    </p>
                  </div>
                  <StatusBadge status={claim.status} />
                </div>
                <p className="text-body-sm text-on-surface-variant">
                  Claimed by {claim.claimant_name} —{' '}
                  {AUTHORITY_TYPE_LABELS[claim.authority_type as AuthorityType] ?? claim.authority_type}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-outline-variant p-16 text-center">
            <StatusBadge status="NOT_FOUND" />
            <h3 className="font-headline-md text-headline-md text-white">No claims are open to challenge right now</h3>
            <p className="max-w-md text-body-md text-on-surface-variant">
              Check back later, or search a specific address on the{' '}
              <Link href="/verify" className="underline">
                Verify a Property
              </Link>{' '}
              page.
            </p>
          </div>
        )}
        {query.data && (
          <Pagination
            page={page}
            pageSize={query.data.pagination.pageSize}
            total={query.data.pagination.total}
            onPageChange={setPage}
          />
        )}
      </main>
      <Footer />
    </>
  );
}
