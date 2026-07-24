# Cycle 20 QA Tester Review

Date: 2026-07-24
Baseline: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`
Role: QA tester
Mode: review only; no implementation, browser/E2E run, commit, push, or deploy

## Result

No novel QA root cause was found.

One current regression gap was confirmed:

| ID | Severity | Confidence | Status |
| --- | --- | --- | --- |
| C20-B-001 | Low | High | Confirmed Plan 109 completion gap; not a new Cycle 20 root |

A truncated analysis snapshot can contain positive monthly spending with `transactionCount: 0`, pass both validation layers, be restored, and contribute to the displayed total. Existing tests cover nearby top-level and truncation cases but not this impossible per-month domain value.

## Test inventory

The review reused the complete tracked baseline inventory: 2,424 paths, including 1,172 active paths and 1,252 archived `.context` paths.

There are 181 active test/E2E support paths and 148 executable test/spec files:

| Suite area | Executable files |
| --- | ---: |
| Web | 57 |
| E2E | 10 |
| Core | 19 |
| Parser | 23 |
| Rules | 7 |
| Visualization | 3 |
| Scripts | 9 |
| CLI | 10 |
| Scraper | 10 |
| Total | 148 |

The Vitest include inventory resolves to 129 workspace test paths; the Bun-native E2E process test is deliberately excluded, leaving 128 paths in that runner. Package-local Bun tests and the Playwright suites retain their existing ownership. No active `.skip`, `.only`, or `.todo` marker was found.

The sweep covered production/test correspondence, malformed input, parser formats, analysis invariants, persistence migration/recovery, UI rendering, worker behavior, security boundaries, accessibility, responsive behavior, visual baselines, build freshness, and owned-process cleanup.

## C20-B-001 — missing per-month positive-count regression

### Reproduction and evidence

The production analyzer only creates a monthly bucket while processing a transaction and increments `transactionCount` for every transaction:

- `packages/core/src/analysis/context.ts:157-175,189-205`

Create a truncated result whose monthly breakdown contains an entry with positive `spending` and `transactionCount: 0`. The pure coherence validator currently accepts it because it rejects only counts below zero:

- `apps/web/src/lib/analysis-result.ts:926-984`

The persistence structural check also permits zero, and the deserialize path restores the record after the same coherence check:

- `apps/web/src/lib/persistence.ts:822-844,867-925`

The spending component sums that bucket:

- `apps/web/src/components/dashboard/SpendingSummary.svelte:31-37,105-108`

Expected behavior is rejection/removal of the malformed snapshot because no legitimate producer can emit a monthly bucket with zero transactions.

### Existing coverage gap

Nearby tests do not close this case:

- `apps/web/__tests__/analysis-result.test.ts:828-843` rejects a top-level zero transaction count, not a zero-count member of a truncated monthly breakdown.
- `apps/web/__tests__/analysis-result.test.ts:1073-1103` mutates monthly counts/spending but does not exercise the zero boundary for an individual bucket.
- `apps/web/__tests__/store-persistence.test.ts:630-667`
- `apps/web/__tests__/store-persistence.test.ts:1607-1629`
- `apps/web/__tests__/store-persistence.test.ts:1756-1800`

The persistence cases cover truncation provenance, fractional counts, latest facts, and corrupted-data handling, but not a positive-spending, zero-count older month.

### Required fix and regression cases

Require `transactionCount > 0` for every monthly bucket in both the pure result validator and persistence structural validation.

Add focused cases that prove:

1. the pure validator rejects a truncated bucket with positive spending and zero transactions;
2. deserialization rejects/removes the same persisted payload;
3. a bucket with zero spending and a positive transaction count remains valid;
4. ordinary truncated snapshots still round-trip;
5. full snapshots and current top-level count checks remain unchanged;
6. the rejected payload never reaches a renderable result state with a phantom total.

Run the focused validator/persistence tests first, then the complete web suite and repository checks. An E2E case is not required for this domain-validator repair unless implementation unexpectedly changes the UI recovery path.

## E2E process-safety audit

No browser, Chrome, or Playwright process was launched by this role. The owned-process runner and its tests were inspected:

- `scripts/run-e2e.ts:46-74,123-236`
- `scripts/e2e-runtime.ts:12-60`
- `scripts/e2e-processes.ts:148-194,332-359,368-517,521-578,689-799`
- `scripts/__tests__/e2e-processes.test.ts:83-121,240-268,354-407`

The runner:

- cleans stale repository-owned groups before a run;
- validates the exact run marker, repository root/cwd, and expected command before asserting ownership;
- sends TERM to the proven process group, then KILL only to exact surviving owned PIDs;
- refuses to promote an open port into kill authority without proven process ownership;
- verifies the recorded port is released;
- executes cleanup after command failure and preserves the original nonzero exit code.

The supplied Cycle 20 design run also recorded exact cleanup: session/tree/listener and preview were gone, the stuck daemon PGID and two exact stale commands were terminated, the temporary profile was moved recoverably to Trash, the wrapper was clean, and unrelated Chrome process 1368 was preserved.

For the repeated review loop, each cycle must perform the same ownership-scoped cleanup after any E2E/browser work. A failed cycle must be recorded but must not terminate the outer loop; the controller should proceed to the next cycle after cleanup while retaining the failed cycle's evidence and exit status.

## Historical reconciliation

Archived Plan 109 owns coherent monthly transaction counts, spending, persistence rejection, and stale-total prevention:

- `.context/plans/_archive/109-cycle8-analysis-coherence.md:17-21,23-42,44-63,65-76`

C20-B-001 is therefore a missing boundary regression for an existing accepted plan, not a new Cycle 20 root. Cycle 18 and Cycle 19 findings were checked as resolved. Known static-host CSP, parser duplication, performance, session-storage, mixed-runner, and coverage items were not duplicated.

## Verification

- Focused web tests: 215 tests passed with 543 expectations.
- Astro check: 126 files, zero errors, warnings, or hints.
- Dependency check: passed.
- Data check: passed for 683 cards, 24 issuers, and 551 executable records.
- E2E was intentionally not run for this review role.
- No deployment action was taken.

## Final sweep

The final test-to-production, boundary, runner-topology, skip-marker, persistence, UI consequence, and process-cleanup sweep found no additional confirmed, likely, or manual-check item. The six protected untracked Cycle 42 artifacts were neither opened nor searched. Only this assigned report pair was changed.
