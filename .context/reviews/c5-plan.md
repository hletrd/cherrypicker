# Cycle 5 Implementation Plan

## Changes to Implement

### 1. Server XLSX: Add error reporting for invalid serial dates (F1)
**File:** `packages/parser/src/xlsx/index.ts`
- Add optional `errors`/`lineIdx` params to local `parseDateToISO`
- Push error when serial date resolves to invalid date
- Pass errors array from `parseXLSXSheet` to `parseDateToISO`
- Matches web-side pattern in `apps/web/src/lib/parser/xlsx.ts:220-222`

### 2. Server XLSX: Extend merged cell forward-fill to merchant + category (F3)
**File:** `packages/parser/src/xlsx/index.ts`
- Track `lastMerchant` and `lastCategory` alongside `lastDate`
- Forward-fill empty merchant and category cells from previous row
- Common in Korean bank installment exports

### 3. detectFormat: Eliminate double file read for CSV (F2)
**File:** `packages/parser/src/detect.ts`
- When format is CSV and we already have a buffer, reuse it for bank detection instead of reading again

### 4. Web generic CSV: Align merchant heuristic with server-side (F4)
**File:** `apps/web/src/lib/parser/csv.ts`
- Add Korean text check in sample data before falling back to first non-reserved column
- Match server-side logic in `packages/parser/src/csv/generic.ts:116-139`

### 5. Add test fixtures for real-world variations (F5)
**File:** `packages/parser/__tests__/xlsx.test.ts`, new fixtures
- XLSX test with serial date numbers (create programmatically)
- XLSX test with merged non-date cells
- CSV test with extra whitespace in headers
- CSV test with Korean text merchant heuristic

## Deferred Items
- F6: ColumnMatcher parenthetical stripping — LOW, no real-world issue
- F7: PDF multi-line transactions — LOW, covered by other tiers
- F8: Time-of-day stripping — LOW, informational only
- F9: BOM whitespace edge case — LOW, extremely rare
- F10: CP949 heuristic — LOW, reasonable current behavior
- Server/web code dedup — Architecture (deferred across all cycles)
