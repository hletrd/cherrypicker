# Cycle 8 — test-engineer

## Inventory of test files

- `e2e/core-regressions.spec.js`
- `e2e/ui-ux-review.spec.js`
- `e2e/ui-ux-screenshots.spec.js`
- `e2e/web-regressions.spec.js`
- Unit tests across workspaces — all passing per `bun run verify` (turbo cache hit on all 10 tasks).

## Coverage posture (cycle 8)

E2E passes 74/74 after cycle 7's stabilisation. Major user flows covered:
- Upload → analyze → dashboard (the previously broken D6-01 path).
- Feature cards render (D6-02).
- Dashboard components: SavingsComparison, CategoryBreakdown, OptimalCardMap, TransactionReview (with bank pill 더보기 toggle).
- Empty-state resilience.

Gaps identified:
- No test for **rapid double-click on upload button** (D7-M3). Adding one would validate the `clearTimeout` defense and future-proof against timer stacking.
- No test for **aria-busy propagation** (D7-M10 after fix).
- No test for **-0 previousSpending** input (D7-M4 after fix).

## Rationale for NOT adding new tests in cycle 8

- Each of those would exercise UI state not visibly reported to users. Adding a test-then-fix pair is appropriate; adding them purely prophylactically risks flakes.
- The three 1-line fixes landed this cycle are best validated by: (a) `bun run verify` (typecheck + unit), (b) a spot `bun run test:e2e` run to confirm no regression in the existing 74 flows.

## New findings

### TE8-01 — e2e `reuseExistingServer` (D7-M7) should at minimum print a warning when port is already bound

- File: `playwright.config.ts:19`
- Severity: LOW / Medium
- Action: add a `console.warn` when `reuseExistingServer` resolves to `true` so cycle-running developers notice stale builds.
- Recommendation: defer (cosmetic, no regression risk).

### TE8-02 — spec `e2e/ui-ux-screenshots.spec.js` has zero `expect()` calls (D7-M9 confirm)

- Confirms D7-M9. Documented as intentional manual-smoke-harness. No change this cycle.

## Verification plan for cycle 8 fixes

1. `bun run verify` — expect 0-error exit.
2. `bun run build` — expect 0-error exit.
3. `bun run test:e2e` — expect 74/74 (no new tests this cycle; 0 regressions).

If any of the three fixes regress a flow, revert the specific commit and re-evaluate.

## Confidence: High — e2e suite is robust per cycle-7 stabilisation. Cycle 8's cleanup fixes should leave all gates green.
