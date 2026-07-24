# Plan 141: Cycle 14 Reconciled Stateless Cap Prefix

**Finding:** C14-001 (`RPF14-PERF-001`, Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- `scoreCardsForTransaction()` replays each card's assigned prefix plus one
  appended transaction and passes the prefix length as
  `capSuppressionStartIndex`.
- The calculator uses that index only to suppress emitted rows. It still
  builds counterfactual candidates and groups, copies state, projects rules,
  accumulates transaction reward, and reconciles completeness for every older
  row.
- The real optimizer artifact has 551 executable cards, 383 capped executable
  cards, and only two stateful executable cards. The redundant path therefore
  applies to 381 capped stateless cards.
- Independent 1,000-row probes counted 322,389 to 340,779 avoidable historical
  counterfactual rows and roughly 0.13 to 0.29 seconds of host-dependent
  runtime, while retaining exact optimizer JSON and telemetry knownness.
- `PreparedCardRule.hasStatefulReward` already distinguishes `maxUses` and
  fixed-per-day histories that must retain ordered replay.
- A direct prepared call proves that `capSuppressionStartIndex` alone is not a
  completeness proof. An old stateless row can make telemetry incomplete even
  when it cannot emit. A naïve skip changes `capSuppressionsComplete` from
  false to true.

## Outcome

The optimizer may skip cap-free work for a stateless historical prefix only
when it explicitly asserts that the same prefix was already reconciled while
the portfolio completeness latch was true. Public calculations, ordinary
prepared calls, actual history, the appended row, and every stateful history
retain full behavior. Complete optimizer output and the distinction between
unknown, known-zero, and known-positive cap telemetry remain exact.

## Implementation

1. Add a deterministic regression that observes counterfactual grouping work
   without a wall-clock threshold. Use transaction-specific rule proxies or an
   equally passive invocation-local seam so the test can distinguish prefix
   rows from the appended row without a module-global counter or callback.
2. Add a default-off internal
   `prefixCounterfactualAlreadyReconciled` claim to
   `calculateRewardsWithPreparedCard()`. Document that only optimizer append
   scoring may assert it. Keep the prepared function and the claim absent from
   the public package barrel.
3. Validate that an asserted claim is used only with counterfactual collection
   and the exact append boundary
   `capSuppressionStartIndex === transactions.length - 1`. Invalid claimed
   boundaries must reject or conservatively retain full replay. Existing
   unclaimed start-index behavior remains unchanged.
4. Derive the skip inside the calculator from both the caller claim and the
   branded `preparedCardRule.hasStatefulReward === false` fact. The caller
   must not supply or override statefulness.
5. In the kernel, derive one row-local
   `collectTransactionCounterfactual` value. Use it consistently for:
   - suppression emission;
   - `findRules()` counterfactual candidate/group/projection work;
   - transaction applied-reward accumulation; and
   - reservation/completeness reconciliation.
6. Continue actual rule selection, cap consumption, reward execution,
   diagnostics, safe arithmetic, and category/card totals for every historical
   row. Continue the full counterfactual path for the appended row.
7. Have only `scoreCardsForTransaction()` opt in, and only when its monotonic
   `collectPortfolioTelemetry` input is true and suppression collection is
   enabled for the capped card. Do not persist or cache the claim.
8. Add stateless controls requiring prefix counterfactual group reads to
   disappear while current-row reads and complete output stay equal.
9. Add `maxUses` and fixed-per-day controls requiring every historical
   counterfactual row to remain. Preserve the existing negative-offset,
   cross-card ambiguity, and final stateful replay tests.
10. Keep the unsafe direct prefix fixture incomplete without the claim. Add a
    full optimizer control proving an early unknown result never becomes known
    again on a later row.
11. Run the existing prepared-card, cap-loss, optimizer, worker, analysis,
    persistence, visualization, and CLI suites. Retain deterministic
    randomized and real-artifact exact-output/knownness comparisons.

## Acceptance

- [x] A proven stateless prefix performs no counterfactual grouping,
      projection, applied-reward accumulation, or reconciliation work.
- [x] Actual history and the appended row remain fully evaluated.
- [x] `maxUses` and fixed-per-day cards retain complete ordered
      counterfactual histories.
- [x] An ordinary/direct prepared call with a nonzero start index keeps its
      current full completeness semantics.
- [x] The unsafe capped-priority/uncapped-fallback fixture remains incomplete
      without the optimizer claim.
- [x] The claim rejects or falls back for a non-append boundary and cannot be
      enabled when suppression collection is disabled.
- [x] Only optimizer append scoring supplies the claim, and only while the
      portfolio completeness latch is true.
- [x] Public `calculateRewards()` and package exports do not gain an unchecked
      mode.
- [x] Full optimizer results preserve assignments, totals, diagnostics,
      losses, ordering, and `undefined` versus present-array knownness.
- [x] No incremental optimizer, cross-invocation cache, or public schema
      change is introduced.

## Verification

Run focused Cycle 13/14 calculator, optimizer, worker, persistence,
presentation, and CLI tests, then `bun run lint`, `bun run typecheck`,
`bun run build`, `bun run test`, `bun run test:bun`,
`bunx vitest run`, and `bun run verify`. Finish with `bun run test:e2e`,
`bun scripts/run-e2e.ts status --assert-clean`, TCP 4173, isolated browser
session, exact owned-process, and temporary-profile cleanup checks.

## Completion evidence

- Signed implementation commit
  `5edff677a3da0c7fa08152adb59320ce530ef6be` added the private,
  default-off append-prefix proof, callee-owned stateless gate, row-local
  counterfactual gate, optimizer-only opt-in, and deterministic regression
  suite.
- The regression was genuinely red against parent
  `c1f9d40a40a4a97de169da14eff46ccdfaf99968`: 2 tests passed and 3 failed
  across 22 assertions. It observed the old stateless grouping counts
  `[2, 2, 2]` instead of `[1, 1, 2]`, accepted a collection-disabled claim
  instead of rejecting it, and produced optimizer counts `[11, 8, 5]`
  instead of `[9, 7, 5]`. Stateful and unsafe-direct controls already passed.
- The implemented focused matrix passed 80 tests with 267 assertions,
  including stateless operation counts, invalid-claim guards, `maxUses`,
  fixed-per-day history, unsafe direct/public knownness, and optimizer
  completeness. An independent code audit passed its 44-test matrix plus core
  lint and typecheck.
- Final gates passed: lint, typecheck, all seven workspace builds, all
  repository tests, 1,641 Bun tests with 3,319 expectations, 127 Vitest files
  with 3,110 tests, the full `verify` chain, and all 97 E2E tests.
- E2E cleanup finished clean: no owned runs, no TCP 4173 listener, no isolated
  browser session, and no repository/profile process remained. No gate fix or
  deployment was required.

## Execution note

The requested `ralph` capability was unavailable. Prompt 3 used the approved
manual disciplined fallback: it added deterministic failing regressions,
implemented the smallest proof-gated row-local change, ran focused green and
exact parity checks, then ran every repository gate. No deployment occurred.
