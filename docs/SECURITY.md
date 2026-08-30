# NexusKey Security Review

This is a structured review of the current codebase, not a certification.
It documents what was actually checked, what was found, what was fixed,
and — per NexusKey's own rule against overclaiming — what remains an open
risk or a known, accepted limitation.

## Summary of findings

| # | Area | Severity | Status |
|---|---|---|---|
| 1 | Next.js 14.2.35 has multiple unpatched high-severity advisories (SSRF, DoS) | High | **Open** — requires a Next.js 15 major upgrade, not done in this pass |
| 2 | `evidenceUrlSchema`'s SSRF loopback check missed bracketed IPv6 hostnames | Medium | Fixed (see TESTING.md / commit history) |
| 3 | Property search stored unnormalized city/state, breaking case-insensitive matching | Low (correctness, not exploit) | Fixed |
| 4 | Raw `ZodError`s surfaced as 500s instead of 400s on some routes | Low | Fixed |
| 5 | Backend evidence-preview fetch config exists but no code path implements it | Info | Documented below, not built |
| 6 | Self-challenge protection is wallet-equality only, not Sybil-resistant | Info / accepted | Documented limitation |
| 7 | Address normalization has incomplete abbreviation coverage | Info / accepted | Documented limitation |
| 8 | Transitive dependency advisories (axios, ws, PostCSS) via wallet-connector tooling | Low | Not directly invoked by app code; tracked, not actioned |

## 1. Dependency audit

`pnpm audit --prod` (run against the full workspace) surfaces 38
advisories, the majority from `next@14.2.35`: several **high-severity**
issues including SSRF in Server Actions/rewrites and Denial-of-Service via
Server Components, all patched only in `next >=15.5.21` — there is no
patched 14.x release. Next.js 15 requires React 19 and carries its own
breaking changes; upgrading was not attempted in this pass because it
risks breaking the wagmi/RainbowKit wallet integration and every page
built against Next 14's App Router behavior, and needs its own dedicated
test pass rather than a rushed change during a review.

**This is the single most important open item before a production
launch.** Recommended next step: a dedicated Next.js 15 + React 19
upgrade task, run in isolation with the full page-by-page build and
manual QA pass this review didn't have budget for.

Lower-severity transitive findings (`axios`, `ws`, `postcss`) come from
wallet-connector SDKs (MetaMask SDK, WalletConnect, Tailwind's build
toolchain) three-plus levels deep in the dependency tree — NexusKey's own
code never calls these packages directly, which limits real-world
exposure, but they should be revisited whenever their parent packages
(wagmi, RainbowKit, Tailwind) release updates that pull in patched
versions.

## 2. Authentication & session security

Wallet-based auth only — no password, no server-side session, no auth
cookie. The public API (`apps/api`) has no authenticated routes at all;
every read is public by design (claim/challenge data, including the
claimant/challenger wallet address, is intentionally public). This
removes an entire class of session-fixation, CSRF, and credential-storage
risk by not having a session to attack — see §7.

`AUTH_SESSION_SECRET` exists in the env schema as a placeholder for a
future signed-session feature (e.g. SIWE-style "prove you own this
wallet" for a write action gated at the API layer) that is **not
currently implemented**. It is unused dead configuration today, not a
live secret protecting anything — noted so it isn't mistaken for an
active security boundary.

## 3. Wallet & private-key handling

NexusKey never touches, stores, or transmits a private key. Wallet-based
auth (per the locked-in architecture decision) delegates all signing to
the user's own wallet extension via wagmi/RainbowKit — `window.ethereum`
(or WalletConnect) receives the transaction request and the user
approves/signs inside their own wallet UI, never inside NexusKey's code.
No custom cryptography was implemented anywhere in this codebase.

## 4. Contract access control & state-transition safety

Covered in depth in `GENLAYER_CONTRACT.md` and verified by 33 direct
tests in `contracts/NexusKey/tests/direct/test_NexusKey.py`:

- No admin/owner role anywhere in the contract; every protocol constant
  is immutable after `__init__`.
- Every fund transfer follows zero-ledger-then-persist-then-transfer
  ordering through a single `_send_gen` choke point — verified by tests
  asserting a second call into an already-settled claim/challenge raises
  before any transfer (`test_resolve_claim_rejects_double_resolution`,
  `test_resolve_challenge_rejects_double_resolution`).
- Claim/challenge IDs are monotonic counters, never reused — replay-proof
  by construction.
- Only one open challenge per claim at a time, enforced by a status check
  before a second challenge can be filed — closes the race between two
  simultaneous challengers.
- A claimant cannot challenge their own claim (`_addresses_equal` check).
- Every access-control check (`_require_sender_is`) uses the deterministic
  sender address, not any nondet/model-derived value.

## 5. Economic attack surface

Full rationale in `GENLAYER_CONTRACT.md`'s "Bond and settlement design"
section. Key properties: fixed bond minimums remove any race-to-underbid
incentive; a claim's bond stays locked for its entire `VERIFIED` life
rather than releasing on verification (so there's always something to
forfeit to a successful later challenger); revoking after having reached
`VERIFIED` forfeits the bond to a protocol reserve specifically to remove
the incentive for a bait-and-switch listing.

**Accepted limitation, not fixed:** the self-challenge guard
(`challenger != claimant`) only checks wallet equality. A determined actor
could challenge their own claim from a second wallet to grief a
legitimate dispute, or manufacture a fake "successful defense" against a
sock-puppet challenger to pad an appearance of legitimacy. This is a
known, inherent limitation of any wallet-address-based Sybil check — no
practical on-chain fix exists at V1 scope, and it's explicitly documented
rather than silently accepted.

## 6. Address-normalization attack surface

`packages/shared/src/property.ts`'s abbreviation table (Street/Avenue/
Boulevard/etc.) is deliberately not exhaustive — an address using an
abbreviation not in the table (e.g. "Trl" for "Trail") normalizes
differently from its spelled-out form and could produce a different
`property_key`, letting a second claimant evade conflict detection by
using different-but-equivalent wording. This is a known, accepted
limitation of any deterministic (non-ML, non-third-party-API) address
normalizer — the alternative (a paid geocoding API) was explicitly
rejected in the architecture decisions for cost/dependency reasons. Not
a defect to silently patch over; documented so the tradeoff is visible.

## 7. Web application security (XSS / CSRF / SQL injection)

- **SQL injection:** every database query in `apps/api` uses parameterized
  placeholders (`$1`, `$2`, ...); audited directly — the only template
  literals interpolate a `WHERE` clause built exclusively from hardcoded
  column names and `$N` placeholders, never raw user input.
- **XSS:** no `dangerouslySetInnerHTML` or `eval` anywhere in `apps/web`
  (grepped and confirmed empty) — React/Next's default JSX escaping is
  the only rendering path used.
- **CSRF:** no session cookie exists to forge a request against — every
  API route is either public-read (no side effect) or, for state-changing
  actions (claim/challenge filing), goes directly from the user's wallet
  to the contract, never through `apps/api`. CORS is restricted to
  `API_CORS_ALLOWED_ORIGINS`.

## 8. Rate limiting & API abuse

`express-rate-limit` applied globally in `apps/api` (default: 60
requests/minute per IP, configurable via `RATE_LIMIT_*` env vars) ahead
of every route, including the unauthenticated public search/lookup
endpoints that are the most exposed surface (no wallet required by
design). No endpoint currently allows unbounded response size — pagination
is enforced (`pageSize` capped at 50) on `properties/search`.

## 9. Secret management

`.env`, `.env.local`, and `apps/api/.env` are gitignored and confirmed
never committed (checked via `git status --ignored` throughout
development). `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is intentionally
public — WalletConnect/Reown project IDs are not secrets, they identify
the dApp to the relay network. No API keys, database passwords, or
private keys appear anywhere in the git history for this repository.

## Update — 2026-08-22 audit round + live testing

Additional fixes since the original review above, from a 3-round external
audit plus a live end-to-end contract test (real signed StudioNet
transactions, not mocks). Full detail in `memory.md`'s "Second-round audit
fixes" section and `GENLAYER_CONTRACT.md`'s "Transaction finality"
section.

- **Contract-side SSRF policy added.** §2 above only covered the
  frontend's `evidenceUrlSchema`; the contract itself now independently
  rejects the same class of URL (`_reject_ssrf_prone_host` in
  `contract.py`) before ever fetching it via `gl.nondet.web.render` —
  defense in depth, since the frontend check alone doesn't stop a direct
  contract call bypassing the UI.
- **Conflict-check evidence grounding.** The nondet round that can
  transfer a claimant's forfeited bond to an incumbent claimant
  (`LIKELY_UNAUTHORIZED_DUPLICATE`) now fetches and includes real page
  content in the judgement prompt, not just URLs — previously that
  classification, and the money movement it can trigger, was made without
  validators ever seeing the source material.
- **Transaction-verification correctness (frontend).** A live test run
  surfaced a real gap: a transaction can reach `FINALIZED` with the
  leader's own execution reporting `SUCCESS`, while the validators
  actually majority-*disagreed* and the write's state change was never
  committed. `assertTransactionAccepted` in `genlayerClient.ts` now checks
  the transaction-level consensus vote outcome (`result_name`), not just
  status and leader execution result. This is exactly the class of "looks
  fine, isn't" bug §1's Next.js-upgrade gap and §7's audited surfaces
  don't cover, since it's specific to GenLayer's own consensus mechanics
  rather than conventional web app security.
- **Indexer availability.** `NexusKey-api`'s indexer previously ran
  unconditionally on every Fly machine, independently polling GenLayer's
  shared public StudioNet RPC — this exhausted the shared 5,000 req/day
  quota and silently stalled the backend index (not the contract itself,
  which was unaffected) until fixed with a Postgres advisory-lock leader
  election (`apps/api/src/indexer/leaderLock.ts`) and incremental sync.
  Not a security vulnerability, but an availability bug worth recording
  alongside this review since it directly caused user-visible incorrect
  behavior (a real claim not appearing in search/dashboard).

None of the items in the original "Known limitations" list below changed.

## Known limitations not addressed in this pass

- Next.js major-version upgrade (see §1) — the top priority before launch.
- No automated dependency-update / Dependabot-equivalent configured yet.
- No CSP (Content-Security-Policy) header configured on the Next.js app.
- No structured penetration test or third-party audit has been performed
  — this document reflects an internal code review only.
