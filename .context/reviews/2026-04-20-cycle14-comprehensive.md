# Comprehensive Code Review -- Cycle 14

**Date:** 2026-04-20
**Reviewer:** Single-agent comprehensive review (cycle 14 of review-plan-fix loop)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-53 reviews and the cycle 13 aggregate. Ran `bun test` (266 pass, 0 fail), `bun run lint` (0 errors), `bun run typecheck` (0 errors), and `bun run build` (success). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior "Still-Open" Deferred Findings

All deferred findings from the aggregate (`.context/reviews/_aggregate.md`) are confirmed still present unless noted:

| Finding | Status | Notes |
|---|---|---|
| C13-01 | **FIXED** | `cards.ts:160-167` now has `chainAbortSignal` -- second caller's signal is chained to the active AbortController |
| C13-02 | **FIXED** | `cards.ts:199-226` `loadCategories` now accepts optional `signal` parameter with same chain pattern |
| C13-03 | **FIXED** | `SpendingSummary.svelte:12-15` now uses `$derived` for `totalAllSpending` instead of inline reduce |
| C13-04 | **FIXED** | `CardPage.svelte:14-30` now uses AbortController + generation counter pattern matching CardDetail |
| C7-04 | STILL DEFERRED | TransactionReview $effect re-sync fragile |
| C7-06 | STILL DEFERRED | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | STILL DEFERRED | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-10 | STILL DEFERRED | CategoryBreakdown percentage rounding can cause total > 100% |
| C7-11 | STILL DEFERRED | persistWarning message misleading for data corruption vs size truncation |
| C8-01 | STILL DEFERRED | AI categorizer disabled but dead code |
| C8-05/C4-09 | STILL DEFERRED | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast |
| C8-06/C7-12 | STILL DEFERRED | FileDropzone + CardDetail use full page reload navigation |
| C8-07/C4-14 | STILL DEFERRED | build-stats.ts fallback values will drift |
| C8-08 | STILL DEFERRED | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | STILL DEFERRED | Test duplicates production code |
| C8-10 | STILL DEFERRED | csv.ts installment NaN fragile implicit filter |
| C8-11 | STILL DEFERRED | pdf.ts fallback date regex could match decimals |
| C9R-03 | STILL DEFERRED | pdf.ts negative amounts (refunds) silently dropped |
| D-106 | STILL DEFERRED | bare `catch {}` in pdf.ts tryStructuredParse |
| D-110 | STILL DEFERRED | Non-latest month edits have no visible optimization effect |
| C4-06/C52-03 | STILL DEFERRED | Annual savings projection label unchanged |
| C4-10 | STILL DEFERRED | E2E test stale dist/ dependency |
| C4-11 | STILL DEFERRED | No regression test for findCategory fuzzy match |
| C4-13/C9-08 | STILL DEFERRED | Small-percentage bars nearly invisible |
| C53-02 | STILL DEFERRED | Duplicated card stats reading logic |
| C53-03 | STILL DEFERRED | CardDetail performance tier header dark mode contrast |
| D-66 | STILL DEFERRED | CardGrid issuer filter shows issuers with 0 cards after type filter |

---

## New Findings

### C14-01: `cards.ts:181` -- `loadCardsData` catch block resets cache even on AbortError (MEDIUM, Medium)

**File:** `apps/web/src/lib/cards.ts:186-190`
**Description:** When `loadCardsData` fetch is aborted (e.g., component unmount), the `.catch` handler unconditionally resets `cardsPromise = null` and `cardsAbortController = null`. This means a deliberate abort by one component clears the cache for all future callers. If component A starts loading, component B chains its signal, then component A aborts, the cache is cleared even though B still wanted the data. The next call to `loadCardsData` will re-fetch from scratch. The same issue exists in `loadCategories` (lines 217-220).
**Failure scenario:** Two components mount simultaneously and both call `loadCardsData`. One unmounts and aborts. The cache is cleared, forcing the other component to re-fetch. This is a correctness regression from the fix for C13-01/C13-02 -- the chainAbortSignal fix correctly propagates the abort, but the catch block doesn't distinguish between AbortError (expected cancellation) and real network errors.
**Fix:** In the `.catch` handler, check if the error is an `AbortError` and only reset the cache for non-abort errors. For AbortError, keep the promise as null but don't log it as an error.

### C14-02: `CategoryBreakdown.svelte:88-89` -- Percentage rounding can exceed 100% (confirmation of C7-10, new analysis)

**File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:88-89`
**Description:** This is already tracked as C7-10 but providing additional analysis. The percentages are computed as `Math.round((a.spending / totalSpending) * 1000) / 10` (one decimal). With many categories, rounding can cause the sum to exceed 100%. For example, 3 categories of 33.33% each round to 33.3% + 33.3% + 33.3% = 99.9% (which is fine), but 7 categories of 14.29% each round to 14.3% * 7 = 100.1%. The UI does not show a total, so the visual impact is minimal, but it could confuse users who sum the values.
**Not a new finding** -- already tracked as C7-10. Providing additional concrete example for future fix.

### C14-03: `xlsx.ts:314-316` -- `isHTMLContent` only checks UTF-8 decoding of first 512 bytes (LOW, Low)

**File:** `apps/web/src/lib/parser/xlsx.ts:314-316`
**Description:** The `isHTMLContent` function decodes the first 512 bytes as UTF-8 to check for HTML markers. If the file is encoded in EUC-KR (common for Korean bank exports), the HTML markers like `<html` or `<table` might not be correctly decoded from the raw bytes, causing a false negative. The file would then be parsed as a binary XLSX, which would likely fail or produce garbage.
**Failure scenario:** A Korean bank exports an HTML table with .xls extension encoded in EUC-KR. The first 512 bytes decoded as UTF-8 produce garbled characters, `isHTMLContent` returns false, and the file is parsed as binary XLSX, failing silently or producing no transactions.
**Fix:** Try decoding with both UTF-8 and EUC-KR, similar to the encoding detection in `parseFile` (index.ts:20-34). Or check for the byte patterns of HTML tags directly without text decoding.

### C14-04: `SavingsComparison.svelte:207` -- Annual savings label uses monthly savings * 12 without compounding or disclaimer (LOW, Low)

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:207`
**Description:** The annual savings projection multiplies the current month's savings by 12 (`opt.savingsVsSingleCard * 12`). This assumes identical spending every month, which is unrealistic. The label says "연간 약" (approximately annual) which partially addresses this, but the projection doesn't account for: (1) varying monthly spending, (2) card benefit caps that reset monthly, (3) performance tier changes if spending changes. This is already tracked as C4-06/C52-03 but the specific line reference was not previously noted.
**Not a new finding** -- already tracked as C4-06/C52-03. Confirming it is still present with specific line reference.

---

## Cross-File Consistency Checks

1. **`chainAbortSignal` in cards.ts:** Both `loadCardsData` and `loadCategories` now use the same `chainAbortSignal` helper. Consistent.

2. **AbortController + generation counter pattern:** Both `CardPage.svelte` and `CardDetail.svelte` now use the same pattern for race-condition-safe async fetches. Consistent.

3. **`$derived` for computed values in SpendingSummary:** Now uses `$derived.by` for `totalAllSpending` instead of inline reduce. Consistent with other dashboard components.

4. **`parseDateToISO` implementations (3 locations: csv.ts, pdf.ts, xlsx.ts):** All have month/day range validation. All handle the same set of date formats. Consistent.

5. **`inferYear` implementations (3 locations):** All use the same 90-day look-back heuristic. Consistent.

6. **Category labels building:** Duplicated in 4 places (analyzer.ts:210-223, store.svelte.ts:262-276, CardDetail.svelte:22-36, TransactionReview.svelte:53-67). Already tracked as code duplication, not a correctness issue.

7. **`loadCardsData`/`loadCategories` catch block:** Both reset cache on any error including AbortError. See C14-01.

---

## Final Sweep

- No new security issues beyond what is already tracked.
- No new performance issues beyond what is already tracked.
- No new type safety issues. All gates pass (lint, typecheck, test, build).
- The `categorizer-ai.ts` file is still disabled (dead code, tracked as C8-01).
- The ILP optimizer stub is still a pass-through to greedy, documented with a TODO.
- No new test coverage gaps beyond C4-10 and C4-11 (already deferred).
- No new UI/UX accessibility issues beyond what is already tracked.
- CSP meta tag uses `'unsafe-inline'` for both script-src and style-src, documented with a TODO for nonce-based CSP. Already tracked.
- No `innerHTML` usage anywhere in the codebase (confirmed by grep).
- No `as any` casts anywhere in the web app code (confirmed by grep).
- No `Object.is(-0)` guard issues remaining (C12-04 fixed).
- `OptimalCardMap.svelte` maxRate floor is 0.001 (C12-01 improved, confirmed).

---

## Summary

1 genuinely new actionable finding this cycle (C14-01: loadCardsData/loadCategories catch block resets cache on AbortError). 3 prior findings confirmed fixed (C13-01, C13-02, C13-03, C13-04 all fixed by the chainAbortSignal + CardPage AbortController improvements). 1 informational finding (C14-03: HTML detection encoding edge case). All gates green. Codebase is stable with no high-severity new findings.
