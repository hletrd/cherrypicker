# Cycle 80 Comprehensive Review — 2026-04-22

**Method:** Full re-read of all source files in apps/web/src/, packages/core/src/, packages/parser/src/, packages/rules/src/, packages/viz/src/, tools/. Cross-file interaction analysis. Fix verification for prior cycle findings.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-79 findings are confirmed fixed except as noted in the aggregate.

| Finding | Status | Evidence |
|---|---|---|
| C79-01 | **FIXED** | `TransactionReview.svelte` line 185 now sets `rawCategory: undefined` on manual override for both subcategory and top-level category paths. |
| C79-02 | OPEN (LOW) | VisibilityToggle `$effect` directly mutates DOM. Same as C18-01/C76-04. Functional but non-idiomatic. |
| C79-03 | OPEN (LOW) | SavingsComparison `displayedAnnualSavings` starts at 0. Same as C69-01/C73-01. Brief "0원" flash. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C80-01 | MEDIUM | HIGH | `apps/web/src/components/upload/FileDropzone.svelte:138` | Duplicate-file detection uses filename only (`existing.name === f.name`). Two different credit card statements with the same filename (e.g., "statement.csv" from different months) are treated as duplicates — the second file is silently dropped and only shown in the "같은 이름의 파일이 이미 있어요" warning. The user may not realize the second file is a different statement that should be included in multi-month analysis. **Fix:** Use a combination of filename + file size (or lastModified timestamp) for dedup, or allow the user to force-add a same-named file. |
| C80-02 | LOW | MEDIUM | `apps/web/src/components/dashboard/TransactionReview.svelte:252-259` | The "변경 적용" button is disabled during reoptimization (`disabled={reoptimizing}`), but the category `<select>` dropdowns in each transaction row are NOT disabled. If the user changes a category while reoptimization is in progress, that edit is lost — the reoptimization result overwrites `editedTxs` via `analysisStore.reoptimize(editedTxs)` (captured at call time). **Fix:** Disable the `<select>` elements while `reoptimizing` is true, or buffer concurrent edits and merge them after reoptimization completes. |
| C80-03 | LOW | MEDIUM | `apps/web/src/lib/parser/csv.ts:158` vs `apps/web/src/lib/parser/xlsx.ts:365` | CSV generic parser scans up to 20 lines for header detection (`Math.min(20, lines.length)`), while the XLSX parser scans up to 30 rows (`Math.min(30, rows.length)`). Some Korean bank CSV exports may have more than 20 metadata/header rows (especially multi-card statements with card info blocks). A CSV that the XLSX parser would handle could fail in the CSV path. **Fix:** Increase the CSV scan limit to 30 to match the XLSX parser, or make both configurable. |

---

## Confirmed Still-Open Findings (carried forward, not new)

All findings from the cycle 79 aggregate remain open at their documented severity/confidence. No regressions detected. The long-standing open items with the most cross-cycle convergence remain:

1. **C33-01/C66-03 (MEDIUM):** MerchantMatcher substring scan O(n) per transaction — 20+ cycles agree
2. **C33-02/C66-02 (MEDIUM):** cachedCategoryLabels stale across redeployments — 23+ cycles agree
3. **C67-01/C74-06 (MEDIUM):** Greedy optimizer O(m*n*k) quadratic behavior — 13+ cycles agree
4. **C4-10 (MEDIUM):** E2E test stale dist/ dependency
5. **C4-11 (MEDIUM):** No regression test for findCategory fuzzy match

---

## Files Reviewed (this cycle)

- `apps/web/src/components/dashboard/TransactionReview.svelte`
- `apps/web/src/components/dashboard/SavingsComparison.svelte`
- `apps/web/src/components/dashboard/SpendingSummary.svelte`
- `apps/web/src/components/dashboard/CategoryBreakdown.svelte`
- `apps/web/src/components/upload/FileDropzone.svelte`
- `apps/web/src/components/ui/VisibilityToggle.svelte`
- `apps/web/src/lib/store.svelte.ts`
- `apps/web/src/lib/analyzer.ts`
- `apps/web/src/lib/formatters.ts`
- `apps/web/src/lib/cards.ts`
- `apps/web/src/lib/parser/csv.ts`
- `apps/web/src/lib/parser/xlsx.ts`
- `apps/web/src/lib/parser/pdf.ts`
- `apps/web/src/lib/parser/date-utils.ts`
- `apps/web/src/layouts/Layout.astro`
- `packages/core/src/optimizer/ilp.ts`
