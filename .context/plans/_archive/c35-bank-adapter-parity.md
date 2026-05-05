# Plan: Cycle 35 Fixes -- Bank Adapter Parity Bugs

**Status:** DONE
**Source findings:** C35-01 (MEDIUM, High), C35-02 (LOW, High), C35-03 (LOW, High)

---

## Task 1: Fix all 10 bank-specific CSV adapters parseAmount to use Math.round(parseFloat) and return null (C35-01)

**Priority:** HIGH
**Severity:** MEDIUM
**Confidence:** High
**Files:**
- `packages/parser/src/csv/hyundai.ts:24-31`
- `packages/parser/src/csv/kb.ts:24-31`
- `packages/parser/src/csv/shinhan.ts:24-31`
- `packages/parser/src/csv/woori.ts:24-31`
- `packages/parser/src/csv/samsung.ts:24-31`
- `packages/parser/src/csv/hana.ts:24-31`
- `packages/parser/src/csv/nh.ts:24-31`
- `packages/parser/src/csv/lotte.ts:24-31`
- `packages/parser/src/csv/ibk.ts:24-31`
- `packages/parser/src/csv/bc.ts:24-31`

### Problem

All 10 bank-specific CSV adapters have the same `parseAmount` with two parity bugs:

1. Uses `parseInt(cleaned, 10)` which truncates decimal remainders instead of `Math.round(parseFloat(...))`
2. Returns `NaN` on parse failure instead of `null`

Every other parser (generic CSV, web-side XLSX/PDF, server-side XLSX/PDF) was fixed in cycles 32-34, but the bank adapters were missed.

### Implementation

For each of the 10 bank adapter files, replace the `parseAmount` function:

Current (same pattern in all 10):
```typescript
function parseAmount(raw: string): number {
  let cleaned = raw.trim().replace(/원$/, '').replace(/,/g, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  const n = parseInt(cleaned, 10);
  if (Number.isNaN(n)) return NaN;
  return isNeg ? -n : n;
}
```

Fixed (matching generic CSV pattern):
```typescript
function parseAmount(raw: string): number | null {
  let cleaned = raw.trim().replace(/원$/, '').replace(/,/g, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  if (!cleaned) return null;
  const n = Math.round(parseFloat(cleaned));
  if (Number.isNaN(n)) return null;
  return isNeg ? -n : n;
}
```

Then update each caller to use `null` check instead of `Number.isNaN`:

Current:
```typescript
const amount = parseAmount(amountRaw);
if (Number.isNaN(amount)) { ... continue; }
```

Fixed:
```typescript
const amount = parseAmount(amountRaw);
if (amount === null) {
  if (amountRaw.trim()) {
    errors.push({ line: i + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}`, raw: line });
  }
  continue;
}
```

Also add zero-amount filter (C35-02) after the null check:
```typescript
if (amount === 0) continue;
```

### Verification

- `bun test` from repo root should pass
- `parseAmount("abc")` returns `null` (not `NaN`)
- `parseAmount("1,234")` returns `1234`
- `parseAmount("1.7")` returns `2` (not `1`)
- `parseAmount("(1,234)")` returns `-1234`

---

## Task 2: Add zero-amount filter to all 10 bank-specific CSV adapters (C35-02)

**Priority:** MEDIUM
**Severity:** LOW
**Confidence:** High
**Files:** All 10 bank-specific CSV adapters

### Problem

The generic CSV parser filters zero-amount rows with `if (amount === 0) continue;`. None of the 10 bank-specific adapters filter zero-amount rows. Zero-amount transactions (balance inquiries, declined transactions) pass through and appear in the UI but don't affect optimization.

### Implementation

Add `if (amount === 0) continue;` after the null check in all 10 bank adapters. This is done as part of Task 1 (combined in the same edit).

### Verification

- Zero-amount rows in bank-specific CSV files are skipped
- Positive-amount rows are still parsed correctly

---

## Task 3: Replace duplicated parseDateToISO in bank adapters with shared import (C35-03)

**Priority:** LOW
**Severity:** LOW
**Confidence:** High
**Files:** All 10 bank-specific CSV adapters

### Problem

Each bank adapter has its own copy of `parseDateToISO` that only handles YYYY.MM.DD and YYYYMMDD formats. The generic CSV's `parseDateToISO` (via `date-utils.ts`) also handles Korean dates, short dates, and short-year dates with `inferYear`. The bank adapters don't import `inferYear` and can't handle these formats.

The code duplication is a maintenance risk -- if date validation logic changes, all 10 copies must be updated independently.

### Implementation

Option A (Preferred): Export `parseDateToISO` from `packages/parser/src/date-utils.ts` and have all bank adapters import it.

1. Add `parseDateToISO` export to `packages/parser/src/date-utils.ts` (move the function from `generic.ts` or create a shared version that covers all date formats including bank-adapter-specific ones).

2. Update each bank adapter to import:
```typescript
import { parseDateToISO } from '../date-utils.js';
```

3. Remove the local `parseDateToISO` function from each adapter.

Option B (Minimal): Keep the bank adapters' `parseDateToISO` as-is since Korean bank CSV exports consistently use YYYY.MM.DD format. This is a DRY violation but low practical impact.

### Verification

- `bun test` from repo root should pass
- Bank adapters can still parse YYYY.MM.DD dates correctly
- If Option A is chosen, Korean short dates and MM/DD dates also work

---

## Deferred Items

| Finding | Reason for Deferral |
|---|---|
| None | All findings have tasks scheduled above |

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | DONE |
| 2 | DONE (merged into Task 1) |
| 3 | DONE |
