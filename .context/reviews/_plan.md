# Cycle 67 Implementation Plan

## Priority 1: Add splitCSVContent to web-side CSV parser (F1)
**File**: `apps/web/src/lib/parser/csv.ts`
- Add a local `splitCSVContent()` function matching the server-side implementation from `packages/parser/src/csv/shared.ts`
- Replace `content.split('\n').filter(l => l.trim())` in `parseGenericCSV` (line 216) with `splitCSVContent(content, delimiter)`
- Replace `content.split('\n').filter(l => l.trim())` in `createBankAdapter.parseCSV` (line 406) with `splitCSVContent(content, delimiter)`

## Priority 2: Fix web-side adapter skip condition (F2)
**File**: `apps/web/src/lib/parser/csv.ts` line 441
- Change `if (!dateRaw && !merchantRaw) continue;` to `if (!dateRaw && !merchantRaw && !amountRaw) continue;`

## Priority 3: Add console.warn to web-side adapter detect loop (F3)
**File**: `apps/web/src/lib/parser/csv.ts`
- Add `console.warn` in the signature-detect catch block, matching server-side

## Priority 4: Add column detection failure error to web-side generic CSV (F4)
**File**: `apps/web/src/lib/parser/csv.ts` in `parseGenericCSV`
- Add error reporting when `dateCol === -1 || amountCol === -1` after data-inference, matching server-side

## Deferred
None.