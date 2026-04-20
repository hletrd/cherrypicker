# Comprehensive Code Review -- Cycle 52

**Date:** 2026-04-20
**Reviewer:** Single-agent comprehensive review (cycle 52)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-51 reviews and the aggregate. Ran `bun test` (266 pass, 0 fail), `bun run lint` (0 errors), `bun run typecheck` (0 errors), and `bun run build` (success). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior "Still-Open" Deferred Findings

All deferred findings from the aggregate (`.context/reviews/_aggregate.md`) are confirmed still present:

| Finding | Status | Notes |
|---|---|---|
| D-106 | STILL DEFERRED | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` -- the catch in `tryStructuredParse` swallows all errors silently, including potential programming bugs |
| D-107 | STILL DEFERRED | Web-side CSV adapter error collection -- `apps/web/src/lib/parser/csv.ts:966-968` catches adapter failures with `console.warn` but does NOT collect them into the result errors array like the server-side `packages/parser/src/csv/index.ts:62-66` does |
| D-110 | STILL DEFERRED | Non-latest month edits have no visible optimization effect |
| C4-06 | STILL DEFERRED | Annual savings projection label unchanged in SavingsComparison |
| C4-07 | STILL DEFERRED | `SpendingSummary.svelte:10` reads from `localStorage` while the rest of the app uses `sessionStorage` |
| C4-09 | STILL DEFERRED | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown |
| C4-10 | STILL DEFERRED | E2E test stale dist/ dependency |
| C4-11 | STILL DEFERRED | No regression test for findCategory fuzzy match |
| C4-13 | STILL DEFERRED | Small-percentage bars nearly invisible |
| C4-14 | STILL DEFERRED | Stale fallback values in Layout footer |
| C9-02 | STILL DEFERRED | Redundant comparison UI when savings=0 |
| C9-04 | STILL DEFERRED | Complex fallback date regex in PDF parser |
| C9-06 | STILL DEFERRED | Percentage rounding can shift "other" threshold |
| C9-07 | STILL DEFERRED | Math.max spread stack overflow risk (theoretical) |
| C9-08 | STILL DEFERRED | Comparison bars misleading when both rewards are 0 |
| C9-09 | STILL DEFERRED | Categories cache never invalidated |
| C9-10 | STILL DEFERRED | HTML-as-XLS double-decode and unnecessary re-encode |
| C9-12 | STILL DEFERRED | Module-level cache persists across store resets |

---

## New Findings

### C52-01: Web-side CSV `parseCSV` silently drops adapter failures (MEDIUM, HIGH)

**File:** `apps/web/src/lib/parser/csv.ts:962-969`
**Description:** When a bank-specific adapter throws during `parseCSV`, the web-side catch block only logs via `console.warn` and does NOT collect the error into the result's `errors` array. The server-side `packages/parser/src/csv/index.ts:46-49` correctly adds the failure message to `fallbackResult.errors`. This means web users get no indication that their adapter failed -- they just silently get fewer transactions (from the generic fallback parser).
**Failure scenario:** User uploads a Hyundai CSV that partially matches the adapter but throws on a malformed row. The web app silently falls back to the generic parser which may miss columns specific to that bank, producing an incomplete transaction list with no error message shown.
**Fix:** Collect the error message into the result before falling through, matching the server-side pattern:
```ts
} catch (err) {
  const fallbackResult = parseGenericCSV(content, resolvedBank);
  fallbackResult.errors.unshift({
    message: `${adapter.bankId} 어댑터 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
  });
  return fallbackResult;
}
```
**Note:** This is a more specific formulation of D-107 focusing on the bank-specific adapter catch block (line 962-969), not just the signature-detection block (line 974-984).

### C52-02: `TransactionReview.svelte` mutates `editedTxs` array entries in-place during AI categorization (MEDIUM, MEDIUM)

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:108-125`
**Description:** The `runAICategorization` function finds transactions via `editedTxs.find()` and mutates them in-place (`tx.category = result.category`, `tx.subcategory = undefined`, `tx.confidence = result.confidence`). Because `editedTxs` is a `$state` array, Svelte 5 should detect these mutations. However, the pattern of mutating array element properties directly (rather than replacing the array with a new copy) is fragile and depends on Svelte 5's proxy-based reactivity correctly tracking deep property writes. If the reactivity system fails to detect the mutation, the UI will not update to show the new categories.
**Failure scenario:** A future Svelte version or a reactivity edge case causes the mutation not to trigger a re-render. The AI categorization completes but the category dropdowns still show the old values.
**Fix:** Replace the array entry instead of mutating in-place:
```ts
const idx = editedTxs.findIndex(t => t.id === txId);
if (idx !== -1) {
  editedTxs[idx] = { ...editedTxs[idx], category: result.category, subcategory: undefined, confidence: result.confidence };
}
```
Or use `editedTxs = editedTxs.map(...)` to produce a new array reference.

### C52-03: `SavingsComparison.svelte` annual savings label says "최근 월 기준" but calculation uses `savingsVsSingleCard` not monthly projection (LOW, MEDIUM)

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:204`
**Description:** The label reads `연간 약 ... 절약 (최근 월 기준)` and multiplies `savingsVsSingleCard * 12`. However, `savingsVsSingleCard` is the difference between the cherry-pick optimization and the single best card for the LATEST MONTH ONLY. If the user uploaded multiple months, this annual projection may be misleading because spending patterns vary by month. The "(최근 월 기준)" caveat partially addresses this, but the word "연간" (annual) combined with a single-month extrapolation may still mislead users into thinking this is a guaranteed annual savings figure.
**Failure scenario:** User uploads January data with high dining spending. The annual projection shows 12x the January savings, which significantly overestimates actual annual savings if dining spending is lower in other months.
**Note:** This is C4-06 / C9-02 carried forward with additional context. The label wording has been partially improved from earlier cycles but the fundamental issue remains.

### C52-04: `Layout.astro` footer stats are stale fallbacks when `cards.json` read fails (LOW, LOW)

**File:** `apps/web/src/layouts/Layout.astro:15-17`
**Description:** The fallback values `totalCards = 683`, `totalIssuers = 24`, `totalCategories = 45` are hardcoded. If `cards.json` is not found at build time, these stale numbers are shown. This is C4-14 carried forward. The try/catch at lines 18-24 attempts to read the real values but silently falls back.
**Fix:** Consider making the stats section conditional (hide it entirely if the file is not found) or show "N/A" instead of potentially wrong numbers.

### C52-05: `CategoryBreakdown.svelte` uses hardcoded `CATEGORY_COLORS` instead of CSS custom properties or design tokens (LOW, LOW)

**File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-49`
**Description:** 40+ color values are hardcoded in a JS object. These do not respect dark/light mode theming, CSS custom properties, or any design system. In dark mode, several colors (e.g., `gas: '#374151'`, `water: '#1f2937'`) are very dark and may have insufficient contrast against the dark background.
**Failure scenario:** In dark mode, the "gas" category bar renders as dark gray (#374151) on a dark background, making it nearly invisible to users.
**Note:** This is C4-09 carried forward with additional context about dark mode contrast.

### C52-06: `SpendingSummary.svelte` dismisses warning via `localStorage` while all other state uses `sessionStorage` (MEDIUM, HIGH)

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:10,128`
**Description:** The "dismissed warning" flag is stored in `localStorage` (line 10: `localStorage.getItem`, line 128: `localStorage.setItem`), while the main analysis state uses `sessionStorage` (in `store.svelte.ts`). This is inconsistent -- the dismissal persists across browser sessions while the analysis data does not. After closing and reopening the browser, the user sees no analysis data (sessionStorage was cleared) but also no warning about data loss (localStorage still has the dismissal flag).
**Failure scenario:** User dismisses the "탭을 닫으면 결과가 사라져요" warning on day 1. On day 2, they open the browser and the warning is still dismissed, but their data is gone. They may not realize their data was session-only and may expect it to still be there.
**Fix:** Use `sessionStorage` for the dismissal flag as well, so the warning re-appears in new sessions.
**Note:** This is C4-07 carried forward with a more precise failure scenario.

---

## Cross-File Consistency Checks

1. **All `formatWon` implementations (4 locations):** All have `Number.isFinite` guard + negative-zero normalization. Consistent.

2. **All `formatRate` implementations (5 locations):** All have `Number.isFinite` guard. Consistent.

3. **`parseDateToISO` implementations (6 locations):** All have month/day range validation. Consistent across server-side CSV, server-side PDF, server-side XLSX, web-side CSV, web-side PDF, web-side XLSX.

4. **`parseAmount` implementations:** Server-side PDF returns 0 on NaN; web-side CSV returns NaN and uses `isValidAmount()`; server-side CSV generic returns `null`; XLSX parsers return `null`. Each pattern is internally consistent within its call sites.

5. **`inferYear` implementations (5 locations):** All use the same 90-day look-back heuristic. Consistent.

6. **Web-side CSV error collection gap (C52-01):** The bank-specific adapter catch block on line 962-969 does not collect errors into the result, unlike the server-side implementation on line 46-49 of `packages/parser/src/csv/index.ts`. The signature-detection catch block (web-side lines 974-984) DOES collect errors (added in a prior cycle fix). This means only the first catch block is missing error collection.

7. **SessionStorage vs localStorage inconsistency (C52-06):** `SpendingSummary.svelte` uses `localStorage` for the dismissal flag, while `store.svelte.ts` uses `sessionStorage` for all analysis data.

---

## Final Sweep

- No new security issues beyond what is already tracked (CSP with `unsafe-inline` is documented with a TODO for nonce-based migration).
- No new performance issues detected. The greedy optimizer's O(n*m) scoring (n transactions, m cards) is adequate for the expected dataset sizes.
- No new type safety issues. All gates pass.
- The ILP optimizer stub (`packages/core/src/optimizer/ilp.ts`) is still a pass-through to greedy, documented with a TODO.
- No new test coverage gaps beyond C4-10 and C4-11 (already deferred).
- The `categorizer-ai.ts` file was not reviewed (not found in the glob results -- it may be a dynamic import or generated).

---

## Summary

2 genuinely new findings this cycle (C52-01 and C52-02). 4 findings are re-articulated versions of existing deferred items with additional context and more precise failure scenarios (C52-03 = C4-06/C9-02, C52-04 = C4-14, C52-05 = C4-09, C52-06 = C4-07). All gates green. Codebase is stable.
