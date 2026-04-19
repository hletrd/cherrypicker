# Plan 12 — High-Priority Fixes (Cycle 7)

**Priority:** HIGH
**Findings addressed:** C7-08, C7-02, C7-01, C7-03
**Status:** PENDING

---

## Task 1: Add short-date handling to browser PDF parser (C7-08)

**Finding:** `apps/web/src/lib/parser/pdf.ts:126-143` — The `parseDateToISO` function in `pdf.ts` handles `YYYY-MM-DD`, `YY-MM-DD`, and `YYYY년 M월 D일` formats, but does NOT handle `M월 D일` (Korean short date) or `MM/DD` formats. The CSV and XLSX parsers both handle these via the `inferYear` heuristic. PDF statements from Korean card companies commonly use these short-date formats.

**File:** `apps/web/src/lib/parser/pdf.ts`

**Implementation:**
1. Add `inferYear` function (matching the pattern in `csv.ts:29-37`):
```ts
function inferYear(month: number, day: number): number {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day);
  if (candidate.getTime() - now.getTime() > 90 * 24 * 60 * 60 * 1000) {
    return now.getFullYear() - 1;
  }
  return now.getFullYear();
}
```

2. Add Korean short-date handling to `parseDateToISO` after the existing `koreanFull` match:
```ts
// 1월 15일
const koreanShort = raw.match(/(\d{1,2})월\s*(\d{1,2})일/);
if (koreanShort) {
  const month = parseInt(koreanShort[1]!, 10);
  const day = parseInt(koreanShort[2]!, 10);
  const year = inferYear(month, day);
  return `${year}-${koreanShort[1]!.padStart(2, '0')}-${koreanShort[2]!.padStart(2, '0')}`;
}
```

3. Add MM/DD handling (after koreanShort):
```ts
// MM/DD or MM.DD — infer year with look-back heuristic
const shortMatch = raw.match(/^(\d{1,2})[.\-\/](\d{1,2})$/);
if (shortMatch) {
  const month = parseInt(shortMatch[1]!, 10);
  const day = parseInt(shortMatch[2]!, 10);
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    const year = inferYear(month, day);
    return `${year}-${shortMatch[1]!.padStart(2, '0')}-${shortMatch[2]!.padStart(2, '0')}`;
  }
}
```

**Commit:** `fix(web): 🐩 add Korean short-date and MM/DD parsing to PDF date parser`

---

## Task 2: Replace inline rate formatting in SpendingSummary with `formatRatePrecise` (C7-02)

**Finding:** `apps/web/src/components/dashboard/SpendingSummary.svelte:94` — Uses `{(analysisStore.optimization.effectiveRate * 100).toFixed(2) + '%'}` inline instead of the `formatRatePrecise` helper added in C6-11.

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte`

**Implementation:**
1. Add `formatRatePrecise` to the import on line 4:
```ts
import { formatWon, formatRatePrecise, getIssuerColor, getIssuerFromCardId } from '../../lib/formatters.js';
```
Wait — line 4 currently imports `formatWon` only. Let me check... Line 4 is:
```ts
import { formatWon } from '../../lib/formatters.js';
```
So add `formatRatePrecise`:
```ts
import { formatWon, formatRatePrecise } from '../../lib/formatters.js';
```

2. Replace line 94:
```svelte
<!-- Change from: -->
{analysisStore.optimization ? (analysisStore.optimization.effectiveRate * 100).toFixed(2) + '%' : '-'}
<!-- To: -->
{analysisStore.optimization ? formatRatePrecise(analysisStore.optimization.effectiveRate) : '-'}
```

**Commit:** `refactor(web): ♻️ use formatRatePrecise in SpendingSummary effective rate display`

---

## Task 3: Replace inline rate formatting in SavingsComparison breakdown table with `formatRate` (C7-01)

**Finding:** `apps/web/src/components/dashboard/SavingsComparison.svelte:223` — Breakdown table displays `{(card.rate * 100).toFixed(1)}%` inline instead of using `formatRate()`.

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte`

**Implementation:**
1. `formatRate` is already imported on line 3:
```ts
import { formatWon, formatRatePrecise, getIssuerColor, getIssuerFromCardId } from '../../lib/formatters.js';
```
Add `formatRate` to the import:
```ts
import { formatWon, formatRate, formatRatePrecise, getIssuerColor, getIssuerFromCardId } from '../../lib/formatters.js';
```

2. Replace line 223:
```svelte
<!-- Change from: -->
{(card.rate * 100).toFixed(1)}%
<!-- To: -->
{formatRate(card.rate)}
```

**Commit:** `refactor(web): ♻️ use formatRate in SavingsComparison breakdown table rate display`

---

## Task 4: Replace inline rate formatting in SavingsComparison best single card with `formatRatePrecise` (C7-03)

**Finding:** `apps/web/src/components/dashboard/SavingsComparison.svelte:149` — Uses `{((opt.bestSingleCard.totalReward / opt.totalSpending) * 100).toFixed(2)}%` inline instead of `formatRatePrecise()`.

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte`

**Implementation:**
1. `formatRatePrecise` is already imported (from the C6-11 fix).

2. Replace line 149:
```svelte
<!-- Change from: -->
월 혜택{#if opt.totalSpending > 0}, 혜택률 {((opt.bestSingleCard.totalReward / opt.totalSpending) * 100).toFixed(2)}%{/if}
<!-- To: -->
월 혜택{#if opt.totalSpending > 0}, 혜택률 {formatRatePrecise(opt.bestSingleCard.totalReward / opt.totalSpending)}{/if}
```

**Commit:** `refactor(web): ♻️ use formatRatePrecise in SavingsComparison best single card rate display`

---

## Progress

- [ ] Task 1: Add short-date handling to PDF parser
- [ ] Task 2: Use formatRatePrecise in SpendingSummary
- [ ] Task 3: Use formatRate in SavingsComparison breakdown
- [ ] Task 4: Use formatRatePrecise in SavingsComparison best single card
