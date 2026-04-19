# Plan 39 — Medium Priority Fixes (Cycle 29)

**Source findings:** C29-02, C29-03, C29-04 (all LOW severity)

---

## Task 1: Fix results.astro "총 지출" label to match dashboard latest-month qualifier

**Finding:** C29-02
**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/pages/results.astro:51`

### Problem

The results page shows `optimization.totalSpending` as "총 지출" without any latest-month qualifier. The dashboard's SpendingSummary was fixed in C28-01 to show "최근 월 지출" with a "전체" sub-label for multi-month data, but the results page was not updated to match. This creates an inconsistency between the two pages.

### Implementation

1. Open `apps/web/src/pages/results.astro`
2. Change the "총 지출" label to "최근 월 지출" at line 50
3. The results.js script reads `data.optimization.totalSpending` which is already the latest-month-only value, so the data is correct — only the label needs updating
4. Optionally, add a secondary stat for full-period spending from `data.monthlyBreakdown` if available

### Exit Criterion

- The results page stat label says "최근 월 지출" instead of "총 지출"
- Consistent with the dashboard SpendingSummary labeling

---

## Task 2: Add month/day range validation to CSV parser MM/DD short-date handler

**Finding:** C29-03
**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/lib/parser/csv.ts:58-64`

### Problem

The CSV `parseDateToISO` handles MM/DD short dates with `inferYear` but does not validate that month is 1-12 and day is 1-31. The xlsx.ts version (fixed in C28-03) has this validation, but csv.ts does not. Values like "13/45" produce invalid date strings.

### Implementation

1. Open `apps/web/src/lib/parser/csv.ts`
2. Locate the MM/DD short-date handler (around line 58-64):
   ```typescript
   const shortMatch = cleaned.match(/^(\d{1,2})[.\-\/](\d{1,2})$/);
   if (shortMatch) {
     const month = parseInt(shortMatch[1]!, 10);
     const day = parseInt(shortMatch[2]!, 10);
     const year = inferYear(month, day);
     return `${year}-${shortMatch[1]!.padStart(2, '0')}-${shortMatch[2]!.padStart(2, '0')}`;
   }
   ```
3. Add range validation before calling `inferYear`:
   ```typescript
   if (shortMatch) {
     const month = parseInt(shortMatch[1]!, 10);
     const day = parseInt(shortMatch[2]!, 10);
     if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
       const year = inferYear(month, day);
       return `${year}-${shortMatch[1]!.padStart(2, '0')}-${shortMatch[2]!.padStart(2, '0')}`;
     }
   }
   ```
4. If validation fails, fall through to `return cleaned` at the end of the function (existing behavior for unparseable dates)

### Exit Criterion

- Invalid month/day values like "13/45" are not converted to date strings
- The xlsx.ts and csv.ts short-date handlers are now consistent

---

## Task 3: Add month/day range validation to PDF parser Korean short-date handler

**Finding:** C29-04
**Severity:** LOW
**Confidence:** Medium
**File:** `apps/web/src/lib/parser/pdf.ts:163-169`

### Problem

The PDF parser's Korean short-date handler (`1월 15일` format) does not validate month/day ranges before calling `inferYear`. Same class as C29-03 but for PDF Korean date format.

### Implementation

1. Open `apps/web/src/lib/parser/pdf.ts`
2. Locate the Korean short-date handler (around line 163-169):
   ```typescript
   const koreanShort = raw.match(/(\d{1,2})월\s*(\d{1,2})일/);
   if (koreanShort) {
     const month = parseInt(koreanShort[1]!, 10);
     const day = parseInt(koreanShort[2]!, 10);
     const year = inferYear(month, day);
     return `${year}-${koreanShort[1]!.padStart(2, '0')}-${koreanShort[2]!.padStart(2, '0')}`;
   }
   ```
3. Add range validation:
   ```typescript
   if (koreanShort) {
     const month = parseInt(koreanShort[1]!, 10);
     const day = parseInt(koreanShort[2]!, 10);
     if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
       const year = inferYear(month, day);
       return `${year}-${koreanShort[1]!.padStart(2, '0')}-${koreanShort[2]!.padStart(2, '0')}`;
     }
   }
   ```
4. Also add the same validation to the xlsx.ts Korean short-date handler for consistency (xlsx.ts:228-234) — it currently lacks range validation for Korean dates even though it was added for MM/DD in C28-03

### Exit Criterion

- All three parser files (csv.ts, xlsx.ts, pdf.ts) validate month/day ranges for short-date formats
- Invalid dates like "99월 99일" are not converted to date strings

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | DONE — commit 00000006f5 |
| 2 | DONE — commit 0000000651 |
| 3 | DONE — commit 0000000651 |
