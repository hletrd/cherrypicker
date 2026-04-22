# Test Engineering Review -- cherrypicker

**Date**: 2026-04-22
**Reviewer**: test-engineer agent
**Scope**: All packages and apps in the monorepo
**Test suite status**: 290 tests passing across 14 files, 0 failures (bun test)

---

## Summary

**Current Coverage**: ~45% of source modules have direct test coverage
**Target Coverage**: 80%+ for core optimization engine and parser logic
**Test Health**: NEEDS ATTENTION -- significant coverage gaps in critical parsing and calculation paths

The test suite is well-structured where it exists (descriptive names, one behavior per test, proper fixtures), but there are large blind spots: 8 of 10 bank CSV adapters have zero test coverage, the shared CSV parsing utilities are untested, core calculator functions lack isolated unit tests, and two test files duplicate production logic instead of importing it (divergence risk).

---

## Findings

### F-01: Eight CSV bank adapters have zero test coverage

**Files**:
- `packages/parser/src/csv/hyundai.ts`
- `packages/parser/src/csv/lotte.ts`
- `packages/parser/src/csv/hana.ts`
- `packages/parser/src/csv/woori.ts`
- `packages/parser/src/csv/nh.ts`
- `packages/parser/src/csv/ibk.ts`
- `packages/parser/src/csv/bc.ts`
- `packages/parser/src/csv/shinhan.ts` (only inline test in csv.test.ts, no fixture file)

**Why it matters**: These parse real user credit card statements. A parsing bug silently corrupts spending data, producing wrong optimization results that users trust. Only KB and Samsung have fixture-based tests. The shinhan adapter has a minimal inline test but no fixture file.

**Testing gap**: No test fixtures (`sample-hyundai.csv`, `sample-lotte.csv`, etc.) exist in `packages/parser/__tests__/fixtures/`. Only `sample-kb.csv`, `sample-samsung.csv`, and `sample-shinhan.csv` exist.

**Suggested fix**: Create CSV fixture files for each untested adapter and add test blocks following the existing KB/Samsung pattern. Each fixture should contain at least 5 transactions covering: normal amounts, large comma-separated amounts, installment plans, category fields, and date format variations.

**Confidence**: High

---

### F-02: csv/shared.ts core utilities have no direct unit tests

**File**: `packages/parser/src/csv/shared.ts` (lines 1-78)

**Why it matters**: `splitCSVLine`, `parseCSVAmount`, `isValidCSVAmount`, and `parseCSVInstallments` are the shared foundation used by ALL 10 bank adapters and the generic parser. A bug here silently affects every bank. `parseCSVAmount` handles tricky edge cases: comma separators, Won suffix, parenthesized negatives like `(1,234)`, internal whitespace, and `NaN` handling.

**Testing gap**: Zero unit tests. The only coverage is indirect through the KB/Samsung integration tests in `csv.test.ts`, which only exercises happy-path amounts.

**Suggested fix**: Add `packages/parser/__tests__/shared.test.ts` with tests for:
- `splitCSVLine`: quoted fields, doubled-quote escapes, tab/pipe delimiters, trailing whitespace
- `parseCSVAmount`: `"1,234"` -> `1234`, `"5000원"` -> `5000`, `"(1,234)"` -> `-1234`, `""` -> `null`, `"abc"` -> `null`, `"  3,000  "` -> `3000`
- `isValidCSVAmount`: null amount pushes error, zero amount returns false without error, negative amount returns false without error, positive amount returns true
- `parseCSVInstallments`: `"3"` -> `3`, `"1"` -> `undefined`, `"일시불"` -> `undefined`, `""` -> `undefined`

**Confidence**: High

---

### F-03: Core calculator functions lack isolated unit tests

**Files**:
- `packages/core/src/calculator/types.ts` (`calculatePercentageReward`, lines 46-67)
- `packages/core/src/calculator/reward.ts` (`selectTier`, `findRule`, `ruleConditionsMatch`, `ruleSpecificity`, `applyMonthlyCap`, `normalizeRate`, `calculateFixedReward`, `getCalcFn`, lines 9-177)

**Why it matters**: `calculatePercentageReward` is the shared math function for ALL reward types (discount, points, cashback, mileage). `findRule`, `ruleConditionsMatch`, and `ruleSpecificity` determine which reward rule matches a transaction -- a wrong match means wrong rewards. These are only tested indirectly through `calculateRewards()` integration calls in `calculator.test.ts`.

**Testing gap**:
- `calculatePercentageReward`: no test for zero rate, rate > 1, negative amount, very large monthlyCap, `monthlyCap = 0`
- `ruleConditionsMatch`: no test for `minTransaction` threshold, `excludeOnline` flag, `specificMerchants` partial match
- `ruleSpecificity`: no test verifying specificity ordering (subcategory > broad, merchant-specific > subcategory-only)
- `normalizeRate`: no test for rate = 0, rate = 100 (100%), null rate
- `selectTier`: no test for overlapping tier ranges (maxSpending boundaries)

**Suggested fix**: These functions are not exported. Either export them for direct testing, or add more targeted integration tests through `calculateRewards()` that specifically exercise these code paths with fixtures designed to trigger them:
- A fixture with `minTransaction: 30000` and a transaction of `20000` (should get 0 reward)
- A fixture with `excludeOnline: true` and an `isOnline: true` transaction (should be excluded)
- A fixture with `specificMerchants: ['스타벅스']` and a merchant that does NOT contain it

**Confidence**: High

---

### F-04: analyzer-adapter.test.ts duplicates production logic instead of importing it

**File**: `apps/web/__tests__/analyzer-adapter.test.ts` (lines 23-33, 52-72)

**Why it matters**: `getLatestMonth` and `toCoreCardRuleSets` are reimplemented locally. The comment at line 8 acknowledges this: "The actual adapter is a private function in analyzer.ts, so we test the narrowing logic by reproducing the same validation sets and rules." This means the tests can silently diverge from production code. A bug fix in the production code would not be caught by the test if the duplicated version is not updated.

**Testing gap**: Tests verify the duplicated logic, not the actual production code. The real `analyzer.ts` is untested.

**Suggested fix**: Extract `getLatestMonth` and `toCoreCardRuleSets` into a separate module (e.g., `apps/web/src/lib/analyzer-utils.ts`) and import them in both the production code and the tests. If the pdfjs-dist import issue (noted at line 11) prevents importing from analyzer.ts, the extracted module should avoid that dependency.

**Confidence**: High

---

### F-05: parser-encoding.test.ts duplicates production logic

**File**: `apps/web/__tests__/parser-encoding.test.ts` (lines 28-56)

**Why it matters**: `detectBestEncoding` is reimplemented locally to mirror `apps/web/src/lib/parser/index.ts:17-37`. Same divergence risk as F-04. The comment at line 8 says "We reproduce the core encoding selection logic locally to verify it works correctly."

**Testing gap**: Tests verify the duplicated logic, not the actual production code.

**Suggested fix**: Extract `detectBestEncoding` from `parser/index.ts` into a separate importable module (e.g., `apps/web/src/lib/parser/encoding.ts`) and import it in both places. The File/ArrayBuffer incompatibility noted in the comment can be worked around by accepting an `ArrayBuffer` parameter instead of a `File`.

**Confidence**: High

---

### F-06: viz/terminal/comparison.ts and summary.ts have zero tests

**Files**:
- `packages/viz/src/terminal/comparison.ts` (entire file, 103 lines)
- `packages/viz/src/terminal/summary.ts` (entire file, 67 lines)

**Why it matters**: Both files contain `formatWon` and `formatRate` with edge-case handling (negative zero normalization at line 8-9 of both files, `Infinity` handling). `printSpendingSummary` aggregates by category using `buildCategoryKey` logic. `printCardComparison` sorts and formats card results with cap warnings. These produce user-facing CLI output.

**Testing gap**: Zero tests. The only test for the viz package is a single test for `generateHTMLReport`.

**Suggested fix**: Add `packages/viz/__tests__/terminal.test.ts` testing:
- `formatWon`: `0` -> `"0원"` (not `"-0원"`), `Infinity` -> `"0원"`, negative amounts, `NaN`
- `formatRate`: `0` -> `"0.00%"`, `Infinity` -> `"0.00%"`, `0.0123` -> `"1.23%"`, `NaN`
- Note: `formatWon` and `formatRate` are not exported. Either export them or test through the print functions by capturing `console.log` output.

**Confidence**: Medium

---

### F-07: viz/report/generator.ts has only 1 minimal test

**File**: `packages/viz/__tests__/report.test.ts` (1 test, 62 lines)

**Why it matters**: `generateHTMLReport` builds a full HTML report with multiple sections. The `formatWon` function handles `Infinity` and negative zero (line 11-12). The `esc()` HTML escape function (line 32-37) is security-critical for XSS prevention. The `buildCategoryTable`, `buildCardComparison`, and `buildAssignments` functions are untested.

**Testing gap**:
- `esc()`: no test for `"&"`, `"<script>"`, `"onload=alert(1)"`, `"'"` (single quote)
- `formatWon` in generator.ts: no test for `Infinity`, `NaN`, negative zero, negative savings
- `buildCategoryTable`: no test for subcategory grouping, empty transactions, single transaction
- `buildAssignments`: no test for caps hit warnings rendering, alternative cards display
- Savings sign prefix logic (line 41): no test for `savingsVsSingleCard < 0`

**Suggested fix**: Add tests covering:
- HTML escape safety: merchant names with `<script>`, `&`, `"`, special characters
- Negative savings formatting: `savingsVsSingleCard = -5000` should show `-5,000원` (no double-negative `+-5,000원`)
- Caps hit block rendering when caps exist
- Category table with subcategory transactions (e.g., `dining.cafe`)

**Confidence**: High

---

### F-08: Server-side date-utils.ts has no direct tests

**File**: `packages/parser/src/date-utils.ts` (125 lines)

**Why it matters**: The web-side equivalent (`apps/web/src/lib/parser/date-utils.ts`) is thoroughly tested in `parser-date.test.ts` with 80+ test cases. But the server-side version in `packages/parser/src/date-utils.ts` is a separate implementation that is NOT tested directly. It exports `daysInMonth` and `isValidDayForMonth` which the web version does not. These are used by the XLSX parser's serial-date validation path.

**Testing gap**: No test file exists. The web-side tests cover the same parsing logic but for a different implementation. The server-side `daysInMonth` and `isValidDayForMonth` functions are completely untested.

**Suggested fix**: Add `packages/parser/__tests__/date-utils.test.ts` that imports directly from `../src/date-utils.ts` and tests `parseDateStringToISO`, `inferYear`, `daysInMonth`, and `isValidDayForMonth`. Can follow the same structure as `apps/web/__tests__/parser-date.test.ts`.

**Confidence**: High

---

### F-09: Weak conditional assertion in categorizer length guard test

**File**: `packages/core/__tests__/categorizer.test.ts` (lines 293-298)

**Why it matters**: The test for "two character name does NOT reverse-match longer keywords" uses:
```typescript
if (result.confidence === 0.8) {
  expect(result.category).not.toBe('cafe');
}
```
This is a conditional assertion. If `result.confidence` is never `0.8`, the `expect` never fires and the test silently passes without verifying anything. This masks potential regressions where a two-character name incorrectly matches at a different confidence level.

**Testing gap**: The test has an escape hatch that makes it non-deterministic.

**Suggested fix**: Restructure the test to always assert something. For example:
```typescript
const result = matcher.match('스타');
// Regardless of confidence level, a 2-char name should not reverse-match
// a longer keyword like 스타벅스 at the 0.8 confidence tier
if (result.confidence === 0.8) {
  expect(result.category).not.toBe('cafe');
}
// Always assert: either it's uncategorized, or it's matched via a different path
expect(result.confidence).toBeLessThan(0.8);
```

**Confidence**: Medium

---

### F-10: E2E screenshot tests use waitForTimeout instead of event-based waits

**File**: `e2e/ui-ux-screenshots.spec.js` (lines 18, 26, 43, 53, 68, 81, 94, 106, 119, 132, 141)
**File**: `e2e/ui-ux-review.spec.js` (lines 373, 381)

**Why it matters**: Multiple `await page.waitForTimeout(1000)`, `waitForTimeout(2000)`, `waitForTimeout(3000)` calls. This is a classic flaky test pattern. On slow CI machines, 2 seconds may not be enough; on fast machines, it wastes time. The tests are timing-dependent rather than event-dependent.

**Testing gap**: Tests will flake when the Astro island hydration takes longer than the hardcoded timeout.

**Suggested fix**: Replace `waitForTimeout(N)` with `waitForSelector` or `waitForFunction` calls that wait for specific DOM conditions. The test suite already uses `waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')))` in many places -- apply this consistently to all screenshot tests as well.

**Confidence**: High

---

### F-11: E2E tests use different hardcoded ports (4173 vs 4174)

**Files**:
- `e2e/web-regressions.spec.js` (line 5): `http://127.0.0.1:4173/cherrypicker/`
- `e2e/ui-ux-review.spec.js` (line 8): `http://127.0.0.1:4174/cherrypicker/`
- `e2e/ui-ux-screenshots.spec.js` (line 8): `http://127.0.0.1:4174/cherrypicker/`

**Why it matters**: The `web-regressions` spec uses port 4173 (Astro dev server default) while the `ui-ux-review` and `ui-ux-screenshots` specs use port 4174 (Astro preview default). If the wrong server is running, tests fail with connection errors rather than descriptive messages. There is no setup/teardown to ensure the correct server is running.

**Testing gap**: No server lifecycle management. Tests assume a pre-running server.

**Suggested fix**: Either:
1. Centralize the base URL into `playwright.config.ts` and use `baseURL` config option
2. Add a `globalSetup` in `playwright.config.ts` that starts the preview server and waits for it to be ready

**Confidence**: Medium

---

### F-12: No test for parseCSV() fallback logic in csv/index.ts

**File**: `packages/parser/src/csv/index.ts` (lines 29-91)

**Why it matters**: `parseCSV()` has a three-tier fallback: (1) bank-specific adapter by ID, (2) content-signature detection, (3) generic parser. The adapter failure fallback (lines 44-49) catches errors and falls through to generic parser with a recorded error. The content-signature detection fallback (lines 57-69) tries each adapter and records failures. These defensive paths are untested.

**Testing gap**: Only the happy path (KB, Samsung) is tested via `csv.test.ts`. No test exercises:
- Bank adapter throwing an error -> fallback to generic
- Content-signature detection failure -> fallback to generic
- Multiple adapter failures recorded in errors array
- Generic parser itself throwing -> defensive catch at lines 73-90

**Suggested fix**: Add tests to `csv.test.ts` for:
- Content that triggers a bank adapter but causes it to throw (mock or craft malformed input)
- Content that matches no bank adapter at all (falls through to generic)
- Content that matches multiple adapters by signature (verifies correct priority)

**Confidence**: Medium

---

### F-13: CLI commands only have argument guard tests

**File**: `tools/cli/__tests__/commands.test.ts` (4 tests, 23 lines)

**Why it matters**: `runAnalyze`, `runOptimize`, `runReport`, and `runScrape` have full execution paths that load files, parse statements, run the optimizer, and generate output. Only the "missing argument throws" guard is tested. The successful execution paths, error handling for invalid files, and output formatting are completely untested.

**Testing gap**: Zero tests for happy-path execution. Zero tests for error paths (file not found, corrupt file, invalid YAML).

**Suggested fix**: This is lower priority than the parser/calculator gaps since the CLI is a thin orchestration layer. However, integration tests using small fixture files would catch regressions in the end-to-end pipeline. Consider adding at least one smoke test per command that uses the existing `sample-kb.csv` fixture.

**Confidence**: Low

---

### F-14: PDF parser completely untested

**Files**:
- `packages/parser/src/pdf/extractor.ts`
- `packages/parser/src/pdf/llm-fallback.ts`
- `packages/parser/src/pdf/table-parser.ts`
- `packages/parser/src/pdf/index.ts`

**Why it matters**: PDF parsing is the fallback when CSV/XLSX parsing fails. `table-parser.ts` contains structural parsing logic that could be unit-tested. `llm-fallback.ts` calls the Claude API, which requires mocking.

**Testing gap**: Zero tests. Harder to test due to external dependencies, but `table-parser.ts` contains extractable logic.

**Suggested fix**: Lower priority. Focus on `table-parser.ts` which can be tested with mock PDF text extraction output (string-based). `llm-fallback.ts` would require mocking the Claude API client. `extractor.ts` requires pdfjs-dist which has Vite import compatibility issues (noted in `analyzer-adapter.test.ts` line 11).

**Confidence**: Low

---

### F-15: formatSavingsValue helper (recently extracted) has no tests

**Why it matters**: Commit `0000000d79` extracted `formatSavingsValue` to "unify savings sign-prefix logic across components (C92-01/C94-01)." This is formatting logic that directly affects user-facing output. Sign-prefix bugs are easy to introduce (e.g., showing `+-5,000원` instead of `-5,000원`).

**Testing gap**: The `report.test.ts` test does not cover negative savings formatting. The viz terminal tests don't exist.

**Suggested fix**: Add tests for:
- Positive savings: `+5,000원`
- Zero savings: `0원` (not `+0원` or `-0원`)
- Negative savings: `-5,000원` (not `+-5,000원`)

**Confidence**: High

---

### F-16: loadAllCardRules integration tests have 30s timeout

**File**: `packages/rules/__tests__/schema.test.ts` (lines 252-276, three tests with `30000` ms timeout)

**Why it matters**: These tests load 650+ YAML files from disk. In CI environments with slow filesystems or limited I/O, they may timeout or slow the test suite significantly.

**Testing gap**: Not a functional gap, but a reliability concern. These tests also have no assertions on the content of specific YAML files -- just structural checks (has id, has tiers, has rewards).

**Suggested fix**: Consider:
1. Running these as a separate "slow test" suite that can be opted out of during development
2. Adding a few specific YAML file content assertions (e.g., verify a known card's rate values) to catch data regression
3. Caching the loaded rules across the three tests using `beforeAll` instead of loading separately in each test

**Confidence**: Low

---

## Coverage Gap Summary by Package

| Package | Source Files | Files with Tests | Coverage |
|---|---|---|---|
| `packages/core` | 13 source files | 4 test files (categorizer, calculator, optimizer, reward-cap-rollback) | ~55% |
| `packages/parser` | 22 source files | 3 test files (csv, detect, xlsx-parity) | ~25% |
| `packages/rules` | 4 source files | 1 test file (schema) | ~80% |
| `packages/viz` | 4 source files | 1 test file (report, minimal) | ~15% |
| `apps/web` (lib/) | 8 source files | 3 test files (analyzer-adapter, parser-encoding, parser-date) | ~40% |
| `tools/cli` | 4 command files | 1 test file (commands, guards only) | ~10% |
| `tools/scraper` | 1 source file | 1 test file (fetcher, minimal) | ~20% |

## Priority Recommendations

### Immediate (High risk, high impact)

1. **F-02**: Add `shared.test.ts` for CSV parsing utilities -- this is the foundation of all 10 adapters
2. **F-01**: Add fixture files and tests for the 8 untested bank adapters
3. **F-04/F-05**: Extract and import duplicated logic in analyzer-adapter and parser-encoding tests
4. **F-03**: Add targeted tests for calculator rule matching and condition filtering

### Short-term (Medium risk)

5. **F-07**: Expand report.test.ts with HTML escape safety, negative savings, caps rendering tests
6. **F-08**: Add server-side date-utils.test.ts (can mirror the thorough web-side tests)
7. **F-09**: Fix the conditional assertion in categorizer.test.ts
8. **F-12**: Add parseCSV() fallback logic tests
9. **F-15**: Add formatSavingsValue sign-prefix tests

### Medium-term (Lower risk or harder to implement)

10. **F-06**: Add terminal output tests for viz/comparison.ts and viz/summary.ts
11. **F-10/F-11**: Replace waitForTimeout with event-based waits, centralize E2E base URL
12. **F-13**: Add CLI integration smoke tests
13. **F-14**: Add PDF table-parser tests
14. **F-16**: Optimize loadAllCardRules test performance

---

## TDD Opportunities

The following areas would benefit from a TDD approach for future development:

1. **New bank adapter**: Write fixture first, write test that fails (adapter cannot parse it), implement adapter to pass
2. **New reward rule condition type** (e.g., `includeSubcategories: true` noted in `reward.ts:80`): Write test for the new condition first, then implement
3. **ILP optimizer** (ilp.ts is currently a stub): Write optimization correctness tests first, then implement the ILP solver
4. **Any new `unit` type** in reward tiers (e.g., `won_per_transaction`): Write test for the new unit first, then add the calculation path

---

## Test Pyramid Assessment

Current distribution:
- **Unit tests**: ~230 (79%) -- mostly in core and parser
- **Integration tests**: ~50 (17%) -- schema loading, CSV parsing with fixtures, optimizer with real card rules
- **E2E tests**: ~10 (4%) -- Playwright specs

The pyramid is slightly inverted in the integration layer for `packages/parser` -- the CSV tests are integration-level (parsing full fixtures) when the shared utilities should have unit tests. The E2E layer is well-proportioned.

---

## Verification

- Test run: `bun test` -> 290 pass, 0 fail, 3283 expect() calls, 2.40s
- No flaky test failures observed in this run
- Console warnings from `parseDateStringToISO` (unparseable date strings returned as-is) are expected test behavior for invalid date rejection tests
