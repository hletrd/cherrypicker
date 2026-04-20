# Plan 44 — High Priority Fixes (Cycle 32)

**Source findings:** C32-01 (MEDIUM, High confidence)

---

## Task 1: Fix server-side `parseGenericCSV` to use `Math.round(parseFloat(...))` instead of `parseInt` for amount parsing

**Finding:** C32-01
**Severity:** MEDIUM
**Confidence:** High
**File:** `packages/parser/src/csv/generic.ts:124`

### Problem

The server-side `parseGenericCSV` uses `parseInt(cleaned, 10)` for amount parsing, while the web-side `csv.ts` uses `Math.round(parseFloat(cleaned))`. For decimal inputs like "1234.56", `parseInt` returns 1234 (truncation) while `Math.round(parseFloat(...))` returns 1235 (rounding). Korean Won amounts should be integers, but formula-rendered CSV cells can contain decimal remainders. The web-side correctly rounds (C21-03), while the server-side truncates, producing different amounts for the same input.

This affects the `packages/parser` module used by `tools/cli/` and `tools/scraper/`.

### Implementation

1. Open `packages/parser/src/csv/generic.ts`
2. Locate the `parseAmount` function (around line 119-127):
   ```typescript
   function parseAmount(raw: string): number | null {
     let cleaned = raw.trim().replace(/원$/, '').replace(/,/g, '');
     const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
     if (isNeg) cleaned = cleaned.slice(1, -1);
     if (!cleaned) return null;
     const n = parseInt(cleaned, 10);
     if (Number.isNaN(n)) return null;
     return isNeg ? -n : n;
   }
   ```
3. Replace `parseInt(cleaned, 10)` with `Math.round(parseFloat(cleaned))`:
   ```typescript
   const n = Math.round(parseFloat(cleaned));
   if (Number.isNaN(n)) return null;
   return isNeg ? -n : n;
   ```
4. Run the test suite to verify

### Exit Criterion

- Server-side `parseAmount` produces the same result as web-side for all decimal inputs
- All existing tests pass

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | DONE |
