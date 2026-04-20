# Plan: Cycle 34 Fixes — Server-side PDF/XLSX Parity Bugs + DRY Cleanup

**Status:** IN PROGRESS
**Source findings:** C34-01 (MEDIUM, High), C34-02 (LOW, High), C34-03 (LOW, High), C34-05 (LOW, High)

---

## Task 1: Fix server-side PDF parseAmount parity bugs (C34-01)

**Priority:** HIGH
**Severity:** MEDIUM
**Confidence:** High
**File:** `packages/parser/src/pdf/index.ts:102-108`

### Problem

The C33-03 fix updated the web-side PDF `parseAmount` to return `null` for unparseable amounts and use `Math.round(parseFloat(...))`. The server-side PDF `parseAmount` was NOT updated and has three parity bugs:

1. Returns `0` for NaN instead of `null` -- cannot distinguish parse failure from zero
2. Uses `parseInt()` which truncates decimal remainders instead of `Math.round(parseFloat(...))`
3. Does not handle parenthesized negative amounts like `(1,234)`

### Implementation

Replace `parseAmount` in `packages/parser/src/pdf/index.ts` (lines 102-108):

Current:
```typescript
function parseAmount(raw: string): number {
  const n = parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}
```

Fixed (matching web-side pattern):
```typescript
function parseAmount(raw: string): number | null {
  let cleaned = raw.replace(/원$/, '').replace(/,/g, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  if (!cleaned.trim()) return null;
  const n = Math.round(parseFloat(cleaned));
  if (Number.isNaN(n)) return null;
  return isNeg ? -n : n;
}
```

Then update the caller at line 156-158:
```typescript
const amount = parseAmount(amountCell.value);
if (amount === null) continue;
if (amount <= 0) continue;
```

### Verification

- `bun test` from repo root should pass
- Server-side PDF `parseAmount("abc")` returns `null` (not 0)
- Server-side PDF `parseAmount("1,234")` returns `1234`
- Server-side PDF `parseAmount("(1,234)")` returns `-1234`

---

## Task 2: Fix server-side XLSX parseAmount string path truncation (C34-02)

**Priority:** MEDIUM
**Severity:** LOW
**Confidence:** High
**File:** `packages/parser/src/xlsx/index.ts:136`

### Problem

The string path uses `parseInt(cleaned, 10)` which truncates, while the numeric path uses `Math.round(raw)` which rounds. Inconsistent with the file's own comment "round to prevent decimal values."

### Implementation

In `packages/parser/src/xlsx/index.ts`, line 136, replace:
```typescript
const n = parseInt(cleaned, 10);
```

With:
```typescript
const n = Math.round(parseFloat(cleaned));
```

### Verification

- `bun test` from repo root should pass
- `parseAmount("1.7")` returns `2` (not `1`)

---

## Task 3: Add isValidShortDate to server-side PDF findDateCell (C34-03)

**Priority:** MEDIUM
**Severity:** LOW
**Confidence:** High
**File:** `packages/parser/src/pdf/index.ts:110-122`

### Problem

The web-side `findDateCell` validates short MM/DD date candidates using `isValidShortDate()` to prevent decimal amounts like "3.5" from being misidentified as dates (C8-11). The server-side uses raw `SHORT_MD_DATE_PATTERN` regex without validation.

### Implementation

1. Add `isValidShortDate` function to `packages/parser/src/pdf/index.ts` (matching web-side):

```typescript
function isValidShortDate(cell: string): boolean {
  const match = cell.match(SHORT_MD_DATE_PATTERN);
  if (!match) return false;
  const parts = cell.split(/[.\-\/]/);
  const month = parseInt(parts[0] ?? '', 10);
  const day = parseInt(parts[1] ?? '', 10);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}
```

2. Replace in `findDateCell`:
```typescript
// Replace:
SHORT_MD_DATE_PATTERN.test(cell)
// With:
isValidShortDate(cell)
```

### Verification

- `bun test` from repo root should pass
- `"3.5"` is NOT identified as a date by `findDateCell`
- `"3.15"` IS identified as a date by `findDateCell`

---

## Task 4: Centralize inferYear in server-side parsers (C34-05)

**Priority:** LOW
**Severity:** LOW
**Confidence:** High
**Files:**
- `packages/parser/src/csv/generic.ts:33-40`
- `packages/parser/src/xlsx/index.ts:31-38`
- `packages/parser/src/pdf/index.ts:23-30`

### Problem

`inferYear` is duplicated 3 times across server-side parsers. The web-side centralized it into `date-utils.ts` (C19-01).

### Implementation

1. Create `packages/parser/src/date-utils.ts` with the shared `inferYear` function:

```typescript
/** Infer the year for a short-date (month/day only) using a look-back
 *  heuristic: if the date would be more than 3 months in the future,
 *  assume it belongs to the previous year. */
export function inferYear(month: number, day: number): number {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day);
  if (candidate.getTime() - now.getTime() > 90 * 24 * 60 * 60 * 1000) {
    return now.getFullYear() - 1;
  }
  return now.getFullYear();
}
```

2. Update `packages/parser/src/csv/generic.ts` to import from `date-utils.ts`:
```typescript
import { inferYear } from '../date-utils.js';
```
Remove the local `inferYear` function.

3. Update `packages/parser/src/xlsx/index.ts` to import from `date-utils.ts`:
```typescript
import { inferYear } from '../date-utils.js';
```
Remove the local `inferYear` function.

4. Update `packages/parser/src/pdf/index.ts` to import from `date-utils.ts`:
```typescript
import { inferYear } from '../date-utils.js';
```
Remove the local `inferYear` function.

### Verification

- `bun test` from repo root should pass
- All three server-side parsers use the same `inferYear` implementation

---

## Deferred Items

| Finding | Reason for Deferral |
|---|---|
| C34-04 (server-side PDF missing fallback line scanner) | Architectural gap requiring a substantial port of web-side code (~80 lines). The server-side was designed for CLI usage where LLM fallback is the safety net. Adding the fallback scanner is a feature enhancement rather than a bug fix. The web-side fallback exists and works. Exit criterion: if server-side PDF parsing success rate is reported as too low by CLI users, port the fallback line scanner from the web-side implementation. |

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | PENDING |
| 2 | PENDING |
| 3 | PENDING |
| 4 | PENDING |
