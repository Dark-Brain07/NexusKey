# NexusKey — Project Memory

Persistent record of decisions made during this build, so work can resume
correctly across sessions without re-deriving context.

## Product
NexusKey is a bonded verification registry for **rental authority** (not
ownership, not a marketplace). Claimants stake a GEN bond behind a Rental
Authority Claim; GenLayer validators assess public evidence; deterministic
contract logic owns all state transitions and bond settlement. Public
verification lookups require no wallet.

## Locked-in infrastructure decisions
- **Backend:** self-managed PostgreSQL, run locally via Docker (`docker-compose.yml`).
- **Backend hosting:** Fly.io — CLI already installed on this machine. `min_machines_running = 2` + rolling deploys + HTTP/TCP health checks in `apps/api/fly.toml` are the concrete implementation of the "must never die" / 24/7 requirement.
- **Auth:** wallet-based (no email/password, no embedded/custodial wallet).
- **Frontend hosting:** Vercel, at https://NexusKey.vercel.app (project name/domain the user wants used).
- **Address normalization:** deterministic in-house string logic, no third-party geocoding API — see `packages/shared/src/property.ts`.
- **Verification validity period:** 90 days.
- **Public visibility:** both evidence URLs and claimant names are public on a claim's verification page.
- **MVP geographic scope:** US-only for V1.
- **Bond policy:** fixed protocol-wide minimums for both claim and challenge bonds (no claimant-set variable amounts in V1).
- **Lost-challenge settlement:** challenger's forfeited bond goes entirely to the claimant they wrongly challenged — no protocol treasury cut in V1.
- **GitHub repo:** https://github.com/zoefunds/NexusKey.git (remote `origin`). Was previously `zoefunds/NexusKey.git`; discarded per user request on 2026-08-01, full history (all commits) pushed fresh to the new repo.
- **Commit author email:** use `preciousmofeoluwa@gmail.com` for commits to this repo going forward (an earlier commit used `ayoolarachi@gmail.com`, which resolved to the wrong GitHub display name — always use `preciousmofeoluwa@gmail.com` now). Commit author name string doesn't matter (GitHub resolves display name by matching email to account); never add Claude as co-author.
- **Deployed GenLayer contract (StudioNet):** `0xA731B1407BFF53262742e45F1aD8dbb415736b73` — redeployed by the user on 2026-08-22, replacing `[OLD_CONTRACT_ADDRESS]` (itself a 2026-08-01 replacement of the original `[OLDER_CONTRACT_ADDRESS]`). Same constructor-style protocol constants as before (50 GEN claim/challenge bond minimums, 3-day contest window, 90-day verification validity). Set as `NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS` / `NexusKey_CONTRACT_ADDRESS` in local env files (never committed) plus the Fly secret and Vercel env var — see "Contract redeploy procedure" below. This redeploy included the conflict-grounding and expired-claim-exclusion fixes from the 2026-08-22 audit round (see below); the Postgres index was wiped and re-synced clean per the redeploy procedure.
- **Contract redeploy procedure (whenever the user redeploys and gives a new address):** update the address in all 4 places — `apps/api/.env` (`NexusKey_CONTRACT_ADDRESS`), `apps/web/.env.local` (`NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS`), the Fly secret (`fly secrets set --app NexusKey-api NexusKey_CONTRACT_ADDRESS=...`, which auto-redeploys), and the Vercel env var (`vercel env rm/add NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS production`, then redeploy). Then, per the user's explicit instruction, wipe the backend Postgres index so old-contract data never shows on the platform: `TRUNCATE TABLE claim_evidence_snapshots, claim_status_history, challenge_status_history, audit_log, challenges, claims, properties RESTART IDENTITY CASCADE;` then reset `sync_cursor` to 0/NULL — always confirm with the user first, this is destructive and irreversible. The actual Fly Postgres database name is `NexusKey_api` (list with `fly postgres connect --app NexusKey-db` then `\l` — the default `postgres` db is empty, don't truncate there).

## Design source of truth
Four HTML files + `DESIGN.md` in `~/Documents/design/NexusKey/` are the
**visual prototype only** — "Obsidian Registry" dark theme (`#121317` base,
`#1F2833` cards, `#3cdcd1` teal accent), Hanken Grotesk/Inter/JetBrains Mono
type system. They are rebuilt as real Next.js components in `apps/web`, not
copy-pasted.

## Contract reference material
- `~/Documents/Mark-collison-oracle` — approved prior GenLayer contract, read as reference for what a working, previously-accepted NexusKey-adjacent contract looks like.
- `~/Documents` (Eventweaver) — reference for staking/contract-timestamp patterns.
- Escrow pattern (mandatory): every payout reads ledger fields → zeros them in state → persists state → *then* calls a single `_send_gen` transfer helper. Never transfer before state is zeroed and saved. Top-of-function guard against re-entry: `if balance <= u256(0): raise gl.vm.UserError(...)`.
- **The user deploys the contract, not Claude.** Contract address must never be hardcoded — `NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS` / `NexusKey_CONTRACT_ADDRESS` stay blank until the user provides a real deployed address.
- Social-account verification (if/when built) must go through an actual OAuth/account connection flow, never a typed username field — this was an explicit instruction to prevent impersonation.

## Live deployment
- **Frontend:** https://NexusKey.vercel.app (Vercel project `NexusKey`, org `adebiyi2002gmailcoms-projects`, root directory set to `apps/web` via API since the CLI's `--repo` monorepo-link flow is alpha and unreliable non-interactively). **Deploy from the repo root** (`cd /Users/macbook/NexusKey && vercel --prod --scope adebiyi2002gmailcoms-projects`), not from `apps/web` — an `apps/web/.vercel/project.json` link previously pointed at a stale, differently-configured project (`"web"`, framework misconfigured as `"services"`) and broke the deploy; it was deleted. The root `.vercel/project.json` (projectId `prj_ZzpoaaLE5ueU8VhPZAVo74wy5byA`) is the correct link — don't recreate a nested one in `apps/web`.
- **Backend:** https://NexusKey-api.fly.dev (Fly app `NexusKey-api`, org `priscilla-george`, 2 machines for HA, min_machines_running=2). Migrated 2026-08-24 from org `personal`/ZOE PHOTOGRAPHY (`zoephotography2020@gmail.com`, which had billing issues) to a new Fly account's org `priscilla-george`, via `fly apps move NexusKey-api -o priscilla-george` — same app, same hostname, no redeploy needed. Login for CLI ops on this project is now whichever account is a member of `priscilla-george`.
- **Database:** Fly Postgres cluster `NexusKey-db-new` (name is a placeholder from the migration — **not** `NexusKey-db`, and can't be renamed without another full dump/restore, since Fly Postgres apps can't be renamed and `fly apps move` doesn't support Postgres apps at all; left as-is since the hostname is internal-only, never public-facing), attached to `NexusKey-api` (db name `NexusKey_api`, not `NexusKey`). Migrated 2026-08-24 by `pg_dump`/`pg_restore` through `fly proxy` tunnels (old cluster was Postgres 18.3 — needed `postgresql@18`'s `pg_dump`, not the default homebrew `pg_dump@16`, or restore fails with a version-mismatch error) into a freshly created cluster under `priscilla-george`, with a new `NexusKey_api` role/password set as `NexusKey-api`'s `DATABASE_URL` secret. Row counts verified identical before cutover. The old `NexusKey-db` app (under the old account) was destroyed after verification — the old account now has zero NexusKey resources.
- Deployed 2026-08-01, migrated to new Fly account 2026-08-24. Both verified live end-to-end (health checks, real contract reads through the frontend, backend API search endpoint).

## Repository state
Stages 1–6 (planning) approved. Stage 7 incremental implementation in
progress: repo foundation, shared types/enums package, env config
validation (frontend + backend), DB schema/migrations, backend API
skeleton (Express + health checks + Fly deploy config) are done. Remaining:
GenLayer contract, frontend pages, indexer logic against a real deployed
contract, tests, CI, full docs set.

## Post-launch QA fixes (2026-08-01)
Live manual QA by the user surfaced several real bugs/loopholes, all fixed and deployed:
- **Claim/challenge filing no longer auto-chains resolve.** `filePropertyClaim`/`challengePropertyClaim` used to immediately call `resolvePropertyClaim`/`resolvePropertyChallenge` inline in the same submit handler — this produced false-negative "resolution failed" errors when the underlying write actually succeeded but the frontend's own receipt-wait step threw. Both `claim/new` and `challenge/new` now redirect straight to the item's own detail page after filing, where an explicit "Resolve Now" button (permissionless, already reliable) is used instead.
- **Verify a Property now does fuzzy backend search**, not an exact canonical-property-key match. The old version hardcoded `stateOrRegion: ''` when computing the key client-side, which could never match any real claim (every claim requires a non-empty state) — search was silently broken. Now uses the backend's ILIKE search (`/api/v1/properties/search`) on partial street address + optional city/state, with a new `/verify/[propertyKey]` results page.
- **Claim details "File a Challenge" button is now gated by actual eligibility** — it used to render unconditionally. The contract already blocks a claimant challenging their own claim (`challenge_property_claim` in contract.py); the frontend now mirrors that plus the status/open-challenge checks so a wallet only sees the button when it would actually succeed.
- **Finalize Now is gated on the contest window having actually elapsed**, not just `status === 'CONTEST_WINDOW'` (which is true for the whole window, not just after it closes) — `finalize_uncontested_claim` reverts on-chain if called early. Revoke stays enabled the whole window since the contract allows it regardless (full refund).
- **Bond amounts display in GEN**, not raw wei, via `formatGen()` in `packages/shared/src/protocolConfig.ts`.
- **New "Open Challenges" discovery page** (`/challenges/open`, backed by `GET /api/v1/claims/challengeable`) lists every claim currently eligible for a challenge, so a challenger doesn't need to already know a specific address — distinct from `/dashboard/challenges` (the "Challenger Dashboard"), which only shows challenges the connected wallet has personally filed. Both are intentionally kept.

## Second-round audit fixes + live contract testing (2026-08-22)

An external audit (via Codex) went through 3 re-audit rounds against this
codebase, each surfacing real, verified issues; all were fixed, tested,
and deployed. Then a live end-to-end test — real signed transactions
against the deployed StudioNet contract, not mocks — surfaced one further
genuine production bug that no prior audit round caught. Commit range
`67c1cb6..6106322`.

**Contract-side fixes** (required a redeploy — new address above):
- Conflict-check (`_run_conflict_check`) now fetches and includes both
  the new claimant's and every incumbent claimant's actual evidence page
  content in the prompt, not just their URLs — previously a bond-transfer
  decision (`LIKELY_UNAUTHORIZED_DUPLICATE`) could be made without
  validators ever seeing the source material.
- Naturally-expired `VERIFIED` claims are now excluded from active-claims
  eligibility in *both* places that check it (`_active_claims_for_property`
  and the public `get_active_claims_for_property` view — the second one
  was a separate bug the first fix pass missed).
- Added an SSRF/web-access policy for evidence URLs (`_reject_ssrf_prone_host`)
  — rejects raw IP-literal hosts, localhost/`.internal`/`.local` suffixes,
  and embedded credentials before a URL is ever fetched by validators.
- Added `gltest` direct-test coverage (48 tests total) including
  adversarial prompt-injection framing checks and the SSRF policy.

**Frontend transaction-verification fixes** (`apps/web/lib/genlayerClient.ts`):
- `filePropertyClaim`/`challengePropertyClaim`/`renewPropertyClaim` return
  the real ID decoded from the transaction receipt instead of re-reading
  the global `total_claims`/`total_challenges` counter, which was racy
  under concurrent filers.
- `assertTransactionAccepted` applies to **every** write path now
  (`resolvePropertyClaim`, `finalizeUncontestedClaim`,
  `resolvePropertyChallenge`, `claimExpiredBond`, `revokePropertyClaim`
  previously bypassed it entirely).
- **The important one, found only by running real transactions:**
  `resultName` (camelCase) is *always* `undefined` on StudioNet — the
  field genlayer-js actually populates is `result_name` (snake_case,
  passed through verbatim from Studio's API), which carries the real
  consensus vote outcome (`MAJORITY_AGREE` / `MAJORITY_DISAGREE` / etc.).
  A transaction can reach `FINALIZED` with the leader's own
  `execution_result: 'SUCCESS'` while `result_name: 'MAJORITY_DISAGREE'`
  — GenVM finalizes it anyway *without committing its state change*.
  Caught live: `resolve_property_claim` returned `"CONTEST_WINDOW"` from
  the leader and reported FINALIZED/SUCCESS, but a same-instance re-read
  showed the claim was still `PENDING` — the write never applied. Fixed
  by checking `result_name` against an explicit allow-list
  (`AGREE`/`MAJORITY_AGREE`) in addition to the existing checks. See
  `docs/GENLAYER_CONTRACT.md`'s "Transaction finality" section.
- ACCEPTED-but-not-FINALIZED writes now show a visible provisional banner
  (`ProvisionalTxBanner`) on the claim/challenge detail page via a
  `?pendingTx=` query param, instead of presenting an appealable
  transaction as fully settled.
- `RenewClaimForm` no longer auto-chains `resolvePropertyClaim` inline
  after `renewPropertyClaim` — same false-negative failure mode already
  removed from ordinary claim/challenge filing.

**Backend fixes** (`apps/api`):
- `properties.active_claim_count` no longer counts a naturally-expired
  `VERIFIED` claim as active (mirrors the contract-side fix).
- **Indexer leader-election + incremental sync.** `NexusKey-api` runs 2 Fly
  machines for uptime, but the indexer previously ran unconditionally in
  *every* process, each independently polling GenLayer's shared public
  StudioNet RPC (5,000 req/day quota, shared across all its users) every
  15s, with a full `1..total_claims`/`1..total_challenges` rescan on
  every single poll — this exhausted the quota almost immediately and was
  the direct cause of a successfully-filed on-chain claim not showing up
  in Dashboard/Verify search (both backed by the Postgres index). Fixed
  with `apps/api/src/indexer/leaderLock.ts` — a Postgres session-level
  advisory lock so only one machine polls at a time, released
  automatically (by Postgres itself) if that machine crashes, so the
  other picks up the indexer role within one lock-check interval with no
  external coordination service — plus `getClaimIdsNeedingSync`/
  `getChallengeIdsNeedingSync` in `queries.ts` replacing the full rescan
  with "new IDs since last sync, plus rows whose status can still change."
  A rate-limit error now backs off 15 minutes instead of retrying every 15s.

**Live end-to-end contract test (2026-08-22):** ran real signed
transactions against every write method except `finalize_uncontested_claim`
and `claim_expired_bond` (both require real 3-day/90-day wall-clock waits
on this contract's deployed constructor args, declined in favor of
testing everything else exercisable now). Used two throwaway keypairs
generated for this purpose, funded by the user with StudioNet test GEN —
`contracts/NexusKey/.test-signers.json`, gitignored, never committed. Test
script: `contracts/NexusKey/.scratch/run_live_test.py` (left in place per
user request, not committed — `.scratch/` and the signer file are both
gitignored). Evidence fixtures live at `apps/web/public/test-evidence/*.txt`
on the deployed frontend (committed, since they're just static text). All
9 steps eventually finalized `MAJORITY_AGREE`/`SUCCESS` (one attempt hit
the MAJORITY_DISAGREE bug above and was correctly caught and retried after
the fix landed) — claims 2-5 and challenge 1 now exist for real on the
current deployed contract.

## Working style notes
- User does not want Claude listed as collaborator/co-author on commits — omit `Co-Authored-By` lines.
- User is on macOS, terminal-first; historically expected Python file-generation scripts for a non-tool-using AI, but this session has direct file-write/Bash tool access, so files are created directly instead.
