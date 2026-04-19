# Plan 06 — High-Priority Fixes (Cycle 3)

**Priority:** HIGH
**Findings addressed:** C3-T01, C3-T02, C3-04/C3-U01, C3-D03, C3-S02
**Status:** Complete

---

## Task 1: Add unit tests for `calculateRewards` (C3-T01)

**Finding:** `packages/core/src/calculator/reward.ts` — The most critical function in the codebase has zero unit tests. It handles performance tiers, monthly caps, per-transaction caps, global caps, fixed rewards, and various unit types.

**File:** `packages/core/__tests__/calculator.test.ts` (new file)

**Implementation:**
1. Create `packages/core/__tests__/calculator.test.ts`
2. Test cases:
   - Basic percentage reward (1% of 10,000 = 100 Won)
   - Monthly cap enforcement (cap at 5,000 Won, spending produces 8,000 → 5,000)
   - Global cap enforcement with rule cap sync (rule cap allows 5,000 but global cap only 3,000 remaining)
   - Performance tier selection (qualifying vs non-qualifying spending)
   - Fixed reward with `won_per_day` unit (only once per day)
   - Per-transaction cap (cap at 50,000 Won, transaction is 100,000 → reward on 50,000)
   - Subcategory blocking (broad category rule should not match subcategorized transaction)
   - Negative amount and non-KRW filtering (should skip)
   - `normalizeRate` converts percentage form (1.5 → 0.015)
   - Rule with null rate and null fixedAmount → 0 reward
   - Multiple transactions accumulating toward monthly cap

**Commit:** `test(core): ✅ add comprehensive unit tests for calculateRewards`

---

## Task 2: Add unit tests for `greedyOptimize` (C3-T02)

**Finding:** `packages/core/src/optimizer/greedy.ts` — The greedy optimizer has no unit tests. Edge cases like all cards giving 0 reward, single card, transactions with 0 amount, and category with no matching rule are untested.

**File:** `packages/core/__tests__/optimizer.test.ts` (new file)

**Implementation:**
1. Create `packages/core/__tests__/optimizer.test.ts`
2. Test cases:
   - Basic flow: 2 cards, 5 transactions, verify assignments
   - Single card: all transactions assigned to one card
   - Transactions with 0 or negative amounts are skipped
   - Category with no matching rule gets 0 reward
   - `savingsVsSingleCard` computed correctly
   - `bestSingleCard` is the card with highest total reward when all transactions are assigned to it
   - Alternative cards tracked in `alternatives` array
   - `buildAssignments` correctly aggregates spending/reward by category+card

**Commit:** `test(core): ✅ add unit tests for greedyOptimize`

---

## Task 3: Fix `formatPeriod` timezone bug in `SpendingSummary.svelte` (C3-04/C3-U01)

**Finding:** `apps/web/src/components/dashboard/SpendingSummary.svelte:15-21` — `formatPeriod` uses `new Date()` which parses ISO date strings as UTC midnight but `getMonth()` returns local-time values. This is the same class of bug as the fixed C2-04, but in a different file.

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte`

**Implementation:**
1. Replace the `formatPeriod` function with manual date parsing:
```ts
function formatPeriod(period: { start: string; end: string } | undefined): string {
  if (!period) return '-';
  const [sy, sm] = period.start.split('-');
  const [ey, em] = period.end.split('-');
  if (!sy || !sm || !ey || !em) return '-';
  const startStr = `${sy}년 ${parseInt(sm, 10)}월`;
  const endStr = `${ey}년 ${parseInt(em, 10)}월`;
  return startStr === endStr ? startStr : `${startStr} ~ ${endStr}`;
}
```

**Commit:** `fix(web): 🕐 use manual date parsing in formatPeriod to avoid UTC/local mismatch`

---

## Task 4: Fix single-file previousMonthSpending bypassing exclusion filtering (C3-D03)

**Finding:** `apps/web/src/lib/analyzer.ts:214-218` — When only one month is uploaded and the user does not provide `previousMonthSpending`, the code sets it as an explicit option equal to the month's total spending. This bypasses the per-card exclusion filtering that was implemented in `optimizeFromTransactions`.

**File:** `apps/web/src/lib/analyzer.ts`

**Implementation:**
1. When computing the fallback `previousMonthSpending` for single-file uploads, do NOT set it as an explicit option. Pass `undefined` instead, and let `optimizeFromTransactions` compute per-card spending with exclusions.
2. Change line 218 from:
```ts
const previousMonthSpending = previousMonth
  ? monthlySpending.get(previousMonth)!
  : options?.previousMonthSpending ?? monthlySpending.get(latestMonth)!;
```
to:
```ts
const previousMonthSpending = previousMonth
  ? monthlySpending.get(previousMonth)!
  : options?.previousMonthSpending;
// When undefined, optimizeFromTransactions will compute per-card
// exclusion-filtered spending automatically
```
3. Then pass `previousMonthSpending` (which may be undefined) to `optimizeFromTransactions`:
```ts
const optimization = await optimizeFromTransactions(latestTransactions, {
  ...options,
  previousMonthSpending,
});
```

**Commit:** `fix(web): 🧮 let optimizer compute per-card previousMonthSpending for single-file uploads`

---

## Task 5: Add file size limit on uploads (C3-S02)

**Finding:** `apps/web/src/components/upload/FileDropzone.svelte:110-132` — No file size check. A multi-gigabyte file would be read entirely into memory, potentially crashing the browser tab.

**File:** `apps/web/src/components/upload/FileDropzone.svelte`

**Implementation:**
1. Add a max file size constant:
```ts
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 MB total
```
2. In `addFiles`, check file sizes:
```ts
const oversized: string[] = [];
for (const f of newFiles) {
  if (f.size > MAX_FILE_SIZE) {
    oversized.push(`${f.name} (${formatFileSize(f.size)})`);
    continue;
  }
  // ... existing validation
}
const totalSize = [...uploadedFiles, ...valid].reduce((sum, f) => sum + f.size, 0);
if (totalSize > MAX_TOTAL_SIZE) {
  errorMessage = `전체 파일 크기가 50MB를 초과합니다`;
  uploadStatus = 'error';
  return;
}
if (oversized.length > 0) {
  errorMessage = `파일 크기는 10MB 이하여야 합니다 (초과: ${oversized.join(', ')})`;
  uploadStatus = 'error';
}
```

**Commit:** `fix(web): 🛡️ add file size limits on statement uploads`

---

## Progress

- [x] Task 1: Add unit tests for calculateRewards
- [x] Task 2: Add unit tests for greedyOptimize
- [x] Task 3: Fix formatPeriod timezone bug
- [x] Task 4: Fix single-file previousMonthSpending exclusion bypass
- [x] Task 5: Add file size limits on uploads
