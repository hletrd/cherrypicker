# Cycle 5 test-engineer review

Date: 2026-07-23
Baseline: `e3aa4241bbdc9c9b1dc3abff0df78e0cc9f8d715`

## Inventory and execution

I inventoried and reviewed all 109 executable test/spec files: 35 web, 25
parser, 9 CLI, 9 scraper, 7 scripts, 6 core, 6 rules, 2 viz, and 10 Playwright
specs. I also inspected `bunfig.toml`, both Playwright configurations, the
Vitest compatibility configuration, workspace test scripts, Turbo tasks, CI
ordering, skip/only/todo usage, fixed waits, conditional assertions, timer
fakes, process ownership, and generated-data/document checks.

Current execution results:

| Suite | Tests | Result |
|---|---:|---:|
| core | 168 | pass |
| parser | 1,620 | pass |
| rules | 93 | pass |
| viz | 10 | pass |
| web | 368 | pass |
| CLI | 79 | pass |
| scraper | 64 | pass |
| scripts | 55 | pass |
| Playwright regression | 93 | pass |

That is 2,457 unit/integration tests plus 93 browser tests with zero failures.
No active `.only`, `.skip`, or `.todo` was found. The fixed-delay and
conditional-pass defects reported in Cycle 4 are fixed and are not repeated.

## Finding

### C5-TEST-001 — Safe-money boundary coverage stops at core and never exercises the public visualization sinks

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed coverage gap with a confirmed current regression
- **Location:** safe boundary tests at
  `packages/core/__tests__/analysis.test.ts:8-67`,
  `packages/core/__tests__/calculator.test.ts:1442-1463`, and
  `packages/core/__tests__/optimizer.test.ts:442-463`;
  terminal coverage at
  `packages/viz/__tests__/terminal-sinks.test.ts:26-120`;
  report coverage at
  `packages/viz/__tests__/report.test.ts:72-338`;
  uncovered implementation at
  `packages/viz/src/terminal/summary.ts:25-50` and
  `packages/viz/src/report/generator.ts:267-290`;
  reachable command at `tools/cli/src/commands/analyze.ts:63-68`

The core suite correctly proves that two individually valid amounts must fail
when a monthly, performance, calculator, or optimizer aggregate becomes
unsafe. The two-file viz suite does not carry that invariant to the output
layer:

- `terminal-sinks.test.ts` passes one ordinary `10_000`-Won transaction and
  tests control-sequence sanitization only.
- `report.test.ts` uses ordinary `100_000`-Won fixtures and concentrates on
  escaping, CSP, disclosure, and placeholder behavior.
- No CLI command test supplies multiple individually valid rows whose sum
  exceeds `MAX_SAFE_INTEGER`.

Consequently the full green suite permits `printSpendingSummary` to print
`9,007,199,254,740,992원` for the mathematically exact sum
`9,007,199,254,740,993원`. This is not hypothetical missing coverage: the
focused current-HEAD probe reproduced the wrong output while every configured
suite remained green.

Failure scenario:

A future or current visualization consumer recomputes totals rather than using
the checked core result. Core tests continue to pass, terminal/report tests use
small fixtures, and the financial sink silently publishes a rounded total.
The same testing shape can miss any later duplicate aggregation introduced
outside core.

Suggested TDD sequence:

1. First add a failing terminal test with amounts
   `Number.MAX_SAFE_INTEGER` and `2`; assert an explicit safe-boundary error
   and assert that no partial summary is logged.
2. Add the same failing contract to `generateHTMLReport`, including
   cross-category and grand-total overflow.
3. Add a CLI `analyze` integration/process test proving the command exits
   nonzero with a stable Korean diagnostic for the same valid-per-row input.
4. Implement a shared checked aggregator and make all three tests pass.
5. Add controls for an exact-safe aggregate, zero/negative filtering, one
   category versus multiple categories, and ordinary totals.
6. Consider a contract test that searches/guards visualization money
   aggregation through the shared helper so a new unchecked `+=` cannot
   silently create a third path.

## Missed/skipped sweep

I reviewed all test files rather than sampling. The final sweep found no
unowned Playwright listener, hidden conditional skip, stale screenshot
substitution, or fixed-time card readiness wait. The one remaining reportable
gap is the visualization safe-money invariant above. Advisory scanning is
covered separately by the security review because it is a release-security
control rather than functional test coverage.
