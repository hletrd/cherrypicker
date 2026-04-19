# Plan 41 — Medium Priority Fixes (Cycle 30)

**Source findings:** C30-02 (LOW severity, Medium confidence)

---

## Task 1: Add month/day range validation to Korean full-date parser across all three parser files

**Finding:** C30-02
**Severity:** LOW
**Confidence:** Medium
**Files:** `apps/web/src/lib/parser/csv.ts:71-72`, `apps/web/src/lib/parser/pdf.ts:159-160`, `apps/web/src/lib/parser/xlsx.ts:224-225`

### Problem

The Korean full-date format (`2026년 1월 15일`) is parsed across all three parser files but lacks month/day range validation. While the 4-digit year prefix makes this format more specific (lower risk than short-date formats), corrupted text like "2026년 99월 99일" would produce "2026-99-99" — an invalid ISO date string.

The short-date formats were fixed in C29-03/C29-04 with range validation, but the full-date format was not included in that fix.

### Implementation

1. Open `apps/web/src/lib/parser/csv.ts`
2. Locate the Korean full-date handler (around line 71-72):
   ```typescript
   const koreanFull = cleaned.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
   if (koreanFull) return `${koreanFull[1]}-${koreanFull[2]!.padStart(2, '0')}-${koreanFull[3]!.padStart(2, '0')}`;
   ```
3. Add range validation:
   ```typescript
   const koreanFull = cleaned.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
   if (koreanFull) {
     const month = parseInt(koreanFull[2]!, 10);
     const day = parseInt(koreanFull[3]!, 10);
     if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
       return `${koreanFull[1]}-${koreanFull[2]!.padStart(2, '0')}-${koreanFull[3]!.padStart(2, '0')}`;
     }
   }
   ```
4. Apply the same change to `apps/web/src/lib/parser/pdf.ts:159-160` and `apps/web/src/lib/parser/xlsx.ts:224-225`
5. If validation fails, fall through to `return cleaned` / `return raw` (existing behavior for unparseable dates)

### Exit Criterion

- All three parser files validate month/day ranges for Korean full-date format
- Invalid dates like "2026년 99월 99일" are not converted to date strings
- Consistent with the short-date validation added in C29-03/C29-04

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | DONE — commit 0000000e0a |
