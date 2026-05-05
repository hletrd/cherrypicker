# Cycle 88 Code Review

## Previous cycle status
Cycle 87 findings F1-F3 (desc/amt/txn patterns, HEADER_KEYWORDS gaps, XLSX numeric YYYYMMDD dates) are ALL RESOLVED in current code.

## Findings

### F1 (MEDIUM): isValidShortDate/isDateLikeShort rejects Feb 29 in non-leap years — BUG
**Files**:
- `packages/parser/src/csv/generic.ts` (isDateLikeShort, line ~46)
- `packages/parser/src/pdf/table-parser.ts` (isValidShortDate, line ~168)
- `apps/web/src/lib/parser/csv.ts` (isDateLikeShort, line ~221)
- `apps/web/src/lib/parser/pdf.ts` (isValidShortDate, line ~57)

All four implementations validate short MM.DD dates using `daysInMonth(new Date().getFullYear(), month)`. When the parser runs in a non-leap year (e.g., 2026), Feb 29 dates from leap-year statements (e.g., 2024, 2028) are rejected as invalid.

**Consequences**:
1. CSV: `isDateLike()` returns false for "2/29", potentially preventing date column detection
2. PDF: `isValidDateCell()` returns false for "2.29", dropping transaction rows
3. `parseDateStringToISO()` -> `inferYear()` -> `isValidDayForMonth()` also rejects "2.29" in non-leap years

**Fix**: Modify validation to check both current year AND previous year (2-year window). This covers the realistic range of statement dates and aligns with `inferYear()`'s 3-month look-back heuristic.

### No other new findings
After 87 cycles of refinement, parsers handle: 24 banks, RFC 4180 CSV, all delimiters, BOM/encoding, XLSX (HTML-as-XLS, multi-sheet, forward-fill, formula errors, numeric YYYYMMDD), PDF (header-aware columns, boundary detection, YYMMDD/YYYYMMDD, merchant extraction, reversed column order), and comprehensive amount patterns (parenthesized, 마이너스, trailing minus, Won sign, KRW, full-width, leading plus).