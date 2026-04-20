# Plan 43 — Medium Priority Fixes (Cycle 31)

**Source findings:** C31-02 (LOW, High confidence), C31-03 (LOW, Medium confidence)

---

## Task 1: Fix report page label to show "추가 비용" when savings are negative

**Finding:** C31-02
**Severity:** LOW
**Confidence:** High
**File:** `apps/web/public/scripts/report.js:63`

### Problem

The report page's summary table row at line 63 shows `formatWon(opt.savingsVsSingleCard)` with the fixed label "추가 절약". When `savingsVsSingleCard` is negative, this displays a negative number under "추가 절약" — confusing UX. Both `SavingsComparison.svelte` and `results.js` handle this case by showing "추가 비용" instead.

### Implementation

1. Open `apps/web/public/scripts/report.js`
2. Change the "추가 절약" row (around line 63) to be conditional:
   ```javascript
   summaryTable.appendChild(summaryRow(
     opt.savingsVsSingleCard >= 0 ? '추가 절약' : '추가 비용',
     formatWon(opt.savingsVsSingleCard)
   ));
   ```

### Exit Criterion

- Report page shows "추가 비용" when savingsVsSingleCard is negative
- Consistent with SavingsComparison.svelte and results.js behavior

---

## Task 2: Add month/day range validation to YYYYMMDD format in csv.ts and xlsx.ts

**Finding:** C31-03
**Severity:** LOW
**Confidence:** Medium
**Files:** `apps/web/src/lib/parser/csv.ts:47`, `apps/web/src/lib/parser/xlsx.ts:213`

### Problem

The YYYYMMDD format (`/^\d{8}$/`) directly slices the 8-digit string into a date without validating month/day ranges. While this format is specific (exactly 8 digits), corrupted data like "20261399" would produce "2026-13-99" — an invalid ISO date string. This is the same class of issue as C29-03/C29-04/C30-02 but for the YYYYMMDD format.

### Implementation

1. Open `apps/web/src/lib/parser/csv.ts`
2. Locate the YYYYMMDD handler (around line 47):
   ```typescript
   if (/^\d{8}$/.test(cleaned)) return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
   ```
3. Add range validation:
   ```typescript
   if (/^\d{8}$/.test(cleaned)) {
     const month = parseInt(cleaned.slice(4, 6), 10);
     const day = parseInt(cleaned.slice(6, 8), 10);
     if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
       return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
     }
   }
   ```
4. Apply the same change to `apps/web/src/lib/parser/xlsx.ts:213`
5. If validation fails, fall through to `return cleaned` / `return String(raw ?? '')` (existing behavior)

### Exit Criterion

- Both csv.ts and xlsx.ts validate month/day ranges for YYYYMMDD format
- Invalid dates like "20261399" are not converted to date strings
- Consistent with the range validation added in C29-03/C29-04/C30-02

---

## Deferred Items

No deferrals from this cycle's findings. All three findings are scheduled for implementation.

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | DONE — commit 00000005c7 |
| 2 | DONE — commit 00000005d |
