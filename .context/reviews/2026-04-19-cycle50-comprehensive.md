# Comprehensive Code Review -- Cycle 50

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 50)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage, type safety

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-49 reviews and deferred items. Ran `bun test` (266 pass, 0 fail), `tsc --noEmit` per package (all pass except pre-existing test file issues in apps/web), and `bun run build` (all 7 tasks succeed). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior Findings

All prior cycle 47-49 findings (C47-L01, C47-L02, C49-M01) are confirmed fixed. The `parsed` variable initialization in `llm-fallback.ts:84` now has `= []`. Terminal `formatWon`/`formatRate` all have `Number.isFinite` guards. Server-side CSV adapter loop logs warnings. All 266 tests pass. All packages typecheck. Build succeeds.

Deferred items (D-106, D-107, D-110) remain deferred with documented rationale.

---

## New Findings

### C50-M01: Viz report generator and terminal summary display English category IDs instead of Korean labels

- **Severity:** MEDIUM (incorrect output)
- **Confidence:** High
- **File+line:** `packages/viz/src/report/generator.ts:75`, `packages/viz/src/terminal/summary.ts:37`
- **Description:** Both `buildCategoryTable` in the HTML report generator and `printSpendingSummary` in the terminal summary set `labelKo: tx.category` when building per-category aggregations. The `tx.category` field is the canonical English category ID (e.g., `"dining"`, `"cafe"`, `"online_shopping"`), not a Korean label. This means the HTML report's category column and the terminal summary's category column display raw English IDs like "dining" instead of Korean labels like "외식".

  The web dashboard correctly displays Korean labels because `greedy.ts:buildAssignments` and `buildCardResults` resolve `categoryNameKo` via the `categoryLabels` Map or `CATEGORY_NAMES_KO` fallback. However, the CLI's `report.ts:runReport` command passes raw `CategorizedTransaction[]` to `generateHTMLReport()` and `printOptimizationResult()` without any Korean label resolution for the spending summary table.

  The `buildCategoryTable` function in `generator.ts:64-120` and `printSpendingSummary` in `summary.ts:24-64` both iterate `CategorizedTransaction[]` and aggregate by `tx.category`, but neither has access to the category labels Map. The `generateHTMLReport` function signature is `generateHTMLReport(result: OptimizationResult, transactions: CategorizedTransaction[])` -- it receives the transactions but not the category labels.

  Note: The `result.assignments` and `result.cardResults` in the `OptimizationResult` DO have Korean `categoryNameKo` values (set by `greedy.ts`), and these are correctly rendered in `buildCardComparison` and `buildAssignments`. Only the `buildCategoryTable` function (which shows spending by category from the raw transaction list) is affected.

- **Concrete failure scenario:** Run `cherrypicker report statement.csv`. The terminal summary shows "dining" instead of "외식", "cafe" instead of "카페" in the category column. The HTML report has the same issue in the "카테고리" column of the spending table. The optimization tables (card comparison, assignments) correctly show Korean labels because they use `OptimizationResult.categoryNameKo`.

- **Fix:** Accept an optional `categoryLabels?: Map<string, string>` parameter in `generateHTMLReport` and `printSpendingSummary`, and look up `categoryLabels.get(tx.category) ?? tx.category` instead of using `tx.category` directly as the label. In `tools/cli/src/commands/report.ts`, pass the category labels (already loaded for the `MerchantMatcher`) to these functions. Alternatively, since the `OptimizationResult.assignments` already has per-category Korean labels, `buildCategoryTable` could cross-reference `result.assignments` to resolve labels.

### C50-L01: `String.replace()` in report generator only replaces first occurrence of each placeholder

- **Severity:** LOW (fragility)
- **Confidence:** High
- **File+line:** `packages/viz/src/report/generator.ts:225-230`
- **Description:** `generateHTMLReport` uses `template.replace('{{SUMMARY}}', buildSummary(result))` which only replaces the first occurrence. If the template ever contained a placeholder twice (e.g., a summary section in both the header and footer), the second occurrence would remain unreplaced. Using `replaceAll()` or `split().join()` would be safer. Currently, the template uses each placeholder exactly once, so this is not a live bug.
- **Concrete failure scenario:** If a future template redesign adds `{{SUMMARY}}` in two locations, only the first would be replaced, and the second would render as literal `{{SUMMARY}}` text.
- **Fix:** Use `.replaceAll()` instead of `.replace()` for all template placeholder substitutions. This is a one-line change per substitution.

---

## Final Sweep -- Cross-File Interactions

1. **All `formatWon` implementations are consistent** -- all 4 implementations have `Number.isFinite` guards and negative-zero normalization. (Verified in C47/C48.)

2. **All `formatRate` implementations are consistent** -- all 5 implementations have `Number.isFinite` guards. (Verified in C48.)

3. **TypeScript build is clean** for all packages. Apps/web test file errors (`bun:test` module) are pre-existing and documented. The `llm-fallback.ts` TS2454 fix is confirmed.

4. **Reward calculation consistency** -- `calculateDiscount`, `calculatePoints`, `calculateCashback` all delegate to `calculatePercentageReward`. The `getCalcFn` function in `reward.ts` correctly maps all four types. Mileage uses the points calculator. No divergence.

5. **`buildCategoryKey` export** -- `packages/core/src/index.ts:18` exports `buildCategoryKey` (D-102 is fixed).

6. **SessionStorage validation** -- `isValidTx` checks `Number.isFinite(tx.amount) && tx.amount > 0` (D-99 is fixed).

7. **Web-side vs server-side parser consistency** -- Both have identical date validation (month 1-12, day 1-31), encoding detection (utf-8, euc-kr, cp949 with replacement-character ratio), and amount parsing. The remaining inconsistency is D-106 (bare `catch {}` in web PDF parser).

8. **No new security issues found.** LLM fallback is server-side only with browser guard, API key from env, 30-second timeout, text truncation. No secrets in code.

9. **No new performance issues found.** All previously identified performance concerns remain deferred and are acceptable at current scale.

10. **No new UI/UX issues found.** CategoryBreakdown colors, SavingsComparison animation, FileDropzone validation all previously reviewed and deferred items documented.

11. **Category labels resolution is consistent across the web app** -- `store.svelte.ts`, `analyzer.ts`, and `CardDetail.svelte` all build the same Map with dot-notation keys (`dining.cafe`), subcategory leaf IDs (`cafe`), and parent IDs (`dining`). The C19-02 fix is confirmed working.

12. **Viz package is the only component missing Korean label resolution** -- Both `generator.ts` and `summary.ts` display raw category IDs instead of Korean labels. This is the one remaining gap in the label resolution chain.

---

## Summary of Active Findings

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C50-M01 | MEDIUM | High | `packages/viz/src/report/generator.ts:75`, `packages/viz/src/terminal/summary.ts:37` | Category display in report/terminal uses English IDs instead of Korean labels | NEW, needs fix |
| C50-L01 | LOW | High | `packages/viz/src/report/generator.ts:225-230` | `String.replace()` only replaces first occurrence -- fragile for future template changes | NEW, low priority |
