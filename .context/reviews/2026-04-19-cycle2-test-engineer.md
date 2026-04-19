# Test Engineering Review — Cycle 2 (2026-04-19)

Reviewer: test-engineer angle
Scope: Test coverage, flaky tests, TDD opportunities

---

## Finding C2-T01: No unit tests for web-side parser modules

**Files:**
- `apps/web/src/lib/parser/csv.ts` (954 lines, 10 bank adapters)
- `apps/web/src/lib/parser/pdf.ts` (318 lines)
- `apps/web/src/lib/parser/xlsx.ts` (441 lines)

**Severity:** HIGH
**Confidence:** High

The web-side parsers have zero unit tests. The `packages/parser` has tests (`packages/parser/__tests__/csv.test.ts`, `detect.test.ts`, `xlsx-parity.test.ts`) but these test the Bun-side implementations, not the browser-side ports. Since the web parsers were independently ported, they could have bugs not caught by the package-level tests.

Key areas needing tests:
1. Each bank adapter's CSV parsing with real sample data
2. `inferYear` heuristic at different times of year
3. PDF fallback parser with various text layouts
4. XLSX HTML-as-XLS detection and normalization
5. `detectBank` accuracy with mixed-bank content

---

## Finding C2-T02: No integration tests for the full analyzer pipeline

**Files:** `apps/web/src/lib/analyzer.ts`

**Severity:** HIGH
**Confidence:** High

The `analyzeMultipleFiles` and `optimizeFromTransactions` functions have no test coverage. These are the critical path — they orchestrate parsing, categorization, and optimization. A regression here could silently produce wrong reward calculations.

**Fix:** Add integration tests that:
1. Parse a fixture CSV file
2. Categorize its transactions
3. Optimize card assignments
4. Verify total rewards match expected values

---

## Finding C2-T03: E2E tests have no assertions on calculated reward values

**File:** `e2e/ui-ux-review.spec.js:606-638`

**Severity:** MEDIUM
**Confidence:** High

The data integrity tests check that `totalReward` equals the sum of `cardResults[].totalReward` and `totalSpending` equals the sum of `assignments[].spending`. These are consistency checks, not correctness checks. A bug that halves all rewards would pass these tests.

**Fix:** Add a test that verifies the reward calculation against a known expected value for the fixture data. The expected value should be pre-computed manually or verified against the CLI tool's output.

---

## Finding C2-T04: `packages/core/__tests__/categorizer.test.ts` doesn't test subcategory blocking

**Severity:** MEDIUM
**Confidence:** High

The `findRule` function in `reward.ts` has important logic for blocking broad category rules from matching subcategorized transactions (lines 66-81). There are no tests for this behavior. A regression could cause the optimizer to over-count rewards for cafe transactions under a "dining" rule.

**Fix:** Add test cases:
- Transaction with `subcategory: 'cafe'` should NOT match a rule with `category: 'dining'` and no subcategory
- Transaction with `subcategory: 'cafe'` SHOULD match a rule with `subcategory: 'cafe'`
- Transaction with no subcategory SHOULD match a broad `category: 'dining'` rule

---

## Finding C2-T05: No tests for `toRulesCategoryNodes` and `toCoreCardRuleSets` adapters

**File:** `apps/web/src/lib/analyzer.ts:21-63`

**Severity:** MEDIUM
**Confidence:** High

The type adapters that replaced `as unknown as` have no test coverage. If the adapter logic is wrong (e.g., wrong fallback for unknown source), the entire optimization pipeline could produce incorrect results.

**Fix:** Add unit tests for:
1. `toRulesCategoryNodes` with nested subcategories
2. `toCoreCardRuleSets` with valid and invalid source values
3. `toCoreCardRuleSets` with valid and invalid reward types

---

## Finding C2-T06: E2E tests create temp files without cleanup

**File:** `e2e/ui-ux-review.spec.js:194-197`
**Severity:** LOW
**Confidence:** High

The "adding invalid file shows error" test writes to `/tmp/test-invalid.txt` but never cleans it up. While `/tmp` is periodically cleaned by the OS, this is still poor practice.

**Fix:** Use `test.afterEach` to clean up the temp file, or use Playwright's built-in `TestInfo.outputPath()`.
