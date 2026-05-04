# Test Engineer -- Cycle 27

**Date:** 2026-05-05

## New Test Cases Needed (F2)

### 1. PDF amount pattern rejects year values

Add tests in `table-parser.test.ts`:
- `findAmountCell(["2024", "1,234"])` should return index 1 (the amount), not 0 (the year)
- The table-parser AMOUNT_PATTERN should NOT match "2024" when preceded by space
- The table-parser AMOUNT_PATTERN should match "1,234", "100", "₩6,500"

### 2. Server PDF findAmountCell rejects year values

Tests for the strict `AMOUNT_PATTERN` in `pdf/index.ts`:
- `findAmountCell(["2024"])` should return null
- `findAmountCell(["1,234"])` should return the cell

## Current Test Counts
- Bun: 526 pass, 0 fail
- Vitest: 242 pass, 0 fail