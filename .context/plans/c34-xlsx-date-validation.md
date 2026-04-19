# Plan: C34-02 — Server-side XLSX parseDateToISO missing month/day range validation

**Status:** DONE
**Finding:** C34-02 (MEDIUM, High confidence)
**File:** `packages/parser/src/xlsx/index.ts:28-78`

## Problem

The `parseDateToISO` function in `packages/parser/src/xlsx/index.ts` handles all date formats (full-date, YYYYMMDD, short-year, Korean full, Korean short) but does not validate month/day ranges for any of them. This is inconsistent with the web XLSX parser and the CSV parsers which all have range validation.

## Implementation

### Step 1: Add range validation to full-date handler (line 44-45)

Current:
```ts
const fullMatch = cleaned.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
if (fullMatch) return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
```

Fixed:
```ts
const fullMatch = cleaned.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
if (fullMatch) {
  const month = parseInt(fullMatch[2]!, 10);
  const day = parseInt(fullMatch[3]!, 10);
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
  }
}
```

### Step 2: Add range validation to YYYYMMDD handler (line 48)

Current:
```ts
if (/^\d{8}$/.test(cleaned)) return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
```

Fixed:
```ts
if (/^\d{8}$/.test(cleaned)) {
  const month = parseInt(cleaned.slice(4, 6), 10);
  const day = parseInt(cleaned.slice(6, 8), 10);
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  }
}
```

### Step 3: Add range validation to short-year handler (lines 51-55)

Current:
```ts
const shortYearMatch = cleaned.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})$/);
if (shortYearMatch) {
  const year = parseInt(shortYearMatch[1]!, 10);
  const fullYear = year >= 50 ? 1900 + year : 2000 + year;
  return `${fullYear}-${shortYearMatch[2]}-${shortYearMatch[3]}`;
}
```

Fixed:
```ts
const shortYearMatch = cleaned.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})$/);
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

Note: Also fix `.padStart(2, '0')` for short-year month/day — currently the code does not zero-pad them.

### Step 4: Add range validation to Korean full-date handler (lines 59-60)

Current:
```ts
const koreanFull = cleaned.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
if (koreanFull) return `${koreanFull[1]}-${koreanFull[2]!.padStart(2, '0')}-${koreanFull[3]!.padStart(2, '0')}`;
```

Fixed:
```ts
const koreanFull = cleaned.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
if (koreanFull) {
  const month = parseInt(koreanFull[2]!, 10);
  const day = parseInt(koreanFull[3]!, 10);
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    return `${koreanFull[1]}-${koreanFull[2]!.padStart(2, '0')}-${koreanFull[3]!.padStart(2, '0')}`;
  }
}
```

### Step 5: Add range validation to Korean short-date handler (lines 63-73)

Add month/day validation before computing the year.

### Step 6: Verify bun test passes

Run `bun test` from the repo root. All 266 tests should pass.

## Verification

- `bun test` from repo root should pass with 0 errors and 0 failures
- Invalid dates like "2026/13/99" should return the raw string (not "2026-13-99")
- Valid dates should produce correct ISO strings unchanged
