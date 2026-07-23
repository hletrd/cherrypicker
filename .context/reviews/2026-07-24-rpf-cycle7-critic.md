# Cycle 7 critic report

- Review date: 2026-07-24
- Reviewed HEAD: `3086a379e31e5b17f82401807f5b3c24325b9962`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: adversarial contract checking, state coherence, and whether passing
  tests establish the user-facing claim
- Findings: 1 (`1 Medium`)

## Inventory and coverage

I inventoried all 2,175 tracked paths and reviewed the 417 active
implementation/test/configuration/documentation/fixture files across web,
core, parser, rules, visualization, CLI, scraper, scripts, E2E, and root
configuration. The 683 authored card files and 30 generated artifacts were
covered through exhaustive parsing, semantic validation, publication checks,
and targeted contract queries. Historical `.context` material was searched for
duplicates and fixed findings rather than treated as current code.

The critic trace challenged green tests and graceful-degradation claims across
parsing, categorization, calculation, optimization, persistence restoration,
reoptimization, dashboard/report output, catalog loading, and CLI behavior.

## Finding

### C7-CT-001 — Persistence drops corrupt transactions but displays optimization computed from them

- Severity: **Medium**
- Confidence: **High**
- Classification: **confirmed**
- Regions:
  - `apps/web/src/lib/persistence.ts:606-624,674-715`
  - `apps/web/src/lib/tx-validation.ts:46-102`
  - `apps/web/src/lib/store.svelte.ts:159-176,203-210`
  - `apps/web/src/components/dashboard/SpendingSummary.svelte:86-158,199-215`
  - Behavior-enforcing tests:
    `apps/web/__tests__/store-persistence.test.ts:198-225,698-720`

During restoration, `deserializeAnalysis()` filters `migrated.transactions`
through `isOptimizableTx()`. If any transaction fails, it marks the result
`corrupted` but returns the surviving transactions together with the original
persisted `optimization`, `monthlyBreakdown`, transaction counts, and periods.
It neither recomputes nor invalidates those derived values.

This is not merely an untested edge case. The test named “filters corrupted
transactions while preserving valid optimization” explicitly requires an
optimization assignment to survive after the only transaction has been
discarded. Another test confirms that a transaction with an invalid persisted
fuel-volume fact is removed while the rest of the analysis object remains.

The dashboard then renders total spending, effective rate, top category, card
assignments, and recommendations from that preserved optimization. The small
corruption banner says to analyze again but does not suppress the stale
financial result.

Why it matters: the restored object violates its core invariant that
optimization and summaries are derived from the transaction set. A corruption
event can remove exactly the transaction that earned a reward while leaving
the reward and recommendation visible as current output.

Concrete scenario: a stored analysis includes one otherwise valid fuel
transaction whose `fuelVolumeLiters` is corrupted to `200.01`. Restoration
removes that transaction (the existing test confirms this boundary), but the
dashboard continues displaying the persisted fuel reward, spending, effective
rate, and assigned card calculated before it was removed.

Root fix:

- Treat transaction and derived analysis as one coherence domain. If a
  transaction is rejected, either reject/remove the current payload atomically
  or clear all derived optimization/summary state until it can be recomputed
  from the retained transactions.
- Keep the intentional size-truncation snapshot path distinct: an explicitly
  omitted transaction array can preserve a historical result with a clear
  non-editable disclosure, but a partially corrupt array must not masquerade as
  a coherent live result.
- Replace the current preservation test with invariant tests that recompute or
  reject after one material transaction is removed, and assert the dashboard
  cannot render stale recommendations.

## Verification

- `bun run verify` passed at the reviewed HEAD, including all persistence unit
  tests. The passing test is part of the evidence because it codifies the
  inconsistent behavior.
- The restore-to-dashboard data flow was traced directly through the files
  cited above.
- No source, plan, protected Cycle 42 artifact, commit, branch, deployment, or
  external state was changed.

## Final missed-issue sweep

The final sweep challenged partial-corruption handling, migration/version
boundaries, transaction/optimization count and amount coherence, reoptimization
ownership, warning presentation, parser parity, catalog fail-closed claims, and
CLI input binding. No additional distinct critic finding survived the
duplicate/current-impact threshold.
