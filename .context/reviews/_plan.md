# Cycle 20 Implementation Plan

## Fixes (ordered by priority)

### 1. F20-01: Server PDF fallback parenthesized amount bug (HIGH)

**File:** `packages/parser/src/pdf/index.ts` lines 284, 306

**Problem:** The fallback scanner regex `/\([\d,]+\)|([\d,]+)원?/g` produces `undefined` for capture group 1 when matching parenthesized amounts like `(1,234)`. At line 306, `amountMatch[1]!` is `undefined`, causing `.replace()` to throw a TypeError.

**Fix:** Change the regex to capture the digits inside parentheses:
```typescript
const fallbackAmountPattern = /\(([\d,]+)\)|([\d,]+)원?/g;
```
Then at the usage site:
```typescript
const amountRaw = (amountMatch[1] ?? amountMatch[2])!;
```
Group 1 captures digits inside `()` for parenthesized amounts. Group 2 captures normal amounts. `parseAmount()` already handles the parenthesized format.

**Tests:** Add test in `packages/parser/__tests__/table-parser.test.ts` for parenthesized amounts in PDF fallback.

### 2. F20-02: CSV isDateLike decimal false-positive (MEDIUM)

**Files:** `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`

**Problem:** The short date pattern `/^\d{1,2}[\s]*[.\-\/][\s]*\d{1,2}$/` matches decimal numbers like `3.5` or `12.34`. When header detection fails, this can cause `isDateLike()` to misidentify an amount column as a date column, preventing `amountCol` from being set.

**Fix:** Add month/day range validation to `isDateLike` for the short-date pattern. After the short-date pattern matches, validate that month is 1-12 and day is 1-31. This matches the PDF parser's `isValidShortDate` approach.

```typescript
function isDateLike(value: string): boolean {
  const trimmed = value.trim();
  if (DATE_PATTERNS.slice(0, 3).some((p) => p.test(trimmed))) {
    // Short date pattern (index 2) needs month/day validation
    if (DATE_PATTERNS[2]!.test(trimmed)) {
      const parts = trimmed.split(/[.\-\/]/);
      const month = parseInt(parts[0] ?? '', 10);
      const day = parseInt(parts[1] ?? '', 10);
      return month >= 1 && month <= 12 && day >= 1 && day <= 31;
    }
    return true;
  }
  return DATE_PATTERNS.slice(3).some((p) => p.test(trimmed));
}
```

Actually, simpler: just add validation inline for the MM/DD pattern only:

```typescript
const DATE_PATTERNS = [
  /^\d{4}[\s]*[.\-\/][\s]*\d{1,2}[\s]*[.\-\/][\s]*\d{1,2}$/,
  /^\d{2}[\s]*[.\-\/][\s]*\d{2}[\s]*[.\-\/][\s]*\d{2}$/,
  // Note: short dates validated by isDateLikeShort() to reject decimals
  /^\d{4}\d{2}\d{2}$/,
  /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/,
  /^\d{1,2}월\s*\d{1,2}일$/,
];

function isDateLikeShort(value: string): boolean {
  const match = value.match(/^\d{1,2}[\s]*[.\-\/][\s]*\d{1,2}$/);
  if (!match) return false;
  const parts = value.split(/[.\-\/]/);
  const month = parseInt(parts[0] ?? '', 10);
  const day = parseInt(parts[1] ?? '', 10);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function isDateLike(value: string): boolean {
  const trimmed = value.trim();
  return DATE_PATTERNS.some((p) => p.test(trimmed)) || isDateLikeShort(trimmed);
}
```

**Tests:** Add test in `packages/parser/__tests__/csv.test.ts` for decimal amounts not misidentified as dates.

## Deferred
- D-01 through D-08: Same as cycle 19