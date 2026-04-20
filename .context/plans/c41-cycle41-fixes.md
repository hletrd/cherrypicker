# Cycle 41 Fixes Plan

## Findings Addressed

| ID | Severity | Description | Status |
|---|---|---|---|
| C41-01 | MEDIUM | SavingsComparison monthly/annual animation inconsistency | DONE |
| C41-02 | LOW | SpendingSummary formatPeriod duplicates date parsing logic | DONE |
| C41-03 | LOW | FileDropzone handleUpload uses inline IIFE for previousMonthSpending | DONE |
| C41-04 | LOW | CategoryBreakdown maxPercentage initial value 1 | PENDING |
| C41-05 | LOW | cards.ts loadCategories returns empty array on AbortError | PENDING |

### Deferred (no action this cycle)

| ID | Severity | Reason |
|---|---|---|
| C41-04 | LOW | Theoretical edge case only — maxPercentage of 1 only affects sub-1% categories which are already grouped into "other" by the 2% threshold. No realistic user impact. Re-exit criterion: if very small datasets become a use case. |
| C41-05 | LOW | The fallback behavior is acceptable — TransactionReview already falls back to hardcoded categories. The AbortError scenario is uncommon (only during Astro View Transitions component unmount). Adding retry logic would add complexity for minimal benefit. Re-exit criterion: if users report empty category dropdowns after navigation. |

---

## Task 1: Fix SavingsComparison monthly/annual animation inconsistency

**Finding:** C41-01 (MEDIUM)
**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:216-218`

**Problem:** The monthly savings display uses `displayedSavings` (animated count-up from 0 to target over 600ms), while the annual projection uses `opt.savingsVsSingleCard * 12` (the actual final value, shown immediately). This creates a visual inconsistency: during the 600ms animation, the monthly shows e.g. "+0원" while annual shows "연간 약 600,000원 절약". The values are mathematically out of sync.

**Fix:** Create a parallel animated state `displayedAnnualSavings` that animates in sync with `displayedSavings`. Use it for the annual projection display. The annual animation should:
- Start from `0` on first mount (matching the monthly animation)
- Transition smoothly from the current displayed value to the new target on reoptimize
- Respect `prefers-reduced-motion` like the monthly animation
- Derive its target from `opt.savingsVsSingleCard * 12` (the actual annual value)

Implementation:
1. Add `let displayedAnnualSavings = $state(0);` next to `displayedSavings`
2. Add a second `$effect` that mirrors the animation logic but targets annual savings
3. Update the template to use `displayedAnnualSavings` instead of `opt.savingsVsSingleCard * 12`

**Verification:** After the fix, both monthly and annual values should animate in sync on mount and on reoptimize. The annual projection should start at "0원" and animate to the correct value over 600ms, matching the monthly display's animation cadence.

---

## Task 2: Extract shared `formatYearMonthKo` helper from SpendingSummary

**Finding:** C41-02 (LOW)
**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:30-43`

**Problem:** `formatPeriod` in SpendingSummary manually splits ISO date strings and parses year/month with parseInt and NaN guards, duplicating logic that already exists in `formatters.ts`. While the semantics differ (formatPeriod returns a range, formatDateKo returns a full date), the individual date part formatting is the same.

**Fix:** Add a `formatYearMonthKo(dateStr: string): string` function to `formatters.ts` that takes an ISO date string and returns "YYYY년 M월" format. Use it in SpendingSummary's `formatPeriod` to avoid duplicating the split/parseInt/NaN guard logic.

Implementation:
1. Add `formatYearMonthKo` to `apps/web/src/lib/formatters.ts`:
   ```typescript
   export function formatYearMonthKo(dateStr: string): string {
     const parts = dateStr.split('-');
     if (parts.length < 2) return '-';
     const [y, m] = parts;
     const mNum = parseInt(m!, 10);
     if (Number.isNaN(mNum)) return '-';
     return `${y}년 ${mNum}월`;
   }
   ```
2. Update `SpendingSummary.svelte` `formatPeriod` to use `formatYearMonthKo` for the start and end date formatting.

**Verification:** The SpendingSummary period display should render identically after the refactor. No visual change.

---

## Task 3: Extract previousMonthSpending parsing from FileDropzone inline IIFE

**Finding:** C41-03 (LOW)
**File:** `apps/web/src/components/upload/FileDropzone.svelte:217`

**Problem:** The `previousMonthSpending` option is computed via an inline IIFE `(() => { ... })()`. While functionally correct, this pattern is hard to read and maintain.

**Fix:** Extract the parsing logic to a named function `parsePreviousSpending` defined in the script section of the FileDropzone component.

Implementation:
1. Add a function before `handleUpload`:
   ```typescript
   function parsePreviousSpending(raw: string): number | undefined {
     const v = raw.trim();
     if (v === '') return undefined;
     const n = Math.round(Number(v));
     return Number.isFinite(n) && n >= 0 ? n : undefined;
   }
   ```
2. Replace the inline IIFE in `handleUpload` with `parsePreviousSpending(previousSpending)`.

**Verification:** The previousMonthSpending behavior should be identical. No functional change.
