# Plan 144: Cycle 17 Analysis Context Date Projection

**Finding:** C17-001 (Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- `packages/core/src/analysis/context.ts:51-77` owns the strict ISO calendar
  proof and year-month projection.
- `buildAnalysisContext()` validates each row during admission, then repeats
  the same proof for the final row and in the latest-month, previous-month,
  and monthly aggregation passes.
- With `N` accepted rows, the current route performs `4N + 1` strict
  validations rather than preserving the `N` admission proofs.
- The synchronous path is shared by browser analysis/reoptimization and CLI
  analysis, so redundant calendar work scales with every imported row.

## Implementation

1. Keep the current strict admission boundary and invalid-row quarantine.
2. Project each accepted row once into an internal
   `{ transaction, month }` entry and sort those entries by the existing date
   key.
3. Read the latest month from the projected final entry rather than
   revalidating its date.
4. Build `validTransactions`, `latestTransactions`,
   `previousTransactions`, and `monthlyTransactions` in one pass over the
   projected entries.
5. Preserve transaction object identity, stable date ordering, current
   previous-month provenance, empty-input behavior, and all existing period
   and safe-integer checks.
6. Add a deterministic regression that observes exactly one strict calendar
   proof for every input row, including rejected rows, without relying on a
   timing threshold.
7. Extend semantic coverage for invalid dates, leap days, unsorted input,
   January rollover, absent previous months, and valid/invalid mixtures.

## Acceptance

- [x] Every input row receives exactly one strict ISO calendar proof.
- [x] Invalid dates remain in `invalidTransactions` and never enter a monthly
      bucket.
- [x] Accepted transaction references and sorted order are unchanged.
- [x] Latest and previous month selection is unchanged at year boundaries.
- [x] Monthly totals, periods, provenance, and safe-integer failures match
      current semantics.
- [x] Browser and CLI callers require no contract change.

## Completion evidence

The requested `ralph` capability was unavailable, so Prompt 3 used the
approved disciplined manual fallback. The pre-fix operation-count regression
observed 18 `Date.UTC` calls for five rows. The completed implementation
observes exactly five calls, including one rejected calendar date, and keeps
the spy inside one synchronous `try`/`finally` scope.

The focused core suite passed 13 tests and 36 expectations. The combined core
and browser analysis-context matrix passed 331 tests and 1,640 expectations,
and the core workspace typecheck passed.

## Verification

Run the focused core analysis tests first, including the deterministic
operation-count regression and semantic parity cases. Then run:

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test`
- `bun run test:bun`
- `bunx vitest run`
- `bun run test:e2e`

Use the repository E2E ownership preflight and postflight checks. Do not
deploy.
