# Implementation Plan -- Cycle 44

## P1. Fix PDF isValidShortDate leap year handling (F2)
**Files:**
- `packages/parser/src/pdf/index.ts` (line 29, MAX_DAYS_PER_MONTH constant + isValidShortDate function)

**Change:** Replace hardcoded `MAX_DAYS_PER_MONTH` table with `daysInMonth()` import from date-utils.ts, using current year. This matches the CSV parser's `isDateLikeShort()` approach.

**Before:**
```ts
const MAX_DAYS_PER_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function isValidShortDate(cell: string): boolean {
  // ... uses MAX_DAYS_PER_MONTH[month] ?? 0
}
```

**After:**
```ts
import { daysInMonth } from '../date-utils.js';  // already partially imported
function isValidShortDate(cell: string): boolean {
  // ... uses daysInMonth(new Date().getFullYear(), month)
}
```

## P2. Add non-numeric header guard to XLSX parsers (F1, F3)
**Files:**
- `packages/parser/src/xlsx/index.ts` (line 239-247)
- `apps/web/src/lib/parser/xlsx.ts` (line 419-427)

**Change:** Add `hasNonNumeric` guard matching CSV generic parser pattern:
```ts
const hasNonNumeric = rowStrings.some((c) => /[가-힣a-zA-Z]/.test(c));
if (hasNonNumeric && isValidHeaderRow(rowStrings)) { ... }
```

## P3. Tests
- Add XLSX non-numeric header guard test to `packages/parser/__tests__/table-parser.test.ts` or xlsx test

## Deferred
- A1: Web CSV 10 hand-rolled adapters -> factory pattern (~700 lines)
- A2: Column-matcher module dedup