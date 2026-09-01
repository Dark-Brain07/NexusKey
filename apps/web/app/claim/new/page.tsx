'use client';

import { useState, useEffect, forwardRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAccount } from 'wagmi';
import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';
import { Stepper } from '@/components/DesignSystem/Stepper';
import { Button } from '@/components/DesignSystem/Button';
import { MonoData } from '@/components/DesignSystem/MonoData';
import { ContractNotConfiguredNotice } from '@/components/DesignSystem/ContractNotConfiguredNotice';
import {
  claimSubmissionSchema,
  type ClaimSubmission,
  AUTHORITY_TYPES,
  AUTHORITY_TYPE_LABELS,
  AUTHORITY_TYPE_DESCRIPTIONS,
  PROTOCOL_DEFAULTS,
  computePropertyKeyFromAddress,
  weiStringToGen,
  formatDuration,
} from '@nexuskey/shared';
import { isContractConfigured } from '@/lib/env';
import { filePropertyClaim, getProtocolConfiguration } from '@/lib/genlayerClient';
import type { Address } from 'genlayer-js/types';

type TxState =
  | { status: 'idle' }
  | { status: 'filing' }
  | { status: 'error'; message: string; claimId?: string };

const STEPS = [
  { label: 'Property' },
  { label: 'Claimant' },
  { label: 'Evidence' },
  { label: 'Review' },
];

export default function NewClaimPage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [propertyKey, setPropertyKey] = useState<string | null>(null);
  const [tx, setTx] = useState<TxState>({ status: 'idle' });
  const [liveConfig, setLiveConfig] = useState<{
    bondGen: number;
    contestWindowLabel: string;
  } | null>(null);

  // Pre-flight values above come from PROTOCOL_DEFAULTS, a local mirror
  // that is NOT authoritative (see packages/shared/src/protocolConfig.ts).
  // Fetch the deployed contract's actual configuration to reconcile the
  // displayed bond and window against what will really be enforced.
  useEffect(() => {
    if (!isContractConfigured) return;
    getProtocolConfiguration()
      .then((config) => {
        setLiveConfig({
          bondGen: weiStringToGen(config.claimBondMinWei),
          contestWindowLabel: formatDuration(config.contestWindowSeconds),
        });
      })
      .catch(() => {
        // Keep showing PROTOCOL_DEFAULTS if the read fails.
      });
  }, []);

  const bondGen = liveConfig?.bondGen ?? PROTOCOL_DEFAULTS.CLAIM_BOND_MINIMUM_GEN;
  const contestWindowLabel = liveConfig?.contestWindowLabel ?? formatDuration(PROTOCOL_DEFAULTS.CONTEST_WINDOW_SECONDS);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<ClaimSubmission>({
    resolver: zodResolver(claimSubmissionSchema),
    defaultValues: { imageReferences: [] },
  });

  const values = watch();

  async function goNext() {
    const fieldsByStep: (keyof ClaimSubmission)[][] = [
      ['country', 'stateOrRegion', 'city', 'streetAddress', 'unit'],
      ['claimantName', 'authorityType', 'listingTitle', 'listingDescription'],
      ['evidenceUrl'],
    ];
    const fields = fieldsByStep[stepIndex];
    const valid = fields ? await trigger(fields) : true;
    if (!valid) return;
    if (stepIndex === 0) {
      const { propertyKey: key } = await computePropertyKeyFromAddress({
        country: values.country,
        stateOrRegion: values.stateOrRegion,
        city: values.city,
        streetAddress: values.streetAddress,
        unit: values.unit,
      });
      setPropertyKey(key);
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  const onSubmit = handleSubmit(async (formValues) => {
    if (!propertyKey || !address) return;
    setTx({ status: 'filing' });
    // window.ethereum is the injected-wallet EIP-1193 provider RainbowKit's
    // injected/MetaMask connectors set on window. WalletConnect-only
    // sessions (no browser extension) aren't wired to this yet -- a known
    // V1 gap, not a silent failure: such users see "Connect Wallet to
    // Submit" satisfied by isConnected but the write call below will
    // reject if no injected provider exists.
    const provider = (window as unknown as { ethereum?: unknown }).ethereum;

    // file_property_claim only files the claim -- it stays PENDING until
    // resolve_property_claim runs the actual (slow, consensus-based)
    // evidence check, a deliberate contract-design split (filing stays
    // fast; resolution can take minutes). Earlier this chained
    // resolve_property_claim automatically inside this same flow, but
    // that produced false-negative "resolution failed" errors when the
    // write itself succeeded but the receipt-wait step here didn't --
    // confusing, since the underlying transaction was actually fine.
    // Redirecting straight to the claim's own page (which already has a
    // reliable, explicit "Resolve Now" button) is simpler and matches
    // the contract's own permissionless design better: resolving is a
    // distinct, visible step, not something hidden inside filing.
    //
    // claimId comes straight from the write call's decoded return value
    // (the contract's own `return claim_id`), not a re-read of the global
    // total_claims counter -- reading that counter right after filing is
    // racy under concurrent filers and can redirect to someone else's claim.
    let claimId: string;
    let hash: `0x${string}`;
    try {
      ({ claimId, hash } = await filePropertyClaim(provider, address as Address, formValues, bondGen));
    } catch (err) {
      setTx({
        status: 'error',
        message: err instanceof Error ? err.message : 'Transaction failed. No funds were moved.',
      });
      return;
    }

    // Pass the tx hash through so the claim page can show it's still
    // provisional (ACCEPTED, not yet FINALIZED and appealable) instead of
    // presenting this filing as fully settled the instant it redirects.
    router.push(`/claim/${claimId}?pendingTx=${hash}`);
  });

  return (
    <>
      <TopNav />
      <main className="px-margin-mobile pb-24 pt-32 md:px-0">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16">
            <Stepper steps={STEPS} currentIndex={stepIndex} />
          </div>

          {!isContractConfigured && (
            <div className="mb-8">
              <ContractNotConfiguredNotice action="filing a claim" />
            </div>
          )}

          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              {stepIndex === 0 && <PropertyStep register={register} errors={errors} />}
              {stepIndex === 1 && (
                <ClaimantStep register={register} errors={errors} authorityType={values.authorityType} />
              )}
              {stepIndex === 2 && <EvidenceStep register={register} errors={errors} />}
              {stepIndex === 3 && <ReviewStep values={values} propertyKey={propertyKey} />}

              {stepIndex === 3 && tx.status === 'error' && (
                <div className="mt-6 rounded-lg border border-status-error/20 bg-status-error/5 p-4">
                  <p className="text-body-sm text-status-error">{tx.message}</p>
                  {tx.claimId && (
                    <Link href={`/claim/${tx.claimId}`} className="mt-2 inline-block text-body-sm underline text-status-error">
                      Go to claim KH-{tx.claimId}
                    </Link>
                  )}
                </div>
              )}

              <div className="mt-10 flex items-center justify-between">
                <Button type="button" variant="ghost" onClick={goBack} disabled={stepIndex === 0}>
                  ← Back
                </Button>
                {stepIndex < STEPS.length - 1 ? (
                  <Button type="button" onClick={goNext}>
                    Continue →
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    loading={tx.status === 'filing'}
                    disabled={!isContractConfigured || !isConnected || tx.status === 'filing'}
                  >
                    {!isConnected
                      ? 'Connect Wallet to Submit'
                      : tx.status === 'filing'
                        ? 'Filing…'
                        : 'Submit Claim & Post Bond'}
                  </Button>
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="sticky top-32 space-y-6 rounded-xl p-8 glass-panel">
                <h3 className="text-body-lg font-headline-md font-semibold text-black">
                  Bonded Registry Requirements
                </h3>
                <p className="text-body-sm leading-relaxed text-black">
                  Filing a Rental Authority Claim requires a mandatory{' '}
                  <span className="font-mono-data text-black">GEN token bond</span>. This stake
                  is a guarantee of authority, not a fee.
                </p>
                <div className="space-y-4 rounded-lg border border-border-subtle bg-surface-container-lowest/50 p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-label-caps font-label-caps text-black">
                      REQUIRED STAKE
                    </span>
                    <MonoData tone="accent">{bondGen} GEN</MonoData>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-label-caps font-label-caps text-black">
                      CONTEST WINDOW
                    </span>
                    <MonoData>{contestWindowLabel}</MonoData>
                  </div>
                  <div className="h-px bg-border-subtle" />
                  <p className="text-body-sm italic text-black">
                    Bond remains locked for the life of a verified claim and is returned in full on
                    natural expiration or a successfully defended challenge.
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-status-warning/20 bg-status-warning/5 p-4">
                  <span className="text-status-warning">⚠</span>
                  <p className="text-body-sm text-status-warning">
                    False claims lead to bond forfeiture. Evidence must substantively connect you to
                    this exact property and unit.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}

function PropertyStep({ register, errors }: any) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 font-headline-lg text-headline-lg text-black">Property Location</h1>
        <p className="mb-10 leading-relaxed text-body-md text-black">
          Step 1: Define the property and unit this claim covers.
        </p>
      </div>
      <FieldSet label="Country">
        <TextInput {...register('country')} defaultValue="US" placeholder="US" error={errors.country} />
      </FieldSet>
      <div className="grid grid-cols-2 gap-8">
        <FieldSet label="State / Region">
          <TextInput {...register('stateOrRegion')} placeholder="NY" error={errors.stateOrRegion} />
        </FieldSet>
        <FieldSet label="City">
          <TextInput {...register('city')} placeholder="New York" error={errors.city} />
        </FieldSet>
      </div>
      <FieldSet label="Street Address">
        <TextInput {...register('streetAddress')} placeholder="123 Main Street" error={errors.streetAddress} />
      </FieldSet>
      <FieldSet label="Unit Number (optional)">
        <TextInput {...register('unit')} placeholder="4B" error={errors.unit} />
      </FieldSet>
    </div>
  );
}

function ClaimantStep({ register, errors, authorityType }: any) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 font-headline-lg text-headline-lg text-black">Claimant & Listing</h1>
        <p className="mb-10 leading-relaxed text-body-md text-black">
          Step 2: Your legal standing and the listing you&apos;re backing.
        </p>
      </div>
      <FieldSet label="Claimant Legal Name">
        <TextInput {...register('claimantName')} placeholder="Full name or entity name" error={errors.claimantName} />
      </FieldSet>
      <FieldSet label="Authority Type">
        <select
          {...register('authorityType')}
          className="w-full border-0 border-b border-border-subtle bg-surface-container-lowest py-4 text-body-lg text-black focus:border-surface-tint focus:outline-none"
        >
          {AUTHORITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {AUTHORITY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <p className="mt-2 text-body-sm text-black">
          {AUTHORITY_TYPE_DESCRIPTIONS[authorityType as keyof typeof AUTHORITY_TYPE_DESCRIPTIONS] ?? ''}
        </p>
      </FieldSet>
      <FieldSet label="Listing Title">
        <TextInput {...register('listingTitle')} placeholder="Cozy 2BR near downtown" error={errors.listingTitle} />
      </FieldSet>
      <FieldSet label="Listing Description">
        <textarea
          {...register('listingDescription')}
          rows={4}
          className="w-full border-0 border-b border-border-subtle bg-surface-container-lowest px-0 py-4 text-body-lg text-black placeholder:text-black/30 focus:border-surface-tint focus:outline-none"
          placeholder="Describe the listing…"
        />
      </FieldSet>
    </div>
  );
}

function EvidenceStep({ register, errors }: any) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 font-headline-lg text-headline-lg text-black">Public Evidence</h1>
        <p className="mb-10 leading-relaxed text-body-md text-black">
          Step 3: A publicly accessible URL that substantively supports your authority — a
          property-management page, ownership record, or authorization letter.
        </p>
      </div>
      <FieldSet label="Evidence URL">
        <TextInput {...register('evidenceUrl')} placeholder="https://" error={errors.evidenceUrl} />
      </FieldSet>
      <p className="text-body-sm text-black">
        Evidence must specifically connect you to this exact property and unit — not merely show
        that you operate in the same city.
      </p>
    </div>
  );
}

function ReviewStep({ values, propertyKey }: { values: Partial<ClaimSubmission>; propertyKey: string | null }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 font-headline-lg text-headline-lg text-black">Review & Submit</h1>
        <p className="mb-10 leading-relaxed text-body-md text-black">
          Step 4: Confirm your claim details before posting your bond.
        </p>
      </div>
      <dl className="space-y-4 rounded-lg border border-border-subtle bg-surface-container-lowest p-6">
        <ReviewRow label="Property" value={`${values.streetAddress}${values.unit ? `, Unit ${values.unit}` : ''}`} />
        <ReviewRow label="City / State" value={`${values.city}, ${values.stateOrRegion}`} />
        <ReviewRow label="Claimant" value={values.claimantName} />
        <ReviewRow label="Authority Type" value={values.authorityType} mono />
        <ReviewRow label="Evidence URL" value={values.evidenceUrl} mono />
        {propertyKey && <ReviewRow label="Property Key" value={propertyKey} mono />}
      </dl>
    </div>
  );
}

function ReviewRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border-subtle pb-3 last:border-0 last:pb-0">
      <dt className="text-label-caps font-label-caps uppercase text-black">{label}</dt>
      <dd className={mono ? 'truncate pl-4 font-mono-data text-mono-data text-black' : 'truncate pl-4 text-black'}>
        {value || '—'}
      </dd>
    </div>
  );
}

function FieldSet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-label-caps font-label-caps uppercase tracking-widest text-black">
        {label}
      </label>
      {children}
    </div>
  );
}

// Wrapped in forwardRef: react-hook-form's register() returns a `ref`
// callback it uses to read the underlying <input>'s DOM value directly
// (uncontrolled-field mode). A plain function component silently drops a
// `ref` prop passed to it -- React reserves `ref` for the component
// itself and never forwards it into props unless the component opts in
// via forwardRef -- so without this, RHF never sees what the user typed
// and every field reports "Required" even when visibly filled in.
const TextInput = forwardRef<HTMLInputElement, { error?: { message?: string } } & React.InputHTMLAttributes<HTMLInputElement>>(
  ({ error, ...props }, ref) => (
    <div>
      <input
        ref={ref}
        {...props}
        className="w-full border-0 border-b border-border-subtle bg-surface-container-lowest py-4 text-body-lg text-black placeholder:text-black/30 focus:border-surface-tint focus:outline-none"
      />
      {error && <p className="mt-1 text-body-sm text-status-error">{error.message}</p>}
    </div>
  ),
);
TextInput.displayName = 'TextInput';
