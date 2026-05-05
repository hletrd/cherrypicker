# Cycle 87 Implementation Plan

## Goal
Fix 3 format diversity findings and add test coverage.

## Plan

### P1: Add `desc`/`amt`/`txn` to column patterns (F1)
**File**: `packages/parser/src/csv/column-matcher.ts`
- Add `^desc$` to MERCHANT_COLUMN_PATTERN and MEMO_COLUMN_PATTERN
- Add `^amt$` to AMOUNT_COLUMN_PATTERN
- Add `^txn$` to MEMO_COLUMN_PATTERN
- Parity: all changes apply to shared column patterns used by CSV/XLSX/PDF

### P2: Add `installment`/`install`/`remark` to HEADER_KEYWORDS (F2)
**File**: `packages/parser/src/csv/column-matcher.ts`
- Add `'installment'`, `'install'`, `'remark'` to HEADER_KEYWORDS array

### P3: XLSX numeric YYYYMMDD date parsing (F3)
**Files**: `packages/parser/src/xlsx/index.ts`, `apps/web/src/lib/parser/xlsx.ts`
- In `parseDateToISO`, before the `> 100000` guard, check if the number is a valid YYYYMMDD (10000000-99999999, valid month/day)
- If so, parse it as YYYY-MM-DD directly
- Same fix on both server and web sides for parity

### P4: Tests
**Files**: `packages/parser/__tests__/column-matcher.test.ts`, `packages/parser/__tests__/xlsx.test.ts`
- Test that `desc`, `amt`, `txn` headers match correct column roles
- Test that numeric YYYYMMDD dates parse correctly in XLSX

## Deferred (unchanged)
- D-01: Shared module refactor
- PDF multi-line headers
- Historical amount display
- Card name suffixes
- Global config
- Generic parser fallback
- CSS dark mode