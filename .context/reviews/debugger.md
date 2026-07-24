# Cycle 19 debugger review

Date: 2026-07-24
Baseline: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
Full provenance: `.context/reviews/2026-07-24-cycle19-debugger.md`

## Result

**1 genuinely new finding: C19-DBG-001 (Low / High confidence).**

This is the same root as `C19-VR-001` and should count once in the Cycle 19
aggregate.

## Inventory

The debugger sweep included every production, test, configuration,
generated-data, and workflow family in all 2,409 tracked paths, with exact
inspection of the 66 changed Cycle 18 paths. It traced date/month derivation,
full and truncated persistence, parser diagnostics, caught/swallowed
exceptions, worker/async ownership, filesystem/network cleanup, generator
phases, and dependency discovery. No browser, E2E, deployment, or source edit
was performed.

## C19-DBG-001 — `0000-01` turns a validation verdict into an exception

- Severity: **Low**
- Confidence: **High**
- Status: **confirmed**
- Public domain: `packages/core/src/analysis/context.ts:60-114`
- Truncated caller: `apps/web/src/lib/analysis-result.ts:922-981`
- Basis branch: `apps/web/src/lib/analysis-result.ts:893-920`
- Persistence admission/call:
  `apps/web/src/lib/persistence.ts:522-547,677-708,822-915`
- Store catch: `apps/web/src/lib/store.svelte.ts:117-148`

Failure trace:

1. `0000-01` passes `isYearMonth()`.
2. A truncated snapshot has no transactions, so its month facts are admitted
   directly from `monthlyBreakdown`.
3. `hasCoherentTruncatedFacts()` calls
   `previousCalendarMonth(latest.month)` before basis-kind handling.
4. The public helper raises the deliberate lower-bound `RangeError`.
5. `deserializeAnalysis()` does not catch coherence exceptions.
6. The store's outer catch removes the payload and reports storage access
   failure instead of corrupted state.

Both the coherence API and deserializer reproduced the exception. A second
coherence probe with `user-total` also threw, proving the predecessor is
computed unnecessarily. Normal uploaded statements use a narrower modern date
domain and the store recovers, which keeps severity Low.

Preserve the public helper error, but make validation total: skip predecessor
work for `user-total`, convert lower-bound failure to false coherence for
calendar bases, and add direct plus persisted no-throw tests. Keep
`0000-02 -> 0000-01` success distinct from the `0000-01` predecessor failure.

The exception escape is new in Cycle 18 commit `9cb5bfe`; historical lower-
year reports did not own this consumer regression.

## Final sweep

The calendar's other successful paths, publication hash/version phases, and
module-TypeScript discovery behave as designed. Focused suites passed 77
tests/185 expectations; data/dependency drift and core/web typechecks passed.
No second new debugger root survived.

Confirmed findings: **1**; likely: **0**; manual-only promoted: **0**.
