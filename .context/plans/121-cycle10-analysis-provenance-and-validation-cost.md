# Plan 121 — Cycle 10 Analysis Provenance and Validation Cost

**Findings:** C10-003 (Medium/High), C10-004 (Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- Every current analysis producer creates a `PreviousSpendingBasis`, but the
  current `AnalysisResult`, full/truncated coherence paths, and v4 persisted
  shape allow it to be absent.
- Coordinated deletion of `previousSpendingBasis` and
  `previousMonthSpendingOption` restores without warning, removes the user
  disclosure, and makes the next reoptimization fall back to statement-month
  spending.
- Fresh analysis performs exhaustive coherence validation in the analyzer and
  repeats it at the replacement runtime. The validator also materializes and
  sorts several whole-transaction arrays on the browser main thread.

## Outcome

Current results always retain coherent previous-spending provenance, and a
fresh trusted result is exhaustively validated only once before state commit.
Untrusted persistence still receives full fail-closed validation.

## Implementation

1. Make `previousSpendingBasis` required on current `AnalysisResult` values and
   validate it in both full and truncated coherence branches.
2. Require the current v4 persisted payload to contain a valid basis. Keep any
   legacy conversion inside migrations rather than weakening the current
   schema.
3. Require `previousMonthSpendingOption` to equal the `user-total` amount
   exactly and to be absent for `statement-month` and
   `missing-calendar-month`.
4. Add basis-only deletion, coordinated-deletion, truncated-payload, malformed
   agreement, disclosure, and reload-then-reoptimize tests.
5. Introduce an explicit validated-result boundary for fresh analysis so the
   replacement runtime can commit an already-validated producer result without
   rescanning it.
6. Retain exhaustive validation for session-storage deserialization and edited
   results. Refactor unavoidable full validation into linear passes without
   full date/month sorts or chained intermediate arrays.
7. Add an operation/call-count regression proving one producer-side full
   validation on normal analysis and a large synthetic linearity guard.

## Acceptance

- [x] No coherent current full or truncated result can omit its spending basis.
- [x] The redundant user option has exact, basis-dependent presence and value.
- [x] A v4 payload with either isolated or coordinated provenance deletion is
      rejected atomically.
- [x] Reload preserves the disclosed basis and the basis used by reoptimization.
- [x] Normal fresh analysis performs one exhaustive coherence validation, not
      two.
- [x] Untrusted persistence and edit-time state remain exhaustively validated.
- [x] Remaining validation work is linear in transaction count and retains all
      existing category, allocation, month, cap, and provenance witnesses.

## Execution note

`ralph` is unavailable. Prompt 3 will use focused persistence/coherence tests
and an instrumented validation-call regression before the complete gate
matrix. No correctness or performance finding in this plan is deferred.

## Completion evidence

- `AnalysisResult.previousSpendingBasis` is required. Full and truncated
  coherence validation now rejects a missing basis and enforces exact
  basis-dependent presence and value for `previousMonthSpendingOption`.
- Current v4 deserialization rejects isolated basis deletion, coordinated
  basis/option deletion, and missing or contradictory provenance in truncated
  payloads. A serialize/reload regression proves that both the user-facing
  disclosure and the next reoptimization consume the restored `user-total`
  basis exactly.
- The analyzer normalizes its persisted options, performs the exhaustive
  producer validation once, and returns a non-serializable
  `ValidatedAnalysisResult`. The replacement runtime accepts only that fresh
  boundary mark and performs no transaction rescan; an unmarked coherent clone
  is rejected before commit or persistence.
- Persistence deserialization and edited-result reoptimization retain their
  exhaustive `isAnalysisResultCoherent` checks. Transaction witnesses are
  collected in two linear passes without transaction-sized sorts or chained
  transaction arrays; the existing allocation, category, period, month, cap,
  identity, and provenance corruption regressions remain green.
- Test-first evidence: the new regressions initially exposed missing full and
  truncated basis acceptance, provenance deletion restore, exact-option
  mismatches, and three transaction-sized sorts. After implementation,
  `bun test` passed 197 tests across the 9 focused web files with 524
  expectations and 0 failures.
- `bun run --filter '@cherrypicker/web' typecheck`: 0 errors, 0 warnings,
  0 hints.
- `bun run --filter '@cherrypicker/web' lint`: 0 errors, 0 warnings, 0 hints.
- Protected Cycle 42 plan/reviewer artifact SHA-256 values match their recorded
  baselines exactly.
