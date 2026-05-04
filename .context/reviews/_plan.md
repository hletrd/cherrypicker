# Cycle 21 Implementation Plan

## Fixes (ordered by priority)

### 1. F21-01: CSV generic isDateLikeShort month-aware validation (MEDIUM)

**Files:** `packages/parser/src/csv/generic.ts:37-44`, `apps/web/src/lib/parser/csv.ts:141-148`

**Problem:** `isDateLikeShort()` uses `day <= 31` instead of month-aware validation. Impossible dates like "2/31", "4/31", "6/31", "9/31", "11/31" pass validation, inconsistent with PDF parsers which use `MAX_DAYS_PER_MONTH`.

**Fix:** Import `daysInMonth` from `date-utils.ts` and replace `day <= 31` with `day <= daysInMonth(new Date().getFullYear(), month)`. The `daysInMonth` function uses the Date constructor which correctly handles leap years. Since this is for column detection heuristics (not date parsing), using the current year is acceptable -- the important thing is rejecting impossible month/day combinations.

For the server side:
```typescript
import { daysInMonth } from '../date-utils.js';

function isDateLikeShort(value: string): boolean {
  const match = value.match(/^\d{1,2}[\s]*[.\-\/][\s]*\d{1,2}$/);
  if (!match) return false;
  const parts = value.trim().split(/[.\-\/]/);
  const month = parseInt(parts[0] ?? '', 10);
  const day = parseInt(parts[1] ?? '', 10);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(new Date().getFullYear(), month);
}
```

For the web side (web has its own date-utils.ts):
```typescript
import { daysInMonth } from './date-utils.js';

function isDateLikeShort(value: string): boolean {
  const match = value.match(/^\d{1,2}[\s]*[.\-\/][\s]*\d{1,2}$/);
  if (!match) return false;
  const parts = value.trim().split(/[.\-\/]/);
  const month = parseInt(parts[0] ?? '', 10);
  const day = parseInt(parts[1] ?? '', 10);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(new Date().getFullYear(), month);
}
```

**Tests:** Add tests in `packages/parser/__tests__/csv.test.ts`:
- "2/31" should NOT be detected as a date column
- "4/31" should NOT be detected as a date column
- "2/28" should be detected as a valid date
- "1/31" should be detected as a valid date

### 2. F21-02: Web XLSX parseAmount whitespace stripping (LOW)

**File:** `apps/web/src/lib/parser/xlsx.ts:281`

**Fix:** Add `.replace(/\s/g, '')` after the comma removal:
```typescript
let cleaned = raw.trim().replace(/원$/, '').replace(/[₩𝐖]/g, '').replace(/,/g, '').replace(/\s/g, '');
```

**Tests:** Add test in existing XLSX parity test for whitespace amounts.

### 3. F21-03: Server CSV parseCSVAmount whitespace strip order (LOW)

**File:** `packages/parser/src/csv/shared.ts:37`

**Fix:** Move whitespace stripping before parenthesized negative check for consistency:
```typescript
let cleaned = raw.trim().replace(/원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '');
```
(Currently `.replace(/\s/g, '')` is last, move it to same position as other parsers.)

**Tests:** Existing tests should continue to pass.

## Deferred
- D-01 through D-09: Same as cycle 20 (architecture, build system, UI concerns)