import Link from 'next/link';
import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/DesignSystem/Button';
import { PROTOCOL_DEFAULTS } from '@NexusKey/shared';

const SECTIONS = [
  {
    title: 'Rental Authority, Not Ownership',
    body: 'NexusKey verifies whether a claimant has the authority to advertise and rent a specific property or unit — not whether they own it. An owner, a property manager, an authorized agent, and an authorized sublessor can all hold legitimate, compatible authority over the same property at the same time.',
  },
  {
    title: 'Bonded Claims',
    body: `Filing a claim requires posting a ${PROTOCOL_DEFAULTS.CLAIM_BOND_MINIMUM_GEN} GEN bond. This bond is the claimant's financial guarantee — it remains locked for the entire life of a verified claim and is only released on natural expiration, a successful challenge defense, or an unchallenged revocation before verification.`,
  },
  {
    title: 'GenLayer Consensus',
    body: 'A GenLayer Intelligent Contract fetches the evidence URL a claimant submits and asks independent validators to reach consensus on whether it substantively supports the declared authority — never a keyword match, never a guess. Ambiguous or unreachable evidence never resolves to automatic approval or automatic rejection.',
  },
  {
    title: 'Contest Windows',
    body: `When evidence is insufficient rather than contradicted, or when a new claim's relationship to an existing one is uncertain, the claim enters a ${PROTOCOL_DEFAULTS.CONTEST_WINDOW_SECONDS / 86400}-day bonded contest window instead of being automatically rejected. If no one challenges it, the claim becomes verified once the window closes.`,
  },
  {
    title: 'The Challenge Process',
    body: 'Anyone — a rightful owner, a tenant, a renter who was asked to pay, an independent investigator — may challenge a claim by posting a bond and providing contradicting evidence. Consensus resolves the dispute into one of three outcomes: the claimant is upheld, the challenger is upheld, or the result is genuinely uncertain and no bond is penalized.',
  },
  {
    title: 'Expiration',
    body: `Every verified claim carries a ${PROTOCOL_DEFAULTS.VERIFICATION_VALIDITY_SECONDS / 86400}-day validity window. Property relationships change — management contracts end, agents lose authorization, subleases expire. Verification is never permanent, and expired claims never display as currently verified.`,
  },
  {
    title: 'Limitations',
    body: 'NexusKey is a verification and risk-assessment tool, not a legal determination of ownership and not a guarantee that a rental transaction is safe. Always conduct your own due diligence before sending money, paying a deposit, or signing an agreement.',
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <span className="mb-4 block text-label-caps font-label-caps uppercase text-surface-tint">
          How It Works
        </span>
        <h1 className="mb-12 font-display text-display text-white">
          A bonded registry of verified rental authority
        </h1>

        <div className="space-y-12">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 font-headline-md text-headline-md text-primary">{section.title}</h2>
              <p className="leading-relaxed text-body-lg text-on-surface-variant">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap gap-6">
          <Link href="/verify">
            <Button>Verify a Property</Button>
          </Link>
          <Link href="/claim/new">
            <Button variant="secondary">File a Claim</Button>
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
