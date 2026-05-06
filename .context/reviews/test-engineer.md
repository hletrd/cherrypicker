# Cycle 32 Test Engineering Review

**Reviewer:** test-engineer (worker-5)
**Date:** 2026-05-06
**Scope:** Entire cherrypicker repository — test coverage, test infrastructure, fixture quality, cross-file interactions

---

## Executive Summary

| Area | Test Files | Source Files | Coverage Assessment |
|------|-----------|-------------|---------------------|
| packages/core | 4 | 20 | Moderate — calculator + categorizer well-tested, optimizer moderate, missing edge cases |
| packages/parser | 17 | ~25 | Poor — only detect + csv run under vitest; 15 test files bun-only; actual parse entry points untested |
| packages/rules | 2 | 5 | Moderate — schema well-tested, `buildCategoryLabelMap` and `loadIssuers` completely untested |
| packages/viz | 1 | 4 | Poor — only HTML report tested; terminal output completely untested |
| apps/web | 12 | ~35 | Poor — ~12% line coverage; critical parsers (csv, xlsx, pdf, detect) have zero direct tests; NOT in vitest config |
| tools/cli | 1 | 7 | Poor — only argument guards + consent tested; actual command execution untested |
| tools/scraper | 1 | 7 | Poor — only `cleanHTML` tested; fetch, extraction, validation, writing all untested |
| e2e | 4 specs | N/A | Good breadth but narrow depth; only happy paths + small fixtures |

**Critical Infrastructure Issue:** `vitest.config.ts` excludes 27 test files (all web tests + 15 parser tests). Running `npx vitest` silently skips the majority of the test suite.

---

## Infrastructure Findings

### C32-INFRA01 | HIGH | `vitest.config.ts` omits majority of test files

**File:** `vitest.config.ts:30-36`

The `include` array only covers:
- `packages/core/__tests__/**/*.test.ts` (4 files)
- `packages/parser/__tests__/detect.test.ts` (1 file)
- `packages/parser/__tests__/csv.test.ts` (1 file)
- `packages/rules/__tests__/**/*.test.ts` (2 files)
- `packages/viz/__tests__/**/*.test.ts` (1 file)

**Total: 9 test files included out of 36+ test files in the repo.**

**Excluded from vitest (must run via `bun test`):**
- All 12 `apps/web/__tests__/` files
- 15 `packages/parser/__tests__/` files (amount, column-matcher, csv-adapters, csv-shared, date-utils, html, json, llm-fallback, ofx, parse-error, pdf-parity, table-parser, web-detect-parity, xlsx-parity, xlsx)
- `tools/cli/__tests__/` (1 file)
- `tools/scraper/__tests__/` (1 file)

**Impact:** Developers running `npm test` (which runs `turbo run test`, which runs `vitest`) get a false sense of security. The CI may also only run vitest. The web and parser test suites could be silently failing for extended periods.

**Fix:** Add `'apps/web/__tests__/**/*.test.ts'` and all parser test paths to `vitest.config.ts` include, OR create per-package vitest configs. Ensure CI runs BOTH `vitest` and `bun test`.

---

### C32-INFRA02 | HIGH | No test coverage reporting configured

**File:** `vitest.config.ts`, root `package.json`

No `coverage` configuration exists. No `@vitest/coverage-v8` or similar dependency. Cannot measure actual coverage percentages. Decisions about where to add tests are based on intuition rather than data.

**Fix:** Add coverage config to vitest and enforce a minimum threshold in CI.

---

### C32-INFRA03 | MEDIUM | Mixed test runners create maintenance burden

The repo uses both `vitest` (Node-based) and `bun:test` (Bun runtime). The `vitest-bun-shim.ts` maps `bun:test` imports to vitest, but this only works for basic APIs. Files using `import.meta.dir`, Bun-specific `readFileSync` paths, or actual Bun runtime behavior cannot run under vitest.

**Impact:** Contributors must know which runner to use for which package. Test failures may be runner-specific rather than code bugs.

**Fix:** Standardize on a single runner, or document the split clearly in README/CONTRIBUTING.

---

### C32-INFRA04 | MEDIUM | Playwright config issues

**File:** `playwright.config.ts`

1. `fullyParallel: false` (line 9) forces sequential execution of ~80 e2e tests. With `webServer` startup time, this is unnecessarily slow.
2. `bunx astro preview` (line 17) assumes `bunx` globally available. In npm-only CI, this fails.
3. `reporter: 'line'` (line 11) provides minimal detail for debugging CI failures.
4. No cross-browser projects (Firefox, WebKit).
5. Hardcoded `basePath: '/cherrypicker/'` — inflexible for different deployment contexts.

**Fix:** Use `fullyParallel: true` with serial configuration only for stateful describes. Make `bunx` vs `npx` configurable via env var. Use `list` or `html` reporter in CI.

---

### C32-INFRA05 | MEDIUM | E2E fixtures are too small

**File:** `e2e/fixtures/regression-upload.csv`

The primary E2E fixture has only 5 rows across 3 categories. This does not exercise:
- Multi-month statement analysis
- Large transaction volumes (performance)
- Diverse merchant patterns for categorization
- Edge cases like refunds, installments, foreign currency

**Fix:** Add a 50-100 row fixture with varied edge cases.

---

## packages/core Findings

### C32-CORE01 | HIGH | `calculatePercentageReward` has no direct unit tests

**File:** `packages/core/src/calculator/types.ts:46-67`

This is the core reward calculation math. Only tested indirectly through `calculateRewards`. Missing direct tests for:
- `monthlyCap === null` (unlimited cap path)
- `monthlyCap = 0` (should produce 0 reward)
- `rate = 0` (should produce 0 reward)
- `amount = 0` (should produce 0 reward)
- `currentMonthUsed` exactly at cap boundary
- `capReached` flag when `raw > remaining` vs `raw <= remaining`

**Failure scenario:** A refactor of `calculatePercentageReward` could break cap logic without any test catching it, since all existing tests pass through `calculateRewards` which has its own logic layers.

**Fix:** Add 6-8 direct unit tests for `calculatePercentageReward`.

---

### C32-CORE02 | HIGH | `calculateFixedReward` has untested branches

**File:** `packages/core/src/calculator/reward.ts:144-178`

Untested branches:
- `mile_per_1500won` unit (line 160-162): `Math.floor(tx.amount / 1500) * fixedAmount`
- `unit === null || unit === undefined` path (lines 171-173)
- Unknown unit fallback returning 0 (lines 176-178)
- `fixedAmount <= 0` guard (line 151)

**Failure scenario:** A card rule using `mile_per_1500won` could silently return 0 due to a logic error in this branch, with no test detecting it.

**Fix:** Add 4 test cases covering each untested branch.

---

### C32-CORE03 | HIGH | `ruleConditionsMatch` has two untested conditions

**File:** `packages/core/src/calculator/reward.ts:36-41`

Tested: `specificMerchants` (via subcategory fixture)
Untested:
- `minTransaction` boundary — transaction below minimum should be excluded
- `excludeOnline` — online transaction should be excluded when rule has this flag

**Failure scenario:** A user adds a card rule with `excludeOnline: true` expecting online transactions to be excluded, but the logic is inverted. No test catches this.

**Fix:** Add 2 test cases for `minTransaction` and `excludeOnline`.

---

### C32-CORE04 | HIGH | Missing invalid input tests for `calculateRewards`

**File:** `packages/core/src/calculator/reward.ts:181-363`

No tests for:
- `cardRule` is null/undefined
- `transactions` is null/undefined
- `previousMonthSpending` is negative
- Transaction missing required fields (id, date, amount, category)
- `currency` is undefined
- NaN/Infinity in transaction amounts

**Failure scenario:** Calling `calculateRewards` with malformed data (e.g., from a corrupted upload) could throw unhandled exceptions rather than returning a graceful error.

**Fix:** Add 4-5 error handling test cases.

---

### C32-CORE05 | MEDIUM | `optimize()` wrapper in optimizer/index.ts untested

**File:** `packages/core/src/optimizer/index.ts:20-31`

The `OptimizeMethod` switch only has `'greedy'`; the dispatch logic is untested. If a new method is added, the switch statement has zero coverage.

**Fix:** Add a test verifying the method dispatch, including an invalid method fallback.

---

### C32-CORE06 | MEDIUM | `buildAssignments` alternatives limit untested

**File:** `packages/core/src/optimizer/greedy.ts:68-133`

The alternatives accumulation is capped at 5 (line 130), but no test verifies this limit is enforced.

**Fix:** Add test with 6+ alternative cards and verify only top 5 are returned.

---

### C32-CORE07 | MEDIUM | Cache eviction ordering not verified

**File:** `packages/core/src/categorizer/matcher.ts:129`

Tests verify cache stays under 500 entries but do NOT verify the OLDEST entry is evicted (Map iteration order) or that cache hits work correctly after eviction.

**Fix:** Add test inserting 501 entries and verifying the first-inserted key is gone.

---

### C32-CORE08 | LOW | `buildCategoryKey` trivial but no direct test

**File:** `packages/core/src/calculator/reward.ts:28-33`

**Fix:** Add 1 direct test (or remove from concern list if deemed too trivial).

---

## packages/rules Findings

### C32-RULES01 | HIGH | `buildCategoryLabelMap` completely untested

**File:** `packages/rules/src/category-names.ts:28-40`

This function builds a `Map<string, string>` with three key formats:
- Parent IDs (`"dining"` -> `"외식"`)
- Bare subcategory IDs (`"cafe"` -> `"카페"`)
- Dot-notation (`"dining.cafe"` -> `"카페"`)

It is used by the optimizer, report generator, and terminal summary. Zero tests exist.

**Failure scenario:** A refactor could break dot-notation lookups, causing category labels to display as undefined in reports.

**Fix:** Add 5-6 test cases covering all three key formats.

---

### C32-RULES02 | HIGH | `loadIssuers` completely untested

**File:** `packages/rules/src/loader.ts:58-65`

Loads and validates issuer metadata from YAML. No tests for successful load, invalid data, or missing file.

**Fix:** Add 3-4 test cases.

---

### C32-RULES03 | MEDIUM | `loadAllCardRules` error logging untested

**File:** `packages/rules/src/loader.ts:32-48`

Line 42: `console.warn(...)` for malformed YAML files. No test verifies warnings are emitted for partial failures.

**Fix:** Mock console.warn and verify it is called when a YAML file fails to parse.

---

## packages/viz Findings

### C32-VIZ01 | HIGH | All terminal output functions completely untested

**Files:**
- `packages/viz/src/terminal/comparison.ts:16` (80 lines)
- `packages/viz/src/terminal/summary.ts:24` (73 lines)
- `packages/viz/src/terminal/summary.ts:75` (36 lines)

Total ~190 lines of user-facing console output with zero test coverage.

**Fix:** Capture `console.log` output in tests, or refactor to return strings.

---

### C32-VIZ02 | MEDIUM | `esc` function numeric entity pre-decode untested

**File:** `packages/viz/src/report/generator.ts:31-47`

The `esc` function has a critical security path for numeric entity pre-decode (`&#x...;` and `&#...;`) that is NOT tested. This is the XSS prevention layer.

**Fix:** Add test cases for numeric entity inputs.

---

### C32-VIZ03 | MEDIUM | `formatWon`/`formatRate` boundary conditions untested

**File:** `packages/viz/src/report/generator.ts:9-19`

Missing: NaN input, Infinity input, negative input, `Number.MAX_SAFE_INTEGER`.

**Fix:** Add boundary test cases.

---

## apps/web Findings

### C32-WEB01 | HIGH | `parseCSV` has zero direct tests

**File:** `apps/web/src/lib/parser/csv.ts:798`

The main CSV entry point with 24 bank adapters + generic parser (~500 lines) has zero direct unit tests in the web test suite. The `analyzer-adapter.test.ts` only tests type adapters, not actual parsing.

**Missing:** All 24 bank adapters, `parseGenericCSV`, `splitLine`, `splitCSVContent`, BOM stripping, delimiter detection, summary row filtering, combined column headers.

**Fix:** Add comprehensive CSV parser tests.

---

### C32-WEB02 | HIGH | `parseXLSX` has zero direct tests

**File:** `apps/web/src/lib/parser/xlsx.ts:342`

~200 lines of XLSX parsing with zero web-side tests. `xlsx-parity.test.ts` in packages/parser only tests that web and server exports match, not actual parsing behavior.

**Missing:** HTML-as-XLS fallback, formula error cells, merged cell forward-fill, multi-sheet workbooks, empty sheets, invalid serial dates.

**Fix:** Add XLSX parser unit tests with actual XLSX fixtures.

---

### C32-WEB03 | HIGH | `parsePDF` has almost zero tests

**File:** `apps/web/src/lib/parser/pdf.ts:453`

~250 lines of PDF parsing. Only `fallbackAmountPattern` regex is tested in `parser-pdf.test.ts`. The actual `parsePDF()`, `tryStructuredParse()`, `parseTable()`, `detectColumnBoundaries()` are untested.

**Missing:** PDF with no extractable text, corrupted PDFs, multi-page statements, structured parse failure -> fallback, merchant extraction heuristics.

**Fix:** Add PDF parser tests. Use lightweight PDF fixtures.

---

### C32-WEB04 | HIGH | `store.svelte.ts` completely untested

**File:** `apps/web/src/lib/store.svelte.ts:370`

Entire Svelte 5 store with persistence, reoptimization, sessionStorage management. Zero tests.

**Missing:** 4MB size limit truncation, `QuotaExceededError`, corrupted sessionStorage data, migration path execution, concurrent `analyze()` + `reoptimize()` race condition (line 520).

**Fix:** Add store unit tests using Svelte 5 runes in test environment.

---

### C32-WEB05 | HIGH | `cards.ts` completely untested

**File:** `apps/web/src/lib/cards.ts:136`

Card data loading with fetch, AbortController, caching. Zero tests.

**Missing:** Network failure, 404 response, AbortError, concurrent calls, cache invalidation, empty cards.json.

**Fix:** Mock `fetch` and test all error paths.

---

### C32-WEB06 | MEDIUM | `detect.ts` and `column-matcher.ts` untested

**Files:**
- `apps/web/src/lib/parser/detect.ts:107`
- `apps/web/src/lib/parser/column-matcher.ts:18`

Format detection, bank detection, delimiter detection, column matching — all untested in web tests. The `web-detect-parity.test.ts` in packages/parser only verifies export parity, not behavior.

**Fix:** Add detection and column-matcher unit tests.

---

### C32-WEB07 | MEDIUM | `formatters.ts` mostly untested

**File:** `apps/web/src/lib/formatters.ts:5`

Only `formatSavingsValue()` tested. Missing:
- `formatWon()` (NaN, negative zero, Infinity)
- `formatRate()` / `formatRatePrecise()`
- `formatIssuerNameKo()` (unknown issuer fallback)
- `getIssuerColor()` / `getIssuerTextColor()` (unknown issuer)
- `formatDateKo()` / `formatDateShort()` (invalid date strings)
- `formatFileSize()` (boundary at 1024, 1024*1024)

**Fix:** Add formatter boundary tests.

---

### C32-WEB08 | MEDIUM | `analyzer.ts` mostly untested

**File:** `apps/web/src/lib/analyzer.ts:105`

Only `toCoreCardRuleSets()` and `getLatestMonth()` tested (via reproduction in analyzer-adapter.test.ts).

**Missing:** `parseAndCategorize()`, `optimizeFromTransactions()`, `analyzeMultipleFiles()`, `invalidateAnalyzerCaches()`.

**Fix:** Add analyzer integration tests with mocked parsers.

---

## packages/parser Findings

### C32-PARSER01 | HIGH | `parseStatement()` entry point untested

**File:** `packages/parser/src/index.ts:51-97`

The main `parseStatement()` function that dispatches to format-specific parsers has zero tests. It handles format detection, encoding detection, buffer reading, and error enrichment — all untested.

**Missing:** Unsupported format, encoding detection failure, file not found, empty file, error enrichment path.

**Fix:** Add integration tests for `parseStatement()` with mocked file system.

---

### C32-PARSER02 | MEDIUM | LLM fallback only tests API key validation

**File:** `packages/parser/__tests__/llm-fallback.test.ts`

Only 4 tests: missing key, invalid prefix, too short key, well-formed key. The actual Anthropic API call, response parsing, and error handling are NOT tested.

**Missing:** API rate limit, malformed JSON response, missing tool_use block, network timeout, empty response.

**Fix:** Mock Anthropic SDK and test response handling.

---

### C32-PARSER03 | MEDIUM | PDF parity tests are shallow

**File:** `packages/parser/__tests__/pdf-parity.test.ts`

Tests `parseAmountString`, `parseDateStringToISO`, `isValidYYYYMMDD`, `parseTable`, `filterTransactionRows`, `detectHeaderRow`, `getHeaderColumns`. But:
- `parseTable` only checks `length > 0`, not actual cell content
- `filterTransactionRows` uses loose `>= 2` assertion
- No tests for `detectColumnBoundaries` or `tryStructuredParse`

**Fix:** Strengthen assertions to verify exact cell values and column layouts.

---

### C32-PARSER04 | LOW | `parseHTML` forward-fill edge cases untested

**File:** `packages/parser/src/html/index.ts`

No tests for blank rows between data sections, multi-sheet HTML, malformed HTML with unclosed quotes.

*(Previously reported as C31-TEST01 — still open)*

---

### C32-PARSER05 | LOW | JSON parser case-insensitive field matching untested

**File:** `packages/parser/src/json/index.ts`

No tests verifying `TransactionDate`, `TRANSACTIONDATE`, `transaction_date` all resolve to the same field.

*(Previously reported as C31-TEST02 — still open)*

---

### C32-PARSER06 | LOW | OFX timezone conversion untested

**File:** `packages/parser/src/ofx/index.ts`

No tests for cross-midnight timezone offsets (e.g., UTC-5 23:00 -> KST next day).

*(Previously reported as C31-TEST03 — still open)*

---

### C32-PARSER07 | LOW | OFX CCSTMTRS path untested

**File:** `packages/parser/src/ofx/index.ts`

Credit card statement (`<CCSTMTRS>`) parsing may not be explicitly tested vs `<STMTRS>`.

*(Previously reported as C31-TEST04 — still open)*

---

## tools/cli Findings

### C32-CLI01 | HIGH | Actual command execution untested

**Files:** `tools/cli/src/commands/*.ts`

`commands.test.ts` only tests argument guards and `validateFilePath`. No tests for:
- `runAnalyze` with actual file parsing
- `runOptimize` with actual card data
- `runReport` with HTML generation
- `runScrape` subprocess spawning
- Option parsing for `--bank`, `--cards`, `--prev-spending`, `--output`, `--categories`

**Fix:** Add integration tests with mocked file system and child_process.

---

### C32-CLI02 | MEDIUM | `main()` and `printHelp()` untested

**File:** `tools/cli/src/index.ts:39`

CLI entry point has zero tests.

**Fix:** Add tests for argument routing and help output.

---

## tools/scraper Findings

### C32-SCRAPER01 | HIGH | Fetch, extraction, validation, writing all untested

**Files:** `tools/scraper/src/*.ts`

Only `cleanHTML()` has a single test in `fetcher.test.ts`. The following are completely untested:
- `fetchCardPage()` — HTTP fetch, encoding, 30s timeout
- `extractCardRules()` — Anthropic API call
- `validateExtractedRules()` — Zod + business logic
- `writeCardRule()` — YAML serialization, file I/O
- `main()`, `parseArgs()`, `loadIssuerTarget()` — CLI entry

**Fix:** Mock fetch and Anthropic SDK. Add comprehensive scraper tests.

---

## E2E Findings

### C32-E2E01 | MEDIUM | `ui-ux-review.spec.js` parallel config conflicts with shared state

**File:** `e2e/ui-ux-review.spec.js:17`

`test.describe.configure({ mode: 'parallel' })` but many tests share upload flow state. This can cause flakiness if tests run in parallel and interfere with each other's sessionStorage.

**Fix:** Use serial mode for stateful describe blocks, or isolate sessionStorage per test.

---

### C32-E2E02 | MEDIUM | Screenshots require manual review

**File:** `e2e/ui-ux-screenshots.spec.js`

13 screenshot tests with no automated assertions. Visual regressions require manual comparison.

**Fix:** Consider adding pixel-diff tooling (e.g., `pixelmatch`) or remove from automated CI.

---

### C32-E2E03 | LOW | E2E uses CJS require() despite ESM package type

**File:** `e2e/core-regressions.spec.js`

Uses `require()` for `packages/core/dist/` imports. Works because Playwright handles it, but inconsistent with `"type": "module"` in root package.json.

**Fix:** Convert to dynamic `import()`.

---

## Cross-Cutting Issues

### C32-XC01 | HIGH | No end-to-end integration test across packages

No single test runs: load categories -> load card rules -> categorize transactions -> calculate rewards -> optimize -> generate report. Each package is tested in isolation, missing integration bugs.

**Fix:** Add a cross-package integration test.

---

### C32-XC02 | MEDIUM | Duplicate `formatWon`/`formatRate` across packages

`apps/web/src/lib/formatters.ts` and `packages/viz/src/report/generator.ts` both define nearly identical `formatWon` and `formatRate` functions. Tests exist in one place but not the other, creating a maintenance risk.

**Fix:** Extract to shared utility and test once.

---

### C32-XC03 | MEDIUM | Web/server parity tests are shallow

`xlsx-parity.test.ts`, `pdf-parity.test.ts`, `web-detect-parity.test.ts` verify that web and server exports are identical (same regex sources, same arrays). They do NOT verify that the functions produce identical output for the same inputs.

**Fix:** Add behavioral parity tests — same input -> same output.

---

## Prior Open Findings Status

| Finding | Status | Notes |
|---------|--------|-------|
| D-36 (XLSX parser lacks web unit tests) | OPEN | Still no web-side XLSX parser tests |
| D-37 (E2E waitForTimeout) | OPEN | Not examined in this cycle |
| C31-TEST01 (HTML forward-fill edge cases) | OPEN | Still missing |
| C31-TEST02 (JSON case-insensitive fields) | OPEN | Still missing |
| C31-TEST03 (OFX timezone conversion) | OPEN | Still missing |
| C31-TEST04 (OFX CCSTMTRS path) | OPEN | Still missing |

---

## Final Sweep

1. All source files with runtime logic identified and reviewed
2. All test files read and analyzed
3. Test configs (vitest, playwright) reviewed
4. Cross-file interactions examined
5. Prior findings checked for status
6. No test files use `fit`/`fdescribe`
7. No `console.log` artifacts detected in test files
