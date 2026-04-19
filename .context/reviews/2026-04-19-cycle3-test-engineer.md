# Test Engineer Review — Cycle 3 (2026-04-19)

**Reviewer:** test-engineer
**Scope:** Test coverage gaps, flaky tests, TDD opportunities

---

## Findings

### C3-T01: No unit tests for the reward calculator (`calculateRewards`)

- **Severity:** HIGH
- **Confidence:** High
- **File:** `packages/core/src/calculator/reward.ts`
- **Description:** The `calculateRewards` function is the most critical function in the entire codebase — it computes the actual Won-denominated reward for each transaction. It handles performance tiers, monthly caps, per-transaction caps, global caps, fixed rewards, and various unit types. Despite its complexity and importance, there are NO unit tests for it. The only tests in the core package are for the categorizer.
- **Failure scenario:** A bug in `applyMonthlyCap` or `normalizeRate` could silently produce incorrect reward amounts, and no test would catch it.
- **Fix:** Add comprehensive unit tests for `calculateRewards` covering:
  - Basic percentage reward (1% of 10,000 = 100)
  - Monthly cap enforcement
  - Global cap enforcement with rule cap sync
  - Performance tier selection
  - Fixed reward with `won_per_day` unit
  - Per-transaction cap
  - Subcategory blocking (already partially tested via categorizer tests)
  - Negative amount and non-KRW filtering

### C3-T02: No test for `buildConstraints` and `greedyOptimize`

- **Severity:** HIGH
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts`
- **Description:** The greedy optimizer has no unit tests. This is the primary code path used by the web app. Edge cases like "all cards give 0 reward," "single card," "transactions with 0 amount," and "category with no matching rule" are untested.
- **Fix:** Add integration-level tests for the optimizer with realistic card rule sets and transaction lists.

### C3-T03: No tests for web-side XLSX parser

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/xlsx.ts`
- **Description:** The XLSX parser handles HTML-as-XLS normalization, Excel serial dates, 24 bank column configs, and various date formats. None of this is tested. The `packages/parser` has `xlsx-parity.test.ts` but that tests the Bun-side parser, not the browser-side one.
- **Fix:** Add unit tests for the XLSX parser that test:
  - HTML-as-XLS detection
  - Excel serial date parsing
  - All 24 bank column configs
  - Amount parsing (negative, comma-separated, parenthesized)

### C3-T04: E2E tests have `waitForTimeout(2000)` calls that introduce flakiness

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `e2e/ui-ux-review.spec.js:374,381,393`
- **Description:** Multiple E2E tests use `await page.waitForTimeout(2000)` to wait for cards to load. This is a hardcoded timeout that will be flaky: too short on slow connections, unnecessarily slow on fast ones. The correct approach is to wait for a specific DOM condition (e.g. card elements to appear).
- **Failure scenario:** On a CI server with slow network, the 2-second timeout is insufficient and tests fail intermittently.
- **Fix:** Replace `waitForTimeout(2000)` with `await page.waitForSelector('[data-card]')` or similar condition-based waits.

### C3-T05: No test for `toCoreCardRuleSets` type adapter

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:42-63`
- **Description:** The `toCoreCardRuleSets` adapter narrows the web `CardRuleSet` type to the core `CardRuleSet` type. It includes fallback logic for unknown source values and reward types. If the fallback logic has a bug (e.g. incorrectly mapping an unknown reward type to 'discount' when it should be 'points'), the optimizer would produce incorrect results.
- **Fix:** Add unit tests for the adapter with edge cases:
  - Unknown source value → 'web' fallback
  - Unknown reward type → 'discount' fallback
  - Valid values pass through correctly
  - Null unit → null normalization
