# Test Engineer -- Cycle 33

**Date:** 2026-05-05

## New Test Cases Needed

### 1. Server-side PDF Won-sign amount parsing (F-01)
- `findAmountCell(["₩500"])` should match (currently rejected by STRICT_AMOUNT_PATTERN)
- `findAmountCell(["₩1,234"])` should match
- `findAmountCell(["₩123"])` should match

### 2. Server-side PDF fallback Won-sign amounts (F-02)
- Fallback line scanner should pick up "₩500" amounts from lines like "2024-01-15 스타벅스 ₩500"

### 3. Web-side "마이너스" prefix (F-03)
- `parseAmount("마이너스 1,234")` should return -1234
- `parseAmount("마이너스1234")` should return -1234

### 4. Combined column header matching (F-04)
- `findColumn(["이용일/승인일"], undefined, DATE_COLUMN_PATTERN)` should return 0
- `findColumn(["이용금액-원"], undefined, AMOUNT_COLUMN_PATTERN)` should return 0
- `isValidHeaderRow(["이용일/승인일", "가맹점명", "이용금액"])` should return true

## Current Test Counts
- Bun: 851 pass, 0 fail
- Vitest: 243 pass, 0 fail