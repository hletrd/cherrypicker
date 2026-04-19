# Plan: C34-01 — Server-side PDF parseDateToISO missing all date formats and range validation

**Status:** DONE
**Finding:** C34-01 (HIGH, High confidence)
**File:** `packages/parser/src/pdf/index.ts:14-18`

## Problem

The `parseDateToISO` function in `packages/parser/src/pdf/index.ts` is a minimal stub that only handles `YYYY[.-/]MM[.-/]DD` format via a single regex match. It is missing:
1. YYYYMMDD format handling
2. Short-year (YY-MM-DD) format handling
3. Korean full-date (YYYY년 M월 D일) format handling
4. Korean short-date (M월 D일) with year inference
5. MM/DD short-date with year inference
6. Month/day range validation for the one format it does handle

All other `parseDateToISO` implementations have been updated with full format coverage and range validation. The server-side PDF parser was never updated.

## Implementation

### Step 1: Replace `parseDateToISO` in `packages/parser/src/pdf/index.ts`

Replace the current minimal implementation (lines 14-18):
```ts
function parseDateToISO(raw: string): string {
  const match = raw.match(DATE_PATTERN);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return raw;
}
```

With the full implementation from `apps/web/src/lib/parser/pdf.ts`, which includes:
- Full-date (YYYY-MM-DD) with range validation
- Short-year (YY-MM-DD) with range validation
- Korean full-date with range validation
- Korean short-date with year inference and range validation
- MM/DD short-date with year inference and range validation
- `inferYear` helper function

### Step 2: Update the `DATE_PATTERN` constant

The current `DATE_PATTERN` at line 11 is:
```ts
const DATE_PATTERN = /(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/;
```

This is used by both `parseDateToISO` and the row-filtering logic. Since the new `parseDateToISO` has its own inline patterns, the module-level `DATE_PATTERN` only needs to serve the row-filtering logic. Keep it as-is for that purpose, but also add `SHORT_YEAR_DATE_PATTERN`, `KOREAN_FULL_DATE_PATTERN`, `KOREAN_SHORT_DATE_PATTERN`, and `SHORT_MD_DATE_PATTERN` for the `findDateCell` function (if not already present).

Wait — looking at the code again, `packages/parser/src/pdf/index.ts` uses `DATE_PATTERN` and `AMOUNT_PATTERN` for the table-parser module which is imported separately. The `findDateCell` and `findAmountCell` functions use `DATE_PATTERN` and `AMOUNT_PATTERN` directly. The current `DATE_PATTERN` only matches YYYY-MM-DD format, so dates in Korean or short format would be missed by `findDateCell`. However, this is a separate issue from the `parseDateToISO` fix.

For this plan, focus only on fixing `parseDateToISO` to handle all date formats and validate ranges. The `findDateCell` detection scope is a separate concern.

### Step 3: Verify bun test passes

Run `bun test` from the repo root. All 266 tests should pass.

### Step 4: Verify server-side PDF parsing still works

The server-side PDF parser uses `tryStructuredParse` which calls `parseTable` and `filterTransactionRows` from the table-parser module. The `parseDateToISO` is only called after a row is identified as containing a date. Verify that the new implementation does not break existing table parsing.

## Verification

- `bun test` from repo root should pass with 0 errors and 0 failures
- Date strings like "20251130" should produce "2025-11-30" (not "20251130")
- Date strings like "25-11-30" should produce "2025-11-30"
- Date strings like "2025년 11월 30일" should produce "2025-11-30"
- Date strings like "11월 30일" should produce "YYYY-11-30" with year inference
- Invalid dates like "2026/13/99" should return the raw string (not "2026-13-99")
