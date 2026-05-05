# Tracer — cherrypicker (Cycle 13)

**Reviewer:** tracer
**Date:** 2026-05-05

---

## Summary

Causal tracing of key data flows. No new suspicious flows found. The C13-04 bug (PDF trailing-minus) exists in the fallback extraction path but does not propagate to structured table parsing.

---

## Traced Flows

### Flow 1: Multi-file upload through optimization
**Path:** FileDropzone.handleUpload -> analysisStore.analyze -> analyzeMultipleFiles -> parseAndCategorize (per file) -> loadCategories (shared) -> MerchantMatcher.match -> optimizeFromTransactions -> buildConstraints -> greedyOptimize

**Findings:** Clean flow. parseFile -> MerchantMatcher.match -> greedyOptimize -> store.assignments -> CategoryBreakdown/SavingsComparison. No data corruption paths.

### Flow 2: Category edit and reoptimize
**Path:** TransactionReview.changeCategory -> editedTxs[idx] = updated -> applyEdits -> analysisStore.reoptimize -> getCategoryLabels (cached) -> optimizeFromTransactions -> greedyOptimize -> persistToStorage

**Findings:** The snapshot pattern at line 497 of `store.svelte.ts` correctly captures `result` immediately after the null guard. The `cachedCategoryLabels` guard at line 394-397 prevents caching an empty Map from an AbortError.

### Flow 3: PDF fallback path
**Path:** parsePDF -> extractPDFTable -> structured parse fails -> fallback line scanner -> dateMatch + amountMatch -> parseAmount -> filter amount>0 -> push to fallbackTransactions

**Findings:** The C13-04 bug exists in the amount extraction step. When group 6 matches, the trailing minus is lost before `parseAmount` sees it. The `amount > 0` filter at line 613 then incorrectly includes what should be a skipped refund.

---

## Findings

### C13-TR01: PDF fallback path has amount-sign loss (MEDIUM)

**File:** `apps/web/src/lib/parser/pdf.ts:565-622`
**Detail:** In the fallback path, a refund amount like `"1,234-"` is captured as `"1,234"` (positive) due to the regex group boundary. The `amount > 0` guard at line 613 does not catch this because the negativity was already lost. The structured table path (lines 418-420) is unaffected because `parseAmount` there receives the raw cell text including the minus.

---

## Gate Evidence

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `bun run test` — PASS
- `npx vitest run` — PASS
