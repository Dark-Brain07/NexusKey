'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';
import { PropertySearchBar } from '@/components/features/verify/PropertySearchBar';
import { StatusBadge } from '@/components/DesignSystem/StatusBadge';
import { MonoData } from '@/components/DesignSystem/MonoData';
import { Pagination } from '@/components/DesignSystem/Pagination';
import { searchProperties } from '@/lib/apiClient';
import Link from 'next/link';

const PAGE_SIZE = 12;

function VerifyResults() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const city = params.get('city') ?? '';
  const stateOrRegion = params.get('stateOrRegion') ?? '';
  const hasSearch = Boolean(q || city || stateOrRegion);
  const [page, setPage] = useState(1);

  // A new search (different address/city/state) should always land on
  // page 1 -- otherwise switching searches while on page 3 of the old
  // one would silently request an out-of-range page of the new one.
  useEffect(() => {
    setPage(1);
  }, [q, city, stateOrRegion]);

  // The registry search is a partial-match lookup against the backend
  // index (street address / display address ILIKE, city and state exact)
  // -- not an exact canonical property-key match. Requiring an exact key
  // meant a single typo, unit-string mismatch, or blank state field made
  // real, correctly-filed claims unfindable (the state field used to be
  // hardcoded blank here, which broke every search). Fuzzy search lets a
  // user find a property from partial info and then confirm the exact
  // one from a short list.
  const query = useQuery({
    queryKey: ['property-search', q, city, stateOrRegion, page],
    queryFn: () =>
      searchProperties({
        q: q || undefined,
        city: city || undefined,
        stateOrRegion: stateOrRegion || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: hasSearch,
    retry: false,
  });
  const results = query.data?.data ?? [];

  return (
    <main className="mx-auto max-w-container-max px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
      <div className="mb-12">
        <span className="mb-2 block text-label-caps font-label-caps uppercase text-surface-tint">
          Identity Registry
        </span>
        <h1 className="mb-4 font-display text-display text-white">Verify a Property</h1>
        <p className="max-w-2xl text-body-lg text-on-surface-variant">
          Search the bonded registry before you send money, pay a deposit, or trust a listing. A
          partial street address is enough — you don&apos;t need the exact unit or state.
        </p>
      </div>

      <PropertySearchBar />

      <div className="mt-12">
        {!hasSearch ? (
          <EmptyState
            title="Enter a street address to begin"
            body="A few characters of the street address is enough. Add a city or state to narrow results."
          />
        ) : query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <EmptyState title="Lookup failed" body="Something went wrong reaching the registry. Try again." />
        ) : results.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {results.map((property) => (
              <Link
                key={property.property_key}
                href={`/verify/${property.property_key}`}
                className="block rounded-xl border border-border-subtle bg-surface-card p-6 transition-all hover:border-surface-tint/50"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <MonoData tone="muted" className="mb-1 block">
                      {property.property_key.slice(0, 16)}…
                    </MonoData>
                    <h3 className="font-headline-md text-headline-md text-white">
                      {property.display_address ?? 'Address on file'}
                    </h3>
                    <p className="text-body-md text-on-surface-variant">
                      {property.city}, {property.state_or_region}
                    </p>
                  </div>
                  <StatusBadge status={property.latest_claim_status ?? 'NOT_FOUND'} />
                </div>
                <p className="text-body-sm text-on-surface-variant">
                  {property.active_claim_count > 0
                    ? `${property.active_claim_count} active claim${property.active_claim_count === 1 ? '' : 's'} on file`
                    : property.latest_claim_status
                      ? 'No active claims — see full history'
                      : 'No claims on file'}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            status="NOT_FOUND"
            title="No matching properties found"
            body="Try a shorter or different fragment of the street address, or search by city/state alone. Absence of a claim is not itself a warning sign — but proceed with your own due diligence."
          />
        )}
        {query.data && (
          <Pagination
            page={page}
            pageSize={query.data.pagination.pageSize}
            total={query.data.pagination.total}
            onPageChange={setPage}
          />
        )}
      </div>
    </main>
  );
}

function EmptyState({ title, body, status }: { title: string; body: string; status?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-outline-variant p-16 text-center">
      {status && <StatusBadge status={status} />}
      <h3 className="font-headline-md text-headline-md text-white">{title}</h3>
      <p className="max-w-md text-body-md text-on-surface-variant">{body}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border-subtle p-16 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-tint border-t-transparent" />
      <p className="text-body-md text-on-surface-variant">Searching the registry…</p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <>
      <TopNav />
      <Suspense fallback={<LoadingState />}>
        <VerifyResults />
      </Suspense>
      <Footer />
    </>
  );
}
