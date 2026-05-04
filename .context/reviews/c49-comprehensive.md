# Cycle 49 Deep Code Review — Parser Format Diversity

## Findings

### F1: Web CSV parseAmount parenthesized negative + Won sign (BUG)
**Severity: Medium | File: apps/web/src/lib/parser/csv.ts:67-84**

The web-side `parseAmount` strips `원` and `₩` AFTER checking parenthesized negatives. If a Korean bank exports `(1,234원)`, the function checks `startsWith('(') && endsWith(')')` on `(1,234원)` which fails because of the trailing `원`. The server-side `parseCSVAmount` (packages/parser/src/csv/shared.ts:36-48) strips `원` and `₩` FIRST, then checks parens, which correctly handles `(1,234원)`.

### F2: CSV DATE_PATTERNS missing YYYYMMDD compact format (FORMAT GAP)
**Severity: Low | Files: packages/parser/src/csv/generic.ts:24-34, apps/web/src/lib/parser/csv.ts:133-143**

Both `DATE_PATTERNS` arrays (server and web) include 8-digit `YYYYMMDD` but NOT 6-digit `YYMMDD` as an explicit column-detection pattern. While `isYYMMDDLike()` validates YYMMDD, the data-inference path only matches via that function. The `DATE_PATTERNS` array drives `isDateLike()` which is used in the generic CSV parser's column-detection fallback — having YYMMDD explicitly listed (with its validator) would be clearer.

### F3: CSV AMOUNT_PATTERNS missing pure integer amounts >= 5 digits (FORMAT GAP)
**Severity: Low | Files: packages/parser/src/csv/generic.ts:73-80, apps/web/src/lib/parser/csv.ts:183-190**

The `AMOUNT_PATTERNS` used for column-detection heuristics require a comma or Won sign for short sequences. But pure 5+ digit integers (e.g., `50000`) are valid amounts handled by `parseCSVAmount` and the PDF parsers, yet not matched by `isAmountLike()`. The pattern `₩?\d[\d,]*원?` requires a comma if no Won sign. Adding `\d{5,}원?` would catch bare 5+ digit amounts.

### F4: XLSX findColumn doesn't handle "|" combined headers (PARITY)
**Severity: Low | File: packages/parser/src/csv/column-matcher.ts:48-53**

The `findColumn()` function splits combined headers on "/" but not on "|". Some Korean bank exports use "|" as a column separator within combined header cells (e.g., "이용일|승인일"). The CSV line splitter already handles "|" as a delimiter, but column name matching in `findColumn` and `normalizeHeader` don't treat "|" as a combined-header separator.

### F5: PDF table parser YYMMDD date not detected (FORMAT GAP)
**Severity: Low | File: packages/parser/src/pdf/table-parser.ts:5`

The `DATE_PATTERN` in the PDF table parser does not include YYMMDD format (6-digit compact dates like `240115`). Some Korean bank PDFs use this format. The CSV and XLSX parsers handle it via `parseDateStringToISO` and `isYYMMDDLike`, but the PDF table row detection skips these lines entirely because `DATE_PATTERN.test()` returns false.

### F6: Test coverage gap — CSV edge cases not tested
**Severity: Low**

Missing test scenarios:
- Parenthesized amounts with Won sign suffix: `(1,234원)`
- Amounts with full-width Won sign ￦ in CSV
- `마이너스` prefix in CSV adapters
- Pipe-delimited CSV files
- YYMMDD dates in generic CSV parser column detection
- 5+ digit bare integer amounts in column detection

### F7: Server CSV adapter-factory header scan limit inconsistency
**Severity: Informational | File: packages/parser/src/csv/adapter-factory.ts:44**

The `BankCSVConfig.maxHeaderScan` defaults to 30, matching the generic parser and web-side. This is consistent. No issue.

### F8: normalizeHeader unicode character class readability
**Severity: Informational | File: packages/parser/src/csv/column-matcher.ts:12**

The character class in `normalizeHeader` contains ~40 unicode code points inlined. While functional, it's hard to audit. A comment or named constant would improve readability. Deferred — not a format diversity issue.

## Summary

Found 4 actionable format diversity issues (F1, F3, F4, F5) and 2 test coverage gaps (F2, F6). F1 is the most impactful — it causes silent data loss for parenthesized Won amounts on the web side.