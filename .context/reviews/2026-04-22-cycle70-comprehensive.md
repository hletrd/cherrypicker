# Cycle 70 Comprehensive Review -- 2026-04-22

**Scope:** Full re-read of all source files across packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/. Cross-file interaction analysis and fix verification against prior cycles.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-69 findings are confirmed fixed except as noted below.
No new fix verifications this cycle.

| Finding | Status | Evidence |
|---|---|---|
| C68-01 | **FIXED** | Server-side PDF `isValidShortDate` uses `MAX_DAYS_PER_MONTH` table. |
| C68-02 | **FIXED** | `scoreCardsForTransaction` uses push/pop instead of spread array. |
| C69-01 | OPEN (LOW) | Tiny savings animation flicker -- informational only. |
| C69-02 | **FIXED** | `parseCSVAmount` handles parenthesized negatives. |
| C67-01 | OPEN (MEDIUM) | Greedy optimizer O(m*n*k) quadratic behavior unchanged. |
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` stale across redeployments. 13+ cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction. 11+ cycles agree. |
| C66-04 | OPEN (LOW) | `persistToStorage` returns 'corrupted' for non-quota errors -- now partially fixed (C69 added 'error' kind). |
| C66-05 | OPEN (LOW) | `FALLBACK_CATEGORIES` hardcoded 13 categories vs 40+ in taxonomy. |
| C66-08 | OPEN (LOW) | `formatIssuerNameKo` and `CATEGORY_COLORS` hardcoded maps will drift. |
| C66-10 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between server and web. |

---

## New Findings (This Cycle)

### C70-01: `detectBank` single-pattern banks can false-positive with 100% confidence
**Severity:** MEDIUM | **Confidence:** HIGH

**File:** `apps/web/src/lib/parser/detect.ts:91-105`

Banks with only one generic pattern (e.g., `cu` with `/신협/`, `kdb` with `/산업은행/`) achieve 1.0 confidence on a single match. The comment on line 124 acknowledges this (citing D-65), but no mitigation exists. A statement mentioning "산업은행" in any context (e.g., a KDB bank transfer) will always detect as `kdb` with 100% confidence, even if the actual card is from another issuer.

**Concrete scenario:** A Shinhan card statement containing a transaction at "KDB산업은행" (a payment to KDB) would be detected as `kdb` bank, causing all column mappings to fail because the header format doesn't match KDB's expected headers.

**Fix:** Require multi-pattern match (score >= 2) for high confidence, or weigh pattern specificity. For single-pattern banks, cap confidence at 0.5.

### C70-02: `cachedCategoryLabels` in store.svelte.ts not invalidated on Astro View Transitions
**Severity:** LOW | **Confidence:** MEDIUM

**File:** `apps/web/src/lib/store.svelte.ts:330-337`

The `cachedCategoryLabels` Map is only cleared in `reset()`. During Astro View Transitions (client-side navigation), the store instance persists but `invalidateAnalyzerCaches()` is only called from `reset()`. If the categories.json endpoint is updated between page navigations (e.g., after a redeploy), the cached labels become stale. This is a narrow edge case because categories.json is typically static, but it aligns with the broader C66-02 finding about `cachedCategoryLabels` staleness.

**Fix:** Call `invalidateAnalyzerCaches()` and clear `cachedCategoryLabels` in the `setResult()` method, or use a TTL-based cache invalidation.

### C70-03: `parseDateStringToISO` returns raw input for unparseable dates without any error indicator
**Severity:** LOW | **Confidence:** HIGH

**File:** `apps/web/src/lib/parser/date-utils.ts:134`

When no date format matches, `parseDateStringToISO` returns the cleaned input string as-is. Downstream code in csv.ts and xlsx.ts then stores this raw string as the transaction date. This means corrupted or unexpected date formats (e.g., "Q1 2025", "2025/Q1") are silently passed through without any error or warning, and the transaction will have an invalid date string that breaks date-based filtering (e.g., `tx.date.startsWith(latestMonth)` in analyzer.ts:307).

**Concrete scenario:** A CSV with "24.03.15" (which doesn't match `^\d{2}[.\-\/]\d{2}[.\-\/]\d{2}$` because it has leading zeros in day/month) would be returned as "24.03.15" and fail date-slicing.

**Fix:** Return a sentinel value like `"UNPARSEABLE:${cleaned}"` or add an error reporting mechanism so callers can log the failure. This has been tracked as C56-04 (9 cycles agree) but the fix is straightforward.

### C70-04: `csv.ts` re-implements `splitCSVLine` and `parseAmount` instead of using `shared.ts`
**Severity:** LOW | **Confidence:** HIGH

**File:** `apps/web/src/lib/parser/csv.ts:8-86`

The web CSV parser defines its own `splitLine()`, `parseAmount()`, `parseInstallments()`, and `isValidAmount()` functions that duplicate the logic in `packages/parser/src/csv/shared.ts`. The `shared.ts` module was specifically extracted to "eliminate duplicated splitLine/parseAmount/installment-parsing code across 11 files (C36-02)", but the web CSV parser was not migrated to use it.

The implementations differ slightly:
- `csv.ts:splitLine()` vs `shared.ts:splitCSVLine()` -- identical logic
- `csv.ts:parseAmount()` adds `replace(/\s/g, '')` not present in `shared.ts:parseCSVAmount()`
- `csv.ts:isValidAmount()` adds type guard and zero/negative filtering not in shared.ts
- `csv.ts:parseInstallments()` vs `shared.ts:parseCSVInstallments()` -- identical logic

**Fix:** Import from `shared.ts` and add the extra whitespace stripping to `parseCSVAmount`, or create a `parseCSVAmountWeb` wrapper. The `isValidAmount` type guard should be added to shared.ts.

### C70-05: `BANK_SIGNATURES` is duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts`
**Severity:** LOW | **Confidence:** HIGH

**Files:**
- `apps/web/src/lib/parser/detect.ts:8-105`
- `packages/parser/src/detect.ts:10-107`

Both files define identical `BANK_SIGNATURES` arrays. Any update to one must be replicated in the other, or detection behavior will diverge. This is the same finding as C66-10/C7-07 but I'm adding specific evidence: the web version has a `detectFormatFromFile()` function not present in the server version, and the server version has a `detectFormat()` (async, file-path-based) function not present in the web version. The shared `BANK_SIGNATURES` array should be extracted to a shared location.

**Fix:** Extract `BANK_SIGNATURES` and `detectBank()` to a shared module (e.g., `packages/parser/src/detect-shared.ts`) that both web and server can import.

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

The following findings have been flagged by multiple cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16-C69 (11+ cycles) | OPEN (MEDIUM) |
| cachedCategoryLabels/coreRules staleness | C21-C69 (13+ cycles) | OPEN (MEDIUM) |
| persistToStorage bare catch / error handling | C62-C69 (8+ cycles) | PARTIALLY FIXED (C69 added 'error' kind) |
| Annual savings simple *12 projection | C7-C69 (10+ cycles) | OPEN (LOW) |
| date-utils unparseable passthrough | C56-C69 (9+ cycles) | OPEN (LOW) -- C70-03 adds evidence |
| CSV DATE_PATTERNS divergence risk | C20-C69 (9+ cycles) | OPEN (LOW) |
| Hardcoded fallback drift (CATEGORY_NAMES_KO / build-stats) | C8-C69 (7+ cycles) | OPEN (LOW) |
| BANK_SIGNATURES duplication | C7-C69 (5+ cycles) | OPEN (LOW) -- C70-05 adds evidence |
| inferYear() timezone dependence | C8-C69 (4+ cycles) | OPEN (LOW) -- deferred 60+ cycles |
| Greedy optimizer O(m*n*k) quadratic | C67-C69 (3+ cycles) | OPEN (MEDIUM) |
| detectBank single-pattern 100% confidence | C70 | NEW (MEDIUM) -- related to D-65 |
| csv.ts reimplements shared.ts | C70 | NEW (LOW) |

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
| C33-01/C66-03 | MEDIUM | MerchantMatcher substring scan O(n) per transaction -- partially fixed |
| C33-02/C66-02 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C34-04 | LOW | Server-side PDF has no fallback line scanner -- FIXED in cycle 69 |
| C41-05/C42-04 | LOW | cards.ts loadCategories returns empty array on AbortError |
| C56-04/C70-03 | LOW | date-utils.ts returns raw input for unparseable dates without error reporting |
| C56-05 | LOW | Zero savings shows "0원" without plus sign |
| C62-11/C66-04 | LOW | persistToStorage returns 'corrupted' for non-quota errors -- PARTIALLY FIXED |
| C64-03/C66-05/C67-03 | LOW | CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy |
| C66-08 | LOW | formatIssuerNameKo and CATEGORY_COLORS hardcoded maps will drift |
| C67-01 | MEDIUM | Greedy optimizer O(m*n*k) quadratic behavior |
| C69-01 | LOW | SavingsComparison tiny savings animation flicker (informational) |
| C70-01 | MEDIUM | detectBank single-pattern banks can false-positive with 100% confidence |
| C70-04 | LOW | csv.ts reimplements shared.ts instead of importing from it |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
