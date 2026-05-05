# Plan: C32-02 + C32-03 — Full-date and short-year range validation

**Status:** DONE
**Findings:** C32-02 (LOW, Medium confidence), C32-03 (LOW, Medium confidence)
**Files:**
- `apps/web/src/lib/parser/csv.ts:43-44` (full-date) and `csv.ts:57-62` (short-year)
- `apps/web/src/lib/parser/xlsx.ts:209-210` (full-date) and `xlsx.ts:222-228` (short-year)
- `apps/web/src/lib/parser/pdf.ts:148` (full-date) and `pdf.ts:151-156` (short-year)

## Problem

The full-date format (YYYY-MM-DD etc.) and short-year format (YY-MM-DD) both lack month/day range validation. Corrupted data like "2026/13/99" or "99/13/99" would produce invalid ISO date strings ("2026-13-99", "2099-13-99"). The same validation was added for YYYYMMDD, MM/DD, Korean full, and Korean short formats but was never applied to the full-date and short-year formats.

## Implementation

### Step 1: Add full-date range validation in csv.ts

In `csv.ts:43-44`, wrap the fullMatch return in a range check:
```typescript
if (fullMatch) {
  const month = parseInt(fullMatch[2]!, 10);
  const day = parseInt(fullMatch[3]!, 10);
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
  }
}
```

### Step 2: Add short-year range validation in csv.ts

In `csv.ts:57-62`, wrap the shortYearMatch return in a range check:
```typescript
if (shortYearMatch) {
  const year = parseInt(shortYearMatch[1]!, 10);
  const fullYear = year >= 50 ? 1900 + year : 2000 + year;
  const month = parseInt(shortYearMatch[2]!, 10);
  const day = parseInt(shortYearMatch[3]!, 10);
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    return `${fullYear}-${shortYearMatch[2]!.padStart(2, '0')}-${shortYearMatch[3]!.padStart(2, '0')}`;
  }
}
```

### Step 3: Repeat for xlsx.ts

Apply the same validation to `xlsx.ts:209-210` (full-date) and `xlsx.ts:222-228` (short-year).

### Step 4: Repeat for pdf.ts

Apply the same validation to `pdf.ts:148` (full-date) and `pdf.ts:151-156` (short-year).

## Verification

- Existing tests should still pass
- Add test cases for invalid full-date and short-year strings (covered in C31-01 test plan)
