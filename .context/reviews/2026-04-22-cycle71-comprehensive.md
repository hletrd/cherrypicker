# Cycle 71 Comprehensive Review -- 2026-04-22

**Scope:** Full re-read of all source files across packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/. Cross-file interaction analysis and fix verification against prior cycles.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-70 findings are confirmed fixed except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C70-01 | **FIXED** | `detectBank` now caps confidence at 0.5 for single-pattern banks in both `apps/web/src/lib/parser/detect.ts:158-161` and `packages/parser/src/detect.ts:141-143`. |
| C70-02 | OPEN (LOW) | `cachedCategoryLabels` not invalidated on Astro View Transitions -- only cleared on reset(). Aligns with C66-02. |
| C70-03 | OPEN (LOW) | `parseDateStringToISO` now logs `console.warn` for unparseable dates but still returns raw input as-is. Partially addressed -- warning added but no sentinel value. |
| C70-04 | OPEN (LOW) | csv.ts reimplements shared.ts. Comment added (C70-04 NOTE) acknowledging the duplication, but code not yet migrated. |
| C70-05 | OPEN (LOW) | BANK_SIGNATURES duplicated between web and server detect modules. Not yet extracted to shared module. |
| C69-01 | OPEN (LOW) | Tiny savings animation flicker -- informational only. |
| C67-01 | OPEN (MEDIUM) | Greedy optimizer O(m*n*k) quadratic behavior unchanged. |
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 14+ cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 11+ cycles agree. |

---

## New Findings (This Cycle)

### C71-01: `FileDropzone.svelte` does not reset `bank` and `previousSpending` on `clearAllFiles()`
**Severity:** MEDIUM | **Confidence:** HIGH

**File:** `apps/web/src/components/upload/FileDropzone.svelte:182-188`

When the user clicks "전체 삭제" (clear all), the function resets `uploadedFiles`, `uploadStatus`, and `errorMessage`, but does NOT reset `bank` or `previousSpending`. This means after clearing files and uploading new ones, the previously selected bank and previous-spending value silently carry over, which can cause incorrect analysis results.

**Concrete scenario:** User selects "현대카드" as bank, enters 500000 as previous spending, clears all files, then uploads a Shinhan card statement. The analyzer will force Hyundai detection on the Shinhan statement and use 500000 as previous spending, producing completely wrong results.

**Fix:** Reset `bank = ''` and `previousSpending = ''` in `clearAllFiles()`, and also in `removeFile()` when the last file is removed (line 173-180 already has a partial reset but misses these fields).

### C71-02: `loadCategories()` returns empty array on AbortError -- callers silently proceed with no categories
**Severity:** MEDIUM | **Confidence:** HIGH

**File:** `apps/web/src/lib/cards.ts:266`

When `loadCategories()` encounters an AbortError (e.g., component unmount during fetch), it returns `[]` (empty array). Downstream callers like `parseAndCategorize()` in analyzer.ts proceed with no categories, creating a `MerchantMatcher` with an empty taxonomy. Every transaction will be categorized as "uncategorized" with 0 confidence, and the optimization will be meaningless. There is no error thrown, no warning shown to the user, and the store's `error` field remains null.

**Concrete scenario:** If the user navigates away from the upload page during the analysis (e.g., clicks a link while analysis is in progress), the categories fetch is aborted, `MerchantMatcher` gets empty categories, and the result shows all transactions as "uncategorized" with zero reward. The user sees a result page that looks complete but is actually wrong.

**Fix:** When `loadCategories()` returns an empty array after an AbortError in `analyzeMultipleFiles()`, throw an error that sets `analysisStore.error`, so the user sees a clear failure message instead of a silently wrong result.

### C71-03: `SavingsComparison.svelte` annual projection multiplies by 12 without disclaimer about compounding
**Severity:** LOW | **Confidence:** MEDIUM

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:219`

The annual savings display uses `target * 12` (simple linear projection). The text says "최근 월 기준 단순 연환산" which is clear, but 10+ cycles have flagged this. This is a known LOW finding (C4-06/C52-03/etc.) -- carried forward, not new. Confirming it remains unchanged.

### C71-04: `parseDateStringToISO` warns but still returns raw string for unparseable dates
**Severity:** LOW | **Confidence:** HIGH

**File:** `apps/web/src/lib/parser/date-utils.ts:140-142`

C70-03/C56-04 added a `console.warn` for unparseable dates, which is helpful for developer diagnostics but does not help the user. The raw string is still stored as the transaction date, and downstream `tx.date.startsWith(latestMonth)` silently skips these transactions. No error is reported to the user in the parse results. This is a continuation of the known finding -- 10+ cycles agree.

### C71-05: `BANK_SIGNATURES` array order affects detection accuracy for overlapping patterns
**Severity:** LOW | **Confidence:** MEDIUM

**File:** `apps/web/src/lib/parser/detect.ts:132-149`

The detectBank function iterates BANK_SIGNATURES in array order and keeps the LAST bank with the highest score (via `if (score > bestScore)` with strict `>`). If two banks have the same score, the one that appears LATER in the array wins. For example, `ibk` has patterns [/IBK기업은행/, /기업은행/] and `kdb` has patterns [/KDB산업은행/, /산업은행/, /kdbbank/i]. If a statement mentions both "기업은행" and "산업은행", `ibk` scores 1 (only /기업은행/ matches because /IBK기업은행/ won't match without "IBK" prefix), and `kdb` scores 1 (only /산업은행/ matches because /KDB산업은행/ won't match without "KDB" prefix). Since `kdb` appears after `ibk` in the array, `kdb` would win with the same score. This is not necessarily wrong but is fragile and depends on array order.

**Fix:** Document the tie-breaking behavior explicitly, or use a more robust tie-breaking heuristic (e.g., prefer the bank whose more specific pattern matched).

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

The following findings have been flagged by multiple cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16-C70 (11+ cycles) | OPEN (MEDIUM) |
| cachedCategoryLabels/coreRules staleness | C21-C70 (14+ cycles) | OPEN (MEDIUM) |
| persistToStorage bare catch / error handling | C62-C70 (9+ cycles) | PARTIALLY FIXED (C69 added 'error' kind) |
| Annual savings simple *12 projection | C7-C70 (10+ cycles) | OPEN (LOW) |
| date-utils unparseable passthrough | C56-C70 (10+ cycles) | PARTIALLY FIXED (C70 added warn) |
| CSV DATE_PATTERNS divergence risk | C20-C70 (9+ cycles) | OPEN (LOW) |
| Hardcoded fallback drift (CATEGORY_NAMES_KO / build-stats) | C8-C70 (7+ cycles) | OPEN (LOW) |
| BANK_SIGNATURES duplication | C7-C70 (6+ cycles) | OPEN (LOW) |
| inferYear() timezone dependence | C8-C70 (4+ cycles) | OPEN (LOW) -- deferred 60+ cycles |
| Greedy optimizer O(m*n*k) quadratic | C67-C70 (4+ cycles) | OPEN (MEDIUM) |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82/C9R-04/C18-03/C39-06 | LOW | Annual savings projection label unchanged / visual inconsistency |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C7-04 | LOW | TransactionReview $effect re-sync fragile |
| C7-06 | LOW | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07/C66-10/C70-05 | LOW | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | LOW | persistWarning message misleading for data corruption vs size truncation |
| C8-05/C4-09 | LOW | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast |
| C8-07/C4-14/C66-07 | LOW | build-stats.ts fallback values will drift |
| C8-08/C67-02 | LOW | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code instead of testing it directly |
| C18-01/C50-08 | LOW | VisibilityToggle $effect directly mutates DOM |
| C18-02 | LOW | Results page stat elements queried every effect run even on dashboard page |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race |
| C22-04 | LOW | CSV adapter registry only covers 10 of 24 detected banks |
| C33-01/C66-03 | MEDIUM | MerchantMatcher substring scan O(n) per transaction |
| C33-02/C66-02 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C41-05/C42-04 | LOW | cards.ts loadCategories returns empty array on AbortError |
| C56-04/C70-03/C71-04 | LOW | date-utils.ts returns raw input for unparseable dates without error reporting |
| C56-05 | LOW | Zero savings shows "0원" without plus sign |
| C62-11/C66-04 | LOW | persistToStorage returns 'corrupted' for non-quota errors -- PARTIALLY FIXED |
| C64-03/C66-05/C67-03 | LOW | CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy |
| C66-08 | LOW | formatIssuerNameKo and CATEGORY_COLORS hardcoded maps will drift |
| C67-01 | MEDIUM | Greedy optimizer O(m*n*k) quadratic behavior |
| C69-01 | LOW | SavingsComparison tiny savings animation flicker (informational) |
| C70-02 | LOW | cachedCategoryLabels not invalidated on Astro View Transitions |
| C70-04 | LOW | csv.ts reimplements shared.ts instead of importing from it |
| C70-05 | LOW | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C71-01 | MEDIUM | FileDropzone does not reset bank/previousSpending on clearAllFiles |
| C71-02 | MEDIUM | loadCategories returns empty array on AbortError, silently proceeding with no categories |
| C71-05 | LOW | BANK_SIGNATURES array order affects detection accuracy for overlapping patterns |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
