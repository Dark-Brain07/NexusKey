# NexusKey

> Before you trust a door, you look through the NexusKey first.

NexusKey is a bonded verification registry for **rental authority**. A
claimant stakes a GEN token bond behind a Rental Authority Claim; GenLayer
Intelligent Contract validators assess public evidence that cannot be
reliably judged by deterministic code alone; deterministic contract logic
owns claim status, bond custody, and settlement. Renters can search and
verify a property's claim status without connecting a wallet.

NexusKey is **not** a rental marketplace and does not verify property
*ownership* — it verifies rental *authority*, which may legitimately belong
to an owner, a property manager, an authorized agent, or an authorized
sublessor.

**Live:** [NexusKey.vercel.app](https://NexusKey.vercel.app) · API: `https://NexusKey-api.fly.dev` · Contract: GenLayer StudioNet

## How it works

1. **File a claim** — a claimant posts a GEN bond and public evidence
   (a URL substantively connecting them to the exact property/unit) backing
   a rental listing.
2. **Resolve** — a separate, permissionless call runs GenLayer validator
   consensus over the evidence (and, if the property has other active
   claims, a conflict check). Filing and resolution are deliberately split:
   filing is fast and deterministic, resolution is a slower nondeterministic
   round.
3. **Contest window** — once evidence passes, the claim enters a 3-day
   window during which anyone can **challenge** it (also bonded) with a
   reason and counter-evidence.
4. **Challenge resolution** — another permissionless, validator-judged call
   settles the challenge: the loser's bond is forfeited entirely to the
   winner (no protocol cut in V1); a genuinely inconclusive result returns
   both bonds unpenalized.
5. **Verified** — an unchallenged or successfully-defended claim becomes
   `VERIFIED` for a 90-day validity window, after which anyone can call
   `claim_expired_bond` to formalize expiry and refund the claimant in
   full. A claimant can also `revoke` their own claim anytime, and re-file
   later via `renew_property_claim` once a prior claim reaches a terminal
   state (`EXPIRED` / `REJECTED` / `REVOKED`).

Every one of these steps beyond the initial filing is **permissionless** —
anyone's wallet can call resolve/finalize/challenge-resolve, so a claim or
challenge can never get stuck waiting on one specific person to come back.

### Claim lifecycle

`PENDING → CONTEST_WINDOW → (CHALLENGED →) VERIFIED → EXPIRED`, with
`REJECTED` (evidence failed resolution) and `REVOKED` (claimant withdrew)
as additional terminal states reachable earlier in the flow.

### Challenge lifecycle

`PENDING → RESOLVED_CLAIMANT_WINS | RESOLVED_CHALLENGER_WINS`

## Monorepo layout

```
apps/web/          Next.js + TypeScript frontend (Vercel)
apps/api/           Backend API + blockchain indexer (Fly.io, always-on)
packages/shared/    Shared TS types, enums, address-normalization, protocol-config helpers
contracts/NexusKey/  GenLayer Intelligent Contract (StudioNet)
docs/               Architecture, contract, and security docs
```

## Frontend (`apps/web`)

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/how-it-works` | Product walkthrough |
| `/docs` | Protocol documentation |
| `/verify`, `/verify/[propertyKey]` | Public, walletless property search and claim-status lookup |
| `/claim/new` | File a Rental Authority Claim (multi-step form, posts bond) |
| `/claim/[claimId]` | Claim detail — full history, resolve/finalize/revoke/renew actions |
| `/challenge/new` | File a challenge against a claim (posts bond) |
| `/challenge/[challengeId]` | Challenge detail — resolve action, outcome |
| `/challenges/open` | Discovery feed of every claim currently eligible to be challenged |
| `/dashboard`, `/dashboard/challenges` | Connected-wallet's own claims and challenges |

The frontend never trusts a locally-cached default for anything that gates
a real transaction: bond minimums and the contest-window length shown on
`/claim/new` and `/challenge/new` are read live from the contract's
`get_protocol_configuration()` (via `getProtocolConfiguration()` in
`lib/genlayerClient.ts`), falling back to `PROTOCOL_DEFAULTS` only if that
read fails or no contract address is configured yet.

## Backend API (`apps/api`)

Read-only index of chain state — **no write endpoints**. Every state
change (filing, resolving, challenging, revoking, renewing, finalizing)
goes wallet → contract directly; the backend only ever mirrors what the
contract has already settled, via an indexer worker that syncs from chain.
`NexusKey-api` runs 2 Fly machines for uptime, but only one of them ever
polls chain state at a time — a Postgres advisory lock
(`apps/api/src/indexer/leaderLock.ts`) elects a single indexer leader and
fails over automatically if that machine dies, since polling GenLayer's
shared public StudioNet RPC from every machine independently exhausts its
shared daily quota.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/properties/search` | Fuzzy (ILIKE) search by street address, city, state |
| `GET /api/v1/properties/:propertyKey/claims` | All claims ever filed against a property |
| `GET /api/v1/claims/:claimId` | Full claim record |
| `GET /api/v1/claims/:claimId/status` | Lightweight status-only projection |
| `GET /api/v1/claims/challengeable` | Every claim currently eligible for a challenge |
| `GET /api/v1/challenges/:challengeId` | Full challenge record |
| `GET /api/v1/wallets/:address/claims` | Claims filed by a wallet |
| `GET /api/v1/wallets/:address/challenges` | Challenges filed by a wallet |

## Contract (`contracts/NexusKey`)

GenLayer Intelligent Contract, class `NexusKey`. Deterministic contract
logic owns claim/challenge status, bond custody, and settlement; validator
consensus is invoked only for the two nondeterministic assessment steps
(evidence/conflict check, challenge judgement).

**Write methods** (all permissionless except where noted):
`file_property_claim` (payable, bonded), `resolve_property_claim`,
`challenge_property_claim` (payable, bonded), `resolve_property_challenge`,
`finalize_uncontested_claim`, `claim_expired_bond`,
`revoke_property_claim` (claimant-only), `renew_property_claim` (payable,
bonded, claimant-only, requires a prior terminal claim).

**Read methods:** `get_claim`, `get_claim_status`,
`get_claims_by_property_key`, `get_active_claims_for_property`,
`get_challenge`, `get_protocol_configuration` (bond minimums, contest
window, verification validity, running claim/challenge totals).

Protocol defaults (mirrored, non-authoritative, in
`packages/shared/src/protocolConfig.ts` — the deployed contract's own
`get_protocol_configuration()` is always the source of truth): 50 GEN claim
bond minimum, 50 GEN challenge bond minimum, 3-day contest window, 90-day
verification validity.

See `docs/GENLAYER_CONTRACT.md` for the full method reference and
StudioNet deployment steps.

## Status

This repository is under active incremental build-out. See
[`memory.md`](./memory.md) for current infrastructure state, locked-in
decisions, and deployment details, and `docs/` for the full design set.

## Local development

Prerequisites: Node 20+, `pnpm`, Docker (for local Postgres), Python 3.11+
(for GenLayer contract tooling).

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres
pnpm --filter @NexusKey/api migrate
pnpm dev:api
pnpm dev:web
```

See [`memory.md`](./memory.md) for live Fly.io/Vercel deployment details
and `docs/GENLAYER_CONTRACT.md` for StudioNet contract deployment.

### Running tests

Three separate suites, each with its own setup:

**Shared package + frontend** (no external services needed):

```bash
pnpm --filter @NexusKey/shared test
pnpm --filter @NexusKey/web test
```

**Backend API** — runs against an isolated `NexusKey_test` Postgres database
so test runs never touch dev data. `apps/api/vitest.setup.ts` rewrites
`DATABASE_URL` from `.../NexusKey` to `.../NexusKey_test` automatically, but
that database has to exist and be migrated first:

```bash
docker compose up -d postgres
docker exec NexusKey-postgres psql -U NexusKey -d postgres -c "CREATE DATABASE NexusKey_test;"
DATABASE_URL=postgresql://NexusKey:NexusKey_dev_password@localhost:5544/NexusKey_test \
  pnpm --filter @NexusKey/api migrate
pnpm --filter @NexusKey/api test
```

The `CREATE DATABASE` step only needs to run once per local Postgres
volume — re-run the `migrate` step after pulling schema changes. Backend
tests truncate their tables between runs (see `beforeEach` in
`apps/api/src/__tests__/queries.test.ts`), so re-running is always safe.

**Contract** — direct in-memory tests via `gltest`, plus `genvm-lint`.
Neither is a normal npm dependency; both come from `contracts/NexusKey/requirements.txt`
into a dedicated venv:

```bash
cd contracts/NexusKey
python3 -m venv .venv-lint
.venv-lint/bin/pip install -r requirements.txt
.venv-lint/bin/genvm-lint contract.py
.venv-lint/bin/python -m pytest tests/direct -v
```

`tests/direct/test_NexusKey.py` mocks all `gl.nondet.web.render`/`gl.nondet.exec_prompt`
calls (see `vm.mock_web`/`vm.mock_llm` in that file) — no live GenLayer
network or StudioNet deployment is needed to run it.

## Important boundary

The GenLayer Intelligent Contract is the **authoritative** source for claim
status, bond custody, challenge status, and settlement. The backend
database is a read-optimized index of chain state, never a substitute for
it.
