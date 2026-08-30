# NexusKey Intelligent Contract

`contracts/NexusKey/contract.py` — one production contract, deployed once to
GenLayer Studio's StudioNet. This document is the design rationale behind
it; read it alongside the contract's own module docstring, which states
the same rules more tersely for in-editor reference.

## Non-determinism budget

Three nondet operations, each gated by a cheap deterministic check that
skips it whenever it isn't needed:

1. **`_run_evidence_check`** — fetches `evidence_url` via
   `gl.nondet.web.render` and classifies it into `EVIDENCE_VERIFIED` /
   `EVIDENCE_INSUFFICIENT` / `EVIDENCE_CONTRADICTED` via
   `gl.eq_principle.prompt_comparative`. Runs once per
   `resolve_property_claim` call — always, since every claim needs an
   evidence judgement.
2. **`_run_conflict_check`** — only invoked when `property_index` already
   has other active claims for the same `property_key`. Classifies the new
   claim against up to `MAX_NEIGHBORS_FOR_CONFLICT_JUDGEMENT` (3) existing
   active claims into `NO_CONFLICT` / `AUTHORIZED_SECONDARY_CLAIM` /
   `LIKELY_UNAUTHORIZED_DUPLICATE` / `CONFLICTING_CLAIM` / `UNCERTAIN`.
3. **`_run_challenge_check`** — invoked once by
   `resolve_property_challenge`. Fetches both the claim's and the
   challenger's evidence URLs and classifies into `CLAIMANT_AUTHORIZED` /
   `CHALLENGER_CORRECT` / `UNCERTAIN`.

Everything else — validation, bond arithmetic, status transitions, the
property-index lookup, storage writes — is deterministic.

## What stays deterministic

Access control (claimant/challenger identity), all bond arithmetic and
zero-then-transfer ordering, status transitions, expiry computation
(`_is_currently_verified` is computed live from wall-clock time on every
read, never cached), input validation, and output sanitization of every
model response into one of a small fixed enum.

## Failure and abstention semantics

- **Evidence fetch fails, or the model returns `EVIDENCE_INSUFFICIENT`:**
  never treated as fraud. Routes to `CONTEST_WINDOW`, a bonded dispute
  window, never to automatic rejection (Principle 3).
- **`EVIDENCE_CONTRADICTED`:** the only evidence-only path that rejects
  automatically — the evidence must have *actively* contradicted the
  claim, not merely failed to confirm it.
- **Conflict check returns `CONFLICTING_CLAIM` or `UNCERTAIN`:** routes to
  `CONTEST_WINDOW`, never to automatic rejection. Only
  `LIKELY_UNAUTHORIZED_DUPLICATE` rejects automatically.
- **Challenge resolution returns `UNCERTAIN`:** the claim reverts to
  `VERIFIED` with its original expiry untouched, and the challenger's bond
  is simply returned — no party is penalized for a genuinely inconclusive
  dispute.
- **Model output unparseable / missing fields / claim-ID mismatch:**
  defaults to the safe direction for each judgement —
  `EVIDENCE_INSUFFICIENT` for evidence, `UNCERTAIN` for conflict and
  challenge banding — never to the outcome that would move money or
  clear a claim without real evidence.

## Storage design

- `claims: TreeMap[u256, Claim]` — one entry per claim, `@allow_storage`
  dataclass, growing/append-only (the audit trail itself).
- `challenges: TreeMap[u256, Challenge]` — same pattern.
- `property_index_head: TreeMap[str, u256]` + `property_claim_count: TreeMap[str, u32]`
  — property_key to the most recently filed claim_id on it, forming the
  head of a singly linked list threaded through each `Claim`'s own
  `prior_property_claim_id` field. Walking the list from the head (bounded
  by `property_claim_count`, itself capped at `MAX_CLAIMS_PER_PROPERTY_KEY`
  = 64) visits every claim ever filed on that property. This replaced an
  earlier `TreeMap[str, DynArray[u256]]` design — a container type nested
  inside another container type — as a defensive simplification (see the
  header-format note below for what the actual "Could not load contract
  schema" root cause turned out to be). Every storage field in this
  contract is now a flat `TreeMap` keyed by `u256` or `str`, valued by
  either an `@allow_storage` dataclass or a sized integer — no nested
  generics. This is core to conflict detection (the contract's actual
  value), not a per-user convenience index — a per-*wallet* "list my
  claims" index was deliberately **not** added to storage; that query is
  served by the off-chain indexer in `apps/api` instead.
- `next_claim_id`, `next_challenge_id`: `u256` monotonic counters, never
  reused, which is what makes challenge/claim IDs replay-proof.
- `claim_bond_min`, `challenge_bond_min`, `contest_window_seconds`,
  `verification_validity_seconds`: immutable, set once in `__init__`, no
  setter anywhere in the contract.

(Historical note: an earlier draft used `DynArray[u256]` directly inside
`property_index`. Two separate problems surfaced with that shape before it
shipped: `DynArray` is a storage-only view type that cannot be constructed
directly — `DynArray[u256]()` raises `TypeError` by design, caught by
direct testing — and, after switching to the list-assignment workaround,
Studio's schema loader still rejected the resulting nested-container
field. Both are why the linked-list design above uses only flat `TreeMap`
storage now.)

## Bond and settlement design

Bond remains **locked for the entire life of a `VERIFIED` claim** — it is
*not* returned the moment a claim reaches `VERIFIED`. This is a deliberate
refinement over a naive "verified means bond returned" model: if the bond
were released immediately, there would be nothing left to forfeit to a
successful challenger later. Bond is only released on:

| Exit | Claimant bond | Challenger bond |
|---|---|---|
| `REJECTED` — evidence contradicted, no existing claim to compensate | forfeited to protocol reserve (zeroed, never transferred — no withdrawal path exists in V1) | n/a |
| `REJECTED` — likely unauthorized duplicate | forfeited to the existing (incumbent) claimant | n/a |
| `VERIFIED` reached, uncontested, claim later expires (`claim_expired_bond`) | refunded in full — expiry is not wrongdoing | n/a |
| `REVOKED` before ever reaching `VERIFIED` | refunded in full | n/a |
| `REVOKED` after having been `VERIFIED` at least once | forfeited to protocol reserve (discourages bait-and-switch listings) | n/a |
| Challenge resolved `CLAIMANT_AUTHORIZED` | remains locked, unaffected | forfeited to the claimant |
| Challenge resolved `CHALLENGER_CORRECT` | forfeited to the challenger | refunded to the challenger |
| Challenge resolved `UNCERTAIN` | remains locked, unaffected | refunded to the challenger |

Every payout follows the same ordering, with no exceptions: **read the
ledger field → zero it → persist state → only then call `_send_gen`.** A
second call into an already-settled claim or challenge finds its ledger
field already zero and raises before any transfer is attempted — this is
what makes double-settlement structurally impossible rather than merely
unlikely.

## Renewal is terminal-state-only

`renew_property_claim` only accepts a claim in `EXPIRED`, `REJECTED`, or
`REVOKED`. Renewing from an active `VERIFIED` claim is intentionally out
of scope for V1 — allowing it would create two simultaneously-active
claims for the same claimant/property with two separate bonds, which
complicates conflict detection and challenge targeting for no clear
benefit. A claimant who wants to refresh evidence while still verified
should revoke, then renew — an explicit two-step action rather than an
implicit one.

## Trust model

No admin or owner role exists anywhere in this contract. Protocol
constants are fixed once in `__init__`. `resolve_property_claim`,
`finalize_uncontested_claim`, and `resolve_property_challenge` are all
permissionless — anyone may call them once their preconditions are met, so
no claimant or challenger is ever blocked waiting on a privileged party.

## Equivalence principles

The full prose for `EVIDENCE_PRINCIPLE`, `CONFLICT_PRINCIPLE`, and
`CHALLENGE_PRINCIPLE` lives at the top of `contract.py`. All three are
`prompt_comparative` — never `prompt_non_comparative` — because every one
of them ultimately gates a fund transfer or a public verification status,
never a decision that's safe to leave to majority-format-matching alone.

## Runner comment header format (root cause of an earlier "Could not load contract schema" error)

The two-line comment at the very top of `contract.py` is not decorative —
it's parsed directly by GenVM before anything else runs. GenVM Studio's
`gen_getContractSchemaForCode` RPC failed with `invalid_contract` /
`absent_runner_comment` / `runner comment does not start with version`
until the header matched this exact shape, confirmed against GenLayer's
own canonical `wizard_of_coin.py` example contract:

```python
# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

Line 1 must be a literal `# v<engine-version>` tag matching the GenVM
engine version the target Studio instance reports in its own logs (visible
in `genvm_common`'s `logging initialized` log line — check this before
assuming `v0.2.16` is still correct for a different Studio deployment).
Line 2 is a single-line `# { "Depends": "..." }` comment — not the
multi-line `# { "Seq": [...] }` wrapper this file used in two earlier,
incorrect attempts, which is apparently valid syntax elsewhere but was not
what this Studio instance's GenVM engine expected here. If the schema
still fails to load after matching this format, re-check the Studio
instance's reported GenVM version first — a version mismatch between the
header's `v...` tag and the actual running engine reproduces the same
failure.

`genvm-lint`'s local schema validation passed against this contract at
every stage of this investigation, including the two incorrect header
formats — its bundled validator does not enforce the exact same
comment-parsing rules as the hosted Studio GenVM engine. Passing
`genvm-lint` is necessary but was not, in this case, sufficient proof that
Studio would accept the file; the only way to confirm the header format is
to check what a contract already confirmed working on the *target* Studio
instance actually uses.

## Transaction finality & consensus disagreement (learned from live testing)

Reaching a "decided" transaction status and the leader's own execution
completing without error are **both necessary but not sufficient** proof
that a write actually took effect. There is a third, distinct failure
mode a caller must check for: validators can **majority-disagree** with
the leader's result. When that happens, GenVM still finalizes the
transaction (it doesn't hang forever), but does **not** commit the
leader's state change.

This was caught live, not in theory: a `resolve_property_claim` call
returned `"CONTEST_WINDOW"` from the leader, and the transaction reported
`status: FINALIZED` with the leader's `execution_result: 'SUCCESS'` — by
every check a naive caller would run, this looked like a fully successful
write. But the transaction's `result_name` field was `MAJORITY_DISAGREE`,
and re-reading the claim from the contract immediately afterward showed
its status was still `PENDING` — the write had never applied.

**What to actually check**, in order, before trusting any write's return
value or the state it's supposed to have changed:

1. **Status** is `ACCEPTED` or `FINALIZED` (not `UNDETERMINED`,
   `CANCELED`, `LEADER_TIMEOUT`, or `VALIDATORS_TIMEOUT`). Note a poll can
   race straight past `ACCEPTED` to `FINALIZED` before the first check
   catches it — don't require exact equality to `ACCEPTED` alone.
2. **`result_name`** (the transaction-level consensus *vote* outcome) is
   `AGREE` or `MAJORITY_AGREE` — never `MAJORITY_DISAGREE`, `NO_MAJORITY`,
   `TIMEOUT`, or `DETERMINISTIC_VIOLATION`. This is the field that
   actually tells you whether the state change committed.
3. **The leader's own `execution_result`** (inside
   `consensus_data.leader_receipt[0]`) is `SUCCESS`, not `ERROR` — this
   catches a Python-level revert (`gl.vm.UserError`) even when consensus
   agreed on the fact that it reverted.

**Field-name gotcha (genlayer-js specifically):** on StudioNet, the
camelCase `resultName`/`statusName` fields the SDK computes are only
populated by its non-Studio (testnet/mainnet on-chain) decode path — on
StudioNet they're always `undefined`. The fields that are actually
populated are the raw snake_case `result_name`/`status_name`, passed
through verbatim from Studio's own API response. A check against
`resultName` silently no-ops on every real StudioNet transaction. See
`apps/web/lib/genlayerClient.ts`'s `assertTransactionAccepted` for the
corrected implementation, and GenLayer's own Python SDK
(`genlayer_py/assertions.py`'s `tx_execution_succeeded`) for the
equivalent check against `consensus_data.leader_receipt[0].execution_result`
that this contract's own `.scratch/run_live_test.py` test runner mirrors.

## Deployment checklist

1. `python3 -m venv .venv-lint && .venv-lint/bin/pip install -r requirements.txt`
2. `.venv-lint/bin/genvm-lint check contract.py --json` — expect `"ok":true` with 0 `errors`.
3. `.venv-lint/bin/python -m pytest tests/direct/ -v` — expect all tests passing.
4. Deploy via the GenLayer CLI (`genlayer deploy`, per current CLI docs) to
   StudioNet, providing constructor args `claim_bond_min`,
   `challenge_bond_min`, `contest_window_seconds`,
   `verification_validity_seconds` (wei / seconds — defaults in
   `contract.py` are 50 GEN / 50 GEN / 3 days / 90 days).
5. Record the deployed contract address. **This step is done by the
   project owner, not by an automated agent** — provide the address back
   to configure `NexusKey_CONTRACT_ADDRESS` /
   `NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS`.
6. Run `genlayer schema` against the deployed address and confirm it
   matches the 14 methods (6 view, 8 write) validated by `genvm-lint`
   locally — a mismatch here is the "could not load contract schema"
   failure mode and must be resolved before any frontend/backend wiring.

## Post-deployment verification checklist

Verified live against `0xA731B1407BFF53262742e45F1aD8dbb415736b73` on
2026-08-22 via `contracts/NexusKey/.scratch/run_live_test.py` (real signed
StudioNet transactions, each awaited to `FINALIZED` with `result_name`
checked before the next was queued — see "Transaction finality" above).

- [x] `get_protocol_configuration()` returns the expected bond minimums and windows.
- [x] `file_property_claim` succeeds with the minimum bond.
- [x] `resolve_property_claim` reaches `VERIFIED` on a real evidence URL judged favorably by validators.
- [x] A second claim on the same `property_key` triggers the conflict-check nondet round (reached `AUTHORIZED_SECONDARY_CLAIM`).
- [x] `challenge_property_claim` succeeds from a separate wallet.
- [x] `resolve_property_challenge` settles a real challenge (reached `UNCERTAIN` → `RESOLVED_CLAIMANT_WINS`, no penalty).
- [x] `revoke_property_claim` succeeds from `VERIFIED` (bond forfeited to protocol reserve, as designed).
- [x] `renew_property_claim` succeeds from `REVOKED`, and the renewed claim resolves to `VERIFIED`.
- [ ] `file_property_claim` reverts below the minimum bond — covered by `gltest` direct tests, not re-verified live.
- [ ] `challenge_property_claim` reverts for the claimant's own wallet — covered by `gltest` direct tests, not re-verified live.
- [ ] `claim_expired_bond` reverts before expiry and succeeds after — **not exercisable live** without waiting out the real 90-day `verification_validity_seconds` on this deployed contract; `gltest` direct tests cover both branches with mocked time.
- [ ] `revoke_property_claim` reverts while `CHALLENGED` — covered by `gltest` direct tests, not re-verified live.
- [ ] `finalize_uncontested_claim` — **not exercisable live** without waiting out the real 3-day `contest_window_seconds`; covered by `gltest` direct tests with mocked time.
