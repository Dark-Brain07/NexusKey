import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';

const SECTIONS = [
  {
    id: 'claiming',
    title: 'Claim Instructions',
    body: 'Go to File a Claim, provide the property location and unit, your legal name, your authority type, listing details, a public evidence URL, and post the required GEN bond from a connected wallet. Your claim enters review immediately — GenLayer validators assess your evidence within minutes.',
  },
  {
    id: 'evidence',
    title: 'Evidence Requirements',
    body: 'Evidence must be a publicly accessible URL — a property-management page, an ownership record, an authorization letter, or a listing platform page — that specifically connects you to this exact property and unit, not merely to the same city or company.',
  },
  {
    id: 'challenging',
    title: 'Challenge Instructions',
    body: 'Search the registry for the claim you believe is invalid, select File a Challenge from its details page, choose a reason, provide your own evidence, and post the challenge bond. Resolution happens through the same validator-consensus process.',
  },
  {
    id: 'statuses',
    title: 'Verification Status Definitions',
    body: 'PENDING: awaiting initial evidence review. CONTEST_WINDOW: evidence was inconclusive or a conflict was uncertain — open to challenge for a limited window. CHALLENGED: an active dispute is being resolved. VERIFIED: evidence and conflict checks passed; still expires. REJECTED: evidence was contradicted or the claim was a likely unauthorized duplicate. EXPIRED: a verified claim past its validity window. REVOKED: withdrawn by its own claimant.',
  },
  {
    id: 'wallet',
    title: 'Wallet Guidance',
    body: 'NexusKey uses wallet-based authentication — connect a compatible wallet such as MetaMask to file claims, post bonds, or file challenges. Searching and viewing claim status never requires a wallet.',
  },
  {
    id: 'errors',
    title: 'Common Errors',
    body: 'Transaction rejected: you declined the signature in your wallet — no funds moved. Insufficient bond: the amount sent was below the protocol minimum. Claim not active: the action you attempted isn’t valid for the claim’s current status.',
  },
  {
    id: 'privacy',
    title: 'Privacy Information',
    body: 'Claimant names and evidence URLs are public by design — NexusKey is a transparency tool. No private documents are stored, and no data beyond what a claimant explicitly submits is placed on-chain.',
  },
  {
    id: 'security',
    title: 'Security Information',
    body: 'The GenLayer Intelligent Contract, not this website or its backend, is the authoritative source for claim status and bond settlement. All fund transfers follow a zero-then-transfer ordering enforced entirely in contract code — no party, including the NexusKey team, holds admin control over settlement.',
  },
  {
    id: 'legal',
    title: 'Legal Disclaimers',
    body: 'NexusKey is a verification and risk-assessment tool. Verification is not a legal determination of property ownership and not a guarantee that a rental transaction is safe. Evidence may change after verification. Local rental and property laws may apply — NexusKey does not provide legal advice.',
  },
];

export default function DocsPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <span className="mb-4 block text-label-caps font-label-caps uppercase text-surface-tint">
          Documentation
        </span>
        <h1 className="mb-12 font-display text-display text-white">Help &amp; Reference</h1>
        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-28">
              <h2 className="mb-2 font-headline-md text-headline-md text-primary">{section.title}</h2>
              <p className="leading-relaxed text-body-md text-on-surface-variant">{section.body}</p>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
