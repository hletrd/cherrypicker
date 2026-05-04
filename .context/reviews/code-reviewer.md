# Cycle 71 Code Review

## C71-01: AMOUNT_PATTERNS missing leading-plus pattern (BUG - MEDIUM)

All four parsers' column-detection amount patterns do NOT include a pattern matching leading-plus amounts like `+1,234`. However, ALL `parseAmount` / `parseCSVAmount` functions DO strip leading `+` signs (`.replace(/^\+/, '')` added in C66-02).

**Impact:** A CSV/PDF file with `+1,234` amounts will parse rows correctly, but column detection via `isAmountLike('+1,234')` returns false. The generic CSV parser's data-inference path fails to identify the amount column, producing "필수 컬럼을 찾을 수 없습니다: 금액".

**Affected files:**
1. `packages/parser/src/csv/generic.ts` line 68-76: `AMOUNT_PATTERNS` array - needs `^\+[\d,]+원?$`
2. `apps/web/src/lib/parser/csv.ts` line 240-251: `AMOUNT_PATTERNS` array - same fix
3. `packages/parser/src/pdf/table-parser.ts` line 14: `AMOUNT_PATTERN` - needs `|(?<![a-zA-Z\d])\+[\d,]+원?` alternative
4. `apps/web/src/lib/parser/pdf.ts` line 43: `AMOUNT_PATTERN` - same fix

**Not affected:** XLSX parsers (amounts read as raw cell values, not via column-detection patterns).

## No Regressions Detected

Server/web parity is excellent. All 24 bank adapters, RFC 4180 CSV, all amount/date formats, PDF structured + fallback parsing, and XLSX merged-cell forward-fill match on both sides.