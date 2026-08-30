'use client';

import { useQuery } from '@tanstack/react-query';
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
import { ClaimActionButtons } from '@/components/features/claims/ClaimActionButtons';
import { getClaim, ContractNotConfiguredError } from '@/lib/genlayerClient';
import {
  AUTHORITY_TYPE_LABELS,
  EVIDENCE_RESULT_LABELS,
  CONFLICT_RESULT_LABELS,
  type AuthorityType,
  type ClaimRecord,
} from '@nexuskey/shared';

export default function ClaimDetailsPage({ params }: { params: { claimId: string } }) {
  const searchParams = useSearchParams();
  const pendingTx = searchParams.get('pendingTx');

  const query = useQuery({
    queryKey: ['claim', params.claimId],
    queryFn: () => getClaim(params.claimId),
    retry: false,
  });

  const notConfigured = query.error instanceof ContractNotConfiguredError;

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-container-max px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <div className="mb-12 flex items-center gap-2 font-mono-data text-mono-data text-on-surface-variant">
          <Link href="/verify" className="hover:text-surface-tint">
            Registry
          </Link>
          <span>/</span>
          <span className="text-surface-tint">KH-{params.claimId}</span>
        </div>

        {pendingTx && /^0x[a-fA-F0-9]+$/.test(pendingTx) && (
          <ProvisionalTxBanner hash={pendingTx as `0x${string}`} />
        )}

        {notConfigured ? (
          <ContractNotConfiguredNotice action="viewing live claim details" />
        ) : query.isLoading ? (
          <div className="rounded-xl border border-border-subtle p-16 text-center text-on-surface-variant">
            Loading claim…
          </div>
        ) : query.isError || !query.data ? (
          <div className="rounded-xl border border-dashed border-outline-variant p-16 text-center">
            <StatusBadge status="NOT_FOUND" />
            <h3 className="mt-4 font-headline-md text-headline-md text-white">Claim not found</h3>
            <p className="mt-2 text-body-md text-on-surface-variant">
              No claim exists with identifier KH-{params.claimId}.
            </p>
          </div>
        ) : (
          <ClaimDetail claim={query.data} claimId={params.claimId} />
        )}
      </main>
      <Footer />
    </>
  );
}

function ClaimDetail({ claim, claimId }: { claim: ClaimRecord; claimId: string }) {
  const { address } = useAccount();
  // Mirrors the contract's own eligibility rules (challenge_property_claim
  // in contract.py): only VERIFIED/CONTEST_WINDOW claims are challengeable,
  // a claim already under an open challenge can't take a second one, and a
  // claimant can never challenge their own claim. The button used to render
  // unconditionally regardless of any of this -- a real loophole where a
  // wallet could click through to the challenge form and only find out it
  // was rejected after signing a transaction and posting a bond.
  const isClaimant = Boolean(address) && address?.toLowerCase() === claim.claimant.toLowerCase();
  const isChallengeableStatus =
    claim.status === 'CONTEST_WINDOW' || (claim.status === 'VERIFIED' && claim.is_currently_verified);
  const canChallenge = isChallengeableStatus && !claim.has_open_challenge && !isClaimant;

  return (
    <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
      <div className="relative overflow-hidden border border-border-subtle bg-surface-card p-8 verified-glow md:col-span-8">
        <div className="mb-6 flex items-center gap-3">
          <StatusBadge status={claim.status} className="!px-4 !py-2 !text-body-md" />
        </div>

        {(claim.status === 'PENDING' ||
          claim.status === 'CONTEST_WINDOW' ||
          claim.status === 'REJECTED' ||
          claim.status === 'EXPIRED' ||
          claim.status === 'REVOKED' ||
          !claim.is_currently_verified) && (
          <div className="mb-6 rounded-lg border border-status-warning/20 bg-status-warning/5 p-4">
            {claim.status === 'PENDING' && (
              <p className="text-body-sm text-status-warning">
                This claim has been filed and bonded but hasn&apos;t been resolved yet — evidence
                assessment via GenLayer validator consensus hasn&apos;t run. Resolution is
                permissionless: anyone can trigger it, not just the claimant.
              </p>
            )}
            {claim.status === 'CONTEST_WINDOW' && (
              <p className="text-body-sm text-status-warning">
                This claim is in its contest window. If the window has closed with no challenge
                filed, anyone can finalize it to VERIFIED.
              </p>
            )}
            {claim.status === 'VERIFIED' && !claim.is_currently_verified && (
              <p className="text-body-sm text-status-warning">
                This claim&apos;s verification window has passed. Formalizing expiry returns the
                claimant&apos;s bond in full — permissionless, anyone can trigger it.
              </p>
            )}
            {claim.status === 'REJECTED' && (
              <p className="text-body-sm text-status-warning">
                This claim was rejected during resolution
                {claim.evidence_result === 'EVIDENCE_INSUFFICIENT' && ' — the evidence provided was insufficient to establish authority'}
                {claim.evidence_result === 'EVIDENCE_CONTRADICTED' && ' — the evidence provided contradicted the claimed authority'}
                {claim.conflict_result === 'LIKELY_UNAUTHORIZED_DUPLICATE' && ', and it conflicted with an existing authorized claim on this property'}
                . Its bond was forfeited; the claimant may file a renewal with new evidence.
              </p>
            )}
            {claim.status === 'EXPIRED' && (
              <p className="text-body-sm text-status-warning">
                This claim&apos;s verification period has ended and expiry was formalized on-chain.
                The claimant&apos;s bond was returned in full.
              </p>
            )}
            {claim.status === 'REVOKED' && (
              <p className="text-body-sm text-status-warning">
                This claim was revoked by its claimant and is no longer active.
              </p>
            )}
          </div>
        )}

        {claim.has_open_challenge && claim.open_challenge_id && (
          <div className="mb-6 rounded-lg border border-status-error/20 bg-status-error/5 p-4">
            <p className="mb-2 text-body-sm text-status-error">
              This claim has an open challenge under dispute.
            </p>
            <Link
              href={`/challenge/${claim.open_challenge_id}`}
              className="text-body-sm font-label-caps uppercase text-status-error underline"
            >
              View Challenge #{claim.open_challenge_id} →
            </Link>
          </div>
        )}

        <h1 className="mb-2 font-headline-lg text-headline-lg text-primary">
          {claim.street_address}
          {claim.unit ? `, Unit ${claim.unit}` : ''}
        </h1>
        <p className="mb-8 text-on-surface-variant">
          {claim.city}, {claim.state_or_region}, {claim.country}
        </p>
        <PropertyMap claim={claim} />
        <div className="grid grid-cols-2 gap-8 border-t border-border-subtle pt-8 md:grid-cols-3">
          <Field label="Registry ID">
            <MonoData tone="accent">KH-{claimId}</MonoData>
          </Field>
          <Field label="Claimed By">{claim.claimant_name}</Field>
          <Field label="Authority Type">
            {AUTHORITY_TYPE_LABELS[claim.authority_type as AuthorityType] ?? claim.authority_type}
          </Field>
          <Field label="Verification Date">
            <MonoData>{claim.verified_at ? new Date(claim.verified_at).toLocaleDateString() : '—'}</MonoData>
            {/* verified_at/verification_expires_at are only ever set by
                resolve_property_claim / finalize_uncontested_claim -- '—'
                here is the correct, honest state for a claim that hasn't
                reached VERIFIED yet, not a missing-data bug. Without this
                note it reads as broken rather than "not applicable yet". */}
            {!claim.verified_at && (
              <span className="mt-1 block text-body-sm text-on-surface-variant">Set once verification completes</span>
            )}
          </Field>
          <Field label="Verification Expires">
            <MonoData tone={claim.is_currently_verified ? 'default' : 'error'}>
              {claim.verification_expires_at ? new Date(claim.verification_expires_at).toLocaleDateString() : '—'}
            </MonoData>
            {!claim.verification_expires_at && (
              <span className="mt-1 block text-body-sm text-on-surface-variant">Set once verification completes</span>
            )}
          </Field>
          <Field label="Verification Identifier">
            <MonoData tone="muted">KH-{claimId}</MonoData>
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-6 md:col-span-4">
        <div className="border border-border-subtle bg-surface-card p-6">
          <span className="mb-3 block text-label-caps font-label-caps uppercase text-on-surface-variant">
            Evidence
          </span>
          <a
            href={claim.evidence_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex items-center justify-between gap-3 border border-border-subtle bg-surface-container-lowest p-4 text-body-sm text-primary hover:bg-surface-container-low"
          >
            <span className="truncate">{claim.evidence_url}</span>
            <span className="flex-shrink-0 text-surface-tint">↗</span>
          </a>
        </div>
        {claim.evidence_result && (
          <div className="border border-border-subtle bg-surface-card p-6">
            <span className="mb-3 block text-label-caps font-label-caps uppercase text-on-surface-variant">
              Validator Consensus
            </span>
            <dl className="space-y-3">
              <div className="flex items-center justify-between">
                <dt className="text-body-sm text-on-surface-variant">Evidence</dt>
                <dd className="text-body-sm text-primary">{EVIDENCE_RESULT_LABELS[claim.evidence_result]}</dd>
              </div>
              {claim.conflict_result && (
                <div className="flex items-center justify-between">
                  <dt className="text-body-sm text-on-surface-variant">Property Conflict</dt>
                  <dd className="text-body-sm text-primary">{CONFLICT_RESULT_LABELS[claim.conflict_result]}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
        <div className="border border-status-warning/20 bg-status-warning/5 p-6">
          <p className="text-body-sm text-status-warning">
            Verification is a risk-assessment signal, not a legal guarantee. Do not send money solely
            because a listing displays a verified status — conduct your own due diligence.
          </p>
        </div>
        {canChallenge ? (
          <Link href={`/challenge/new?claimId=${claimId}`}>
            <Button variant="danger" className="w-full">
              File a Challenge
            </Button>
          </Link>
        ) : isClaimant ? (
          <p className="border border-border-subtle bg-surface-card p-4 text-body-sm text-on-surface-variant">
            You can&apos;t challenge your own claim.
          </p>
        ) : claim.has_open_challenge ? (
          <p className="border border-border-subtle bg-surface-card p-4 text-body-sm text-on-surface-variant">
            This claim already has an open challenge under dispute.
          </p>
        ) : (
          <p className="border border-border-subtle bg-surface-card p-4 text-body-sm text-on-surface-variant">
            This claim isn&apos;t currently open to challenge.
          </p>
        )}

        <div className="border border-border-subtle bg-surface-card p-6">
          <span className="mb-3 block text-label-caps font-label-caps uppercase text-on-surface-variant">
            Claimant Actions
          </span>
          <ClaimActionButtons claim={claim} claimId={claimId} />
        </div>
      </div>

      <div className="border border-border-subtle bg-surface-card p-8 md:col-span-12">
        <span className="mb-6 block text-label-caps font-label-caps uppercase text-on-surface-variant">
          Listing Information
        </span>
        <h4 className="mb-2 text-body-lg text-primary">{claim.listing_title}</h4>
        <p className="text-body-md text-on-surface-variant">{claim.listing_description}</p>
      </div>
    </div>
  );
}

/**
 * OpenStreetMap's embeddable viewer only takes a lat/lon bbox + marker,
 * not a free-text address -- so this geocodes via Nominatim (OSM's own
 * free, keyless search API) first, then builds the embed URL from the
 * result. No API key, no billing, no third-party geocoding *service*
 * dependency (the project deliberately avoids that for the registry's
 * own address-normalization logic, see packages/shared/src/property.ts)
 * -- this is purely a "does this place plausibly exist" visual aid, not
 * a verified geocode, same caveat as any other evidence on this page.
 */
function PropertyMap({ claim }: { claim: ClaimRecord }) {
  const addressText = `${claim.street_address}, ${claim.city}, ${claim.state_or_region}, ${claim.country}`;

  const query = useQuery({
    queryKey: ['geocode', addressText],
    queryFn: async () => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addressText)}`,
      );
      if (!response.ok) throw new Error('Geocoding lookup failed.');
      const results: { lat: string; lon: string }[] = await response.json();
      const first = results[0];
      if (!first) throw new Error('No match found.');
      return { lat: Number(first.lat), lon: Number(first.lon) };
    },
    retry: false,
    staleTime: Infinity,
  });

  if (query.isLoading) {
    return (
      <div className="mb-8 flex h-64 items-center justify-center rounded-lg border border-border-subtle text-body-sm text-on-surface-variant">
        Locating on map…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mb-8 flex h-32 items-center justify-center rounded-lg border border-dashed border-outline-variant text-body-sm text-on-surface-variant">
        Map location unavailable for this address.
      </div>
    );
  }

  const { lat, lon } = query.data;
  const delta = 0.006;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;

  return (
    <div className="mb-8 overflow-hidden rounded-lg border border-border-subtle">
      <iframe
        title="Approximate property location"
        className="h-64 w-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`}
      />
      <p className="border-t border-border-subtle bg-surface-container-lowest px-4 py-2 text-body-sm text-on-surface-variant">
        Approximate location from OpenStreetMap — not a verified geocode. Confirm the exact
        address against the evidence provided.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-label-caps font-label-caps uppercase text-on-surface-variant">{label}</p>
      <div className="text-primary">{children}</div>
    </div>
  );
}
