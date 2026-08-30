'use client';

import { Suspense, useState, useEffect, forwardRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAccount } from 'wagmi';
import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/DesignSystem/Button';
import { MonoData } from '@/components/DesignSystem/MonoData';
import { ContractNotConfiguredNotice } from '@/components/DesignSystem/ContractNotConfiguredNotice';
import {
  challengeSubmissionSchema,
  type ChallengeSubmission,
  CHALLENGE_REASONS,
  CHALLENGE_REASON_LABELS,
  PROTOCOL_DEFAULTS,
  weiStringToGen,
} from '@NexusKey/shared';
import { isContractConfigured } from '@/lib/env';
import {
  challengePropertyClaim,
  getProtocolConfiguration,
} from '@/lib/genlayerClient';
import type { Address } from 'genlayer-js/types';

type TxState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'error'; message: string };

function ChallengeForm() {
  const searchParams = useSearchParams();
  const claimId = searchParams.get('claimId') ?? '';
  const { isConnected, address } = useAccount();
  const router = useRouter();
  const [tx, setTx] = useState<TxState>({ status: 'idle' });
  const [liveBondGen, setLiveBondGen] = useState<number | null>(null);

  // Reconcile the displayed bond against the deployed contract's actual
  // configuration -- PROTOCOL_DEFAULTS is a local, non-authoritative
  // mirror (see packages/shared/src/protocolConfig.ts).
  useEffect(() => {
    if (!isContractConfigured) return;
    getProtocolConfiguration()
      .then((config) => setLiveBondGen(weiStringToGen(config.challengeBondMinWei)))
      .catch(() => {
        // Keep showing PROTOCOL_DEFAULTS if the read fails.
      });
  }, []);

  const bondGen = liveBondGen ?? PROTOCOL_DEFAULTS.CHALLENGE_BOND_MINIMUM_GEN;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChallengeSubmission>({
    resolver: zodResolver(challengeSubmissionSchema),
    defaultValues: { claimId, supportingInfo: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!address) return;
    setTx({ status: 'pending' });
    // Same split as file_property_claim/resolve_property_claim: challenging
    // only files the challenge, resolve_property_challenge is a separate,
    // slower, permissionless step. Redirect to the challenge's own page
    // (which has its own "Resolve Now" button) instead of chaining the
    // resolve call inline here.
    //
    // challengeId comes from the write call's decoded return value, not a
    // re-read of the global total_challenges counter -- that read is racy
    // under concurrent filers and can redirect to someone else's challenge.
    try {
      const provider = (window as unknown as { ethereum?: unknown }).ethereum;
      const { challengeId, hash } = await challengePropertyClaim(provider, address as Address, values, bondGen);
      // Pass the tx hash through so the challenge page can show it's still
      // provisional (ACCEPTED, not yet FINALIZED and appealable).
      router.push(`/challenge/${challengeId}?pendingTx=${hash}`);
    } catch (err) {
      setTx({
        status: 'error',
        message: err instanceof Error ? err.message : 'Transaction failed. No funds were moved.',
      });
    }
  });

  return (
    <main className="mx-auto max-w-3xl px-margin-mobile pb-24 pt-32 md:px-0">
      <div className="mb-12">
        <span className="mb-2 block text-label-caps font-label-caps uppercase text-status-error">
          Dispute Resolution
        </span>
        <h1 className="mb-2 font-headline-lg text-headline-lg text-primary">File a Challenge</h1>
        <p className="text-body-md text-on-surface-variant">
          Challenging claim <MonoData tone="accent">KH-{claimId || '—'}</MonoData>. Your challenge must
          be backed by public evidence and a bond — challenges are never free to discourage spam.
        </p>
      </div>

      {!isContractConfigured && (
        <div className="mb-8">
          <ContractNotConfiguredNotice action="filing a challenge" />
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-8">
        <input type="hidden" {...register('claimId')} value={claimId} />
        <FieldSet label="Challenge Reason">
          <select
            {...register('reason')}
            className="w-full border-0 border-b border-border-subtle bg-surface-container-lowest py-4 text-body-lg text-primary focus:border-status-error focus:outline-none"
          >
            {CHALLENGE_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {CHALLENGE_REASON_LABELS[reason]}
              </option>
            ))}
          </select>
        </FieldSet>
        <FieldSet label="Evidence URL" error={errors.evidenceUrl}>
          <TextInput {...register('evidenceUrl')} placeholder="https://" />
        </FieldSet>
        <FieldSet label="Supporting Information (optional)">
          <textarea
            {...register('supportingInfo')}
            rows={4}
            className="w-full border-0 border-b border-border-subtle bg-surface-container-lowest px-0 py-4 text-body-lg text-primary placeholder:text-on-surface-variant/30 focus:border-status-error focus:outline-none"
            placeholder="Explain why this claim is invalid…"
          />
        </FieldSet>

        <div className="rounded-lg border border-status-error/20 bg-status-error/5 p-6">
          <div className="flex items-center justify-between">
            <span className="text-label-caps font-label-caps text-on-surface-variant">
              CHALLENGE BOND
            </span>
            <MonoData tone="error">{bondGen} GEN</MonoData>
          </div>
          <p className="mt-3 text-body-sm text-on-surface-variant">
            If your challenge is upheld, the claimant&apos;s bond is forfeited to you and your own bond
            is returned. If the claimant is upheld, your bond is forfeited to them. A genuinely
            inconclusive result returns your bond with no penalty to either side.
          </p>
        </div>

        {tx.status === 'error' && (
          <div className="rounded-lg border border-status-error/20 bg-status-error/5 p-4">
            <p className="text-body-sm text-status-error">{tx.message}</p>
          </div>
        )}

        <Button
          type="submit"
          variant="danger"
          className="w-full"
          loading={tx.status === 'pending'}
          disabled={!isContractConfigured || !isConnected || tx.status === 'pending'}
        >
          {!isConnected ? 'Connect Wallet to Submit' : 'Submit Challenge & Post Bond'}
        </Button>
      </form>
    </main>
  );
}

function FieldSet({ label, children, error }: { label: string; children: React.ReactNode; error?: { message?: string } }) {
  return (
    <div className="space-y-2">
      <label className="block text-label-caps font-label-caps uppercase tracking-widest text-on-surface-variant">
        {label}
      </label>
      {children}
      {error && <p className="text-body-sm text-status-error">{error.message}</p>}
    </div>
  );
}

// forwardRef required so react-hook-form's register() ref reaches the
// real <input> DOM node -- see the identical fix (and explanation) in
// app/claim/new/page.tsx's TextInput.
const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => (
    <input
      ref={ref}
      {...props}
      className="w-full border-0 border-b border-border-subtle bg-surface-container-lowest py-4 text-body-lg text-primary placeholder:text-on-surface-variant/30 focus:border-status-error focus:outline-none"
    />
  ),
);
TextInput.displayName = 'TextInput';

export default function NewChallengePage() {
  return (
    <>
      <TopNav />
      <Suspense fallback={<div className="pt-32 text-center text-on-surface-variant">Loading…</div>}>
        <ChallengeForm />
      </Suspense>
      <Footer />
    </>
  );
}
