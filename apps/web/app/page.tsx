import Link from 'next/link';
import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';
import { PropertySearchBar } from '@/components/features/verify/PropertySearchBar';
import { Button } from '@/components/DesignSystem/Button';

export default function LandingPage() {
  return (
    <>
      <TopNav />
      <main className="pt-20">
        <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-margin-mobile text-center md:px-margin-desktop">
          <div className="relative z-10 max-w-4xl">
            <p className="mb-6 text-label-caps font-label-caps tracking-[0.2em] text-black">
              ESTABLISHING ARCHITECTURAL ACCOUNTABILITY
            </p>
            <h1 className="mb-8 font-display text-display leading-tight text-black">
              Before you trust a door, you look
              <br />
              <span className="italic text-black">through the NexusKey first.</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-body-lg text-black">
              NexusKey is a bonded verification registry for rental authority — not ownership, not
              a marketplace. Claimants stake a GEN bond behind their right to advertise a
              property; GenLayer validators assess the evidence; deterministic contract logic
              settles the outcome.
            </p>
            <div className="mx-auto mt-12 w-full max-w-3xl">
              <PropertySearchBar />
              <p className="mt-4 text-body-sm italic text-black/60">
                Real-time verification against the bonded registry. No wallet required to search.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-container-max px-margin-mobile py-32 md:px-margin-desktop">
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
            <div className="group relative overflow-hidden rounded-xl border border-border-subtle bg-surface-card p-12 transition-all hover:border-surface-tint/40 md:col-span-8">
              <div className="relative z-10 max-w-md">
                <div className="mb-6 flex items-center gap-3">
                  <span className="rounded-lg bg-surface-tint/10 p-2 text-black">
                    <ShieldIcon />
                  </span>
                  <span className="text-label-caps font-label-caps uppercase text-black">
                    Protocol Layer 01
                  </span>
                </div>
                <h3 className="mb-4 font-headline-lg text-headline-lg text-black">Bonded Registry</h3>
                <p className="text-body-md leading-relaxed text-black">
                  Claimants stake a GEN bond to file a Rental Authority Claim. This financial
                  accountability ensures every claim is backed by real collateral — not just an
                  assertion.
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-card p-8 transition-all hover:border-surface-tint/40 md:col-span-4">
              <div>
                <span className="mb-6 block text-4xl text-status-verified">
                  <ConsensusIcon />
                </span>
                <h3 className="mb-2 font-headline-md text-headline-md text-black">
                  GenLayer Verification
                </h3>
                <p className="text-body-md text-black">
                  Validator consensus assesses whether public evidence substantively supports the
                  declared authority — never a keyword match, never a guess.
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-card p-8 transition-all hover:border-surface-tint/40 md:col-span-4">
              <div>
                <span className="mb-6 block text-4xl text-status-warning">
                  <GavelIcon />
                </span>
                <h3 className="mb-2 font-headline-md text-headline-md text-black">Challenge System</h3>
                <p className="text-body-md text-black">
                  Anyone with contradicting evidence may file a bonded challenge. Uncertainty is
                  never treated as fraud — every genuinely inconclusive dispute settles without
                  penalty to either side.
                </p>
              </div>
              <Link
                href="/how-it-works"
                className="mt-8 flex items-center gap-2 text-label-caps font-label-caps text-black hover:underline"
              >
                LEARN HOW CHALLENGES WORK →
              </Link>
            </div>
            <div className="flex flex-col justify-end rounded-xl border border-border-subtle bg-surface-container-lowest p-12 md:col-span-8">
              <h3 className="mb-4 font-headline-lg text-headline-lg text-black">
                Verification Expires — On Purpose
              </h3>
              <p className="max-w-lg text-body-md text-black">
                Property relationships change. Every verified claim carries a 90-day validity
                window, a renewal path, and a public expiration date — never a permanent status.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-border-subtle bg-surface-container-lowest py-32">
          <div className="mx-auto max-w-container-max px-margin-mobile text-center md:px-margin-desktop">
            <h2 className="mb-16 font-headline-lg text-headline-lg text-black">
              Built for Institutional Trust
            </h2>
            <div className="grid grid-cols-2 gap-12 opacity-60 md:grid-cols-4">
              {['Bonded by GEN', 'Consensus Verified', 'Immutable History', 'Public Auditing'].map(
                (label) => (
                  <div key={label} className="flex flex-col items-center">
                    <span className="text-label-caps font-label-caps uppercase">{label}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-container-max px-margin-mobile py-32 md:px-margin-desktop">
          <div className="relative overflow-hidden rounded-2xl border border-surface-tint/20 p-16 text-center glass-panel">
            <h2 className="mb-6 font-display text-display text-black">Ready to secure your listing?</h2>
            <p className="mx-auto mb-12 max-w-2xl text-body-lg text-black">
              Property owners, managers, and authorized agents can file a bonded Rental Authority
              Claim and give renters a public, verifiable reason to trust their listing.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <Link href="/claim/new">
                <Button variant="primary" className="px-10 py-4">
                  File a Claim
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button variant="secondary" className="px-10 py-4">
                  How it Works
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
    </svg>
  );
}
function ConsensusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-9 w-9" aria-hidden="true">
      <circle cx="12" cy="6" r="2.5" />
      <circle cx="6" cy="16" r="2.5" />
      <circle cx="18" cy="16" r="2.5" />
      <path d="M11 8.3 7.3 14M13 8.3 16.7 14M8.5 16h7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function GavelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-9 w-9" aria-hidden="true">
      <path d="M14.5 2.5 12 5l4.5 4.5L19 7l-4.5-4.5ZM11 6.5l4.5 4.5L8 18.5 3.5 14 11 6.5ZM2 20h9v2H2v-2Z" />
    </svg>
  );
}
