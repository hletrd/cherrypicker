# Review-plan-fix Cycle 19 — test engineer

## Review identity

- Date: 2026-07-24
- Revision: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
- Role: test inventory, assertion quality, regression reachability, runner
  topology, and flake-risk review
- Disposition: one confirmed missing regression attached to `C19-CR-001`;
  **zero independently new test roots**
- Scope: review-only. No source, test, plan, generated data, deployment, or
  E2E gate was changed or run by this role.

## Inventory and coverage

The inventory found 181 tracked test/E2E paths:

| Surface | Test paths |
| --- | ---: |
| `apps/web` | 57 |
| `e2e` | 16 |
| `packages/core` | 19 |
| `packages/parser` | 49 |
| `packages/rules` | 7 |
| `packages/viz` | 3 |
| `scripts` | 9 |
| `tools/cli` | 10 |
| `tools/scraper` | 11 |

The root topology in `package.json:9-31`, `turbo.json:4-17`, and
`.github/workflows/deploy.yml:20-47` includes workspace tests, script tests,
the separate Bun parser/scraper matrix, Vitest, build checks, and the owned
Playwright wrapper. Cycle 18's calendar, publication, and `.mts`/`.cts`
regressions are present in their intended blocking suites.

The closing sweep checked skipped/isolated tests, conditional assertions,
global monkey patches, temporary-directory cleanup, wall-clock waits,
randomness, runner inclusion, exact diagnostic assertions, and tests for
each authored Cycle 18 production delta. Existing suppression comments in
old schema-negative tests and old timing observations have historical
ownership and were not relabeled as Cycle 19 findings.

## Attached regression gap for C19-CR-001

- Severity: Low
- Confidence: High
- Status: confirmed missing assertion; duplicate support for the code-review
  root rather than a separate finding
- Boolean boundary:
  `apps/web/src/lib/analysis-result.ts:893-981,988-1103`
- Persistence boundary:
  `apps/web/src/lib/persistence.ts:677-742,822-915`
- Existing calendar tests:
  `apps/web/__tests__/analysis-context.test.ts:34-66`
- Existing coherence tests:
  `apps/web/__tests__/analysis-result.test.ts:259-910`
- Existing persistence tests:
  `apps/web/__tests__/store-persistence.test.ts:148-266,632-696,1715-1750`

Cycle 18 tests the exact public predecessor-helper message for `0000-01`, but
does not separately assert the `RangeError` class. The validator suites do not
feed that accepted `YearMonth` into a truncated snapshot. As a result,
`hasCoherentTruncatedFacts()` reaches
`previousCalendarMonth(latest.month)` and throws before the boolean predicate
can reject the snapshot. `deserializeAnalysis()` performs the same coherence
call after its parsing/migration catch blocks, so the exception escapes its
documented corrupted-result channel.

Required regressions:

1. Strengthen the direct helper test to require both the `RangeError` class
   and its exact message.
2. Build a structurally valid truncated result whose latest and basis month
   are `0000-01`; assert `isAnalysisResultCoherent()` returns `false`.
3. Serialize the same current-version witness and assert
   `deserializeAnalysis()` returns the corrupted/removal result without
   throwing.
4. Retain a valid `0000-02` control to prove the fix rejects only the
   predecessor underflow.

The absence is deterministic and belongs to the product boundary in
`C19-CR-001`. No additional distinct current gap or flake mechanism survived
history reconciliation.

## Verification and final sweep

- `bun run toolchain:check`: passed on Bun 1.3.12.
- `bun run migrations:check`: passed.
- `bun run dependencies:check`: passed.
- `bun run data:check`: 683 cards, 24 issuers, generated data clean.
- `bun run docs:check`: 683 cards and 551 optimizer-executable cards matched.
- Browser/E2E execution was intentionally left to the designer and Prompt 3
  owned-run phases.

The six protected Cycle 42 paths were excluded from inspection and writes.
Final test-engineer-new finding count: **0**.
