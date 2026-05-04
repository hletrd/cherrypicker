# Code Review -- Cycle 50

## Summary

After 49 cycles the parser handles 24 bank CSV/XLSX adapters, flexible column matching with extensive Unicode normalization, multi-format support (CSV/TSV/XLSX/PDF/HTML-as-XLS), and 772 bun + 265 vitest tests. Remaining findings focus on PDF date validation gaps, PDF combined-header splitting, and test coverage.

## Findings

### F1. PDF filterTransactionRows accepts any 6-digit string as date [MEDIUM]

**Files:** `packages/parser/src/pdf/table-parser.ts:5,156-162`, `apps/web/src/lib/parser/pdf.ts:33,174-180`

The `DATE_PATTERN` includes `(?<!\d)\d{6}(?!\d)` which matches any 6-digit string. The CSV parser validates these via `isYYMMDDLike()` (rejecting "123456", "999999"), but `filterTransactionRows()` has no such validation. A row with a 6-digit transaction ID and an amount is falsely detected as a transaction row.

**Fix:** Add post-filter validation checking date cells against actual date patterns + YYMMDD validation. Apply in both server and web PDF parsers.

### F2. PDF getHeaderColumns doesn't split combined headers [MEDIUM]

**Files:** `packages/parser/src/pdf/table-parser.ts:204-229`, `apps/web/src/lib/parser/pdf.ts:214-235`

`getHeaderColumns()` tests normalized cells directly against patterns. Combined headers like "비고/적요" or "취소금액|환불금액" tested as whole strings may not match. `findColumn()` from column-matcher.ts already splits on "/" and "|". Refactor to use shared `findColumn()`.

### F3. Summary row pattern missing standalone "합 계" variant [LOW]

**File:** `packages/parser/src/csv/column-matcher.ts:83`

The pattern has `총\s*합\s*계` but no standalone `합\s*계`. Some exports use "합 계" as a subtotal marker without "총" prefix.

**Fix:** Add standalone `(?<![가-힣])합\s*계(?![가-힣])(?=[\s,;]|$)`.

## Confirmed Fixed (from cycle 49)

- F3 (cycle 49): CSV AMOUNT_PATTERNS bare 5+ digit integers -- already present
- F4 (cycle 49): findColumn pipe splitting -- already present
- F5 (cycle 49): PDF DATE_PATTERN YYMMDD -- pattern present, but validation missing (F1 above)

## Test Gaps

### T1. No YYMMDD date test in PDF table parsing [MEDIUM]
### T2. No combined-header test in PDF column detection [MEDIUM]
### T3. No "합계" spacing variant test in summary row pattern [LOW]