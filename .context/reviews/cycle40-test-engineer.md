# Test Engineering Review -- Cycle 40

## Current Coverage
- Bun tests: 692 passing
- Vitest tests: 250 passing
- Total: 942 tests

## Coverage Gaps

### GAP-1: No tests for 14 additional bank CSV adapters [HIGH]
The 14 new CSV adapters (kakao, toss, kbank, bnk, dgb, suhyup, jb, kwangju, jeju, sc, mg, cu, kdb, epost) have no dedicated tests. `csv-adapters.test.ts` only covers the original 10 banks.

### GAP-2: No test for normalizeHeader with combined "/" headers [MEDIUM]
No test verifies that headers like "이용일/승인일" correctly match through findColumn's "/" splitting logic.

### GAP-3: No test for XLSX with date column containing Korean full date format [LOW]
XLSX tests use ISO dates and Excel serial numbers, but no test uses "2026년 2월 1일" format in cells.

### GAP-4: No test for PDF fallback line scanner with small amounts [LOW]
PDF tests don't verify that small amounts like "₩500" are correctly detected by the fallback scanner.
