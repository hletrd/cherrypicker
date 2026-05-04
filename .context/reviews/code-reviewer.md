# Cycle 82 Code Review

## Reviewer: code-reviewer

### Overview
After 81 cycles (1072+ tests passing: 82 vitest + 990 bun + 147 vitest on other files), the parser is highly mature. Cycle 81 correctly added YYYYMMDD support to `findDateCell()`, `isValidDateCell()`, and `fallbackDatePattern`. However, the PDF `DATE_PATTERN` used by `parseTable()` was NOT updated to recognize YYYYMMDD as table content markers.

## Findings

### F82-01: PDF DATE_PATTERN missing YYYYMMDD — parseTable() won't detect YYYYMMDD lines as table content [HIGH]
**Files**: `packages/parser/src/pdf/table-parser.ts`, `apps/web/src/lib/parser/pdf.ts`
**Issue**: The `DATE_PATTERN` regex in `parseTable()` determines which lines are table content. It does NOT include `\d{8}` alternative. Verified by testing: `'20240115'.match(DATE_PATTERN)` returns null. Lines like "20240115 Starbucks 3500원" (amount < 5 digits, no comma) are completely missed by both `hasDate` and `hasAmount` checks in `parseTable()`.
**Impact**: PDF tables using YYYYMMDD dates with small amounts (< 10,000 Won without comma) are silently dropped by the structured parser. The fallback line scanner handles this correctly (cycle 81 fix).
**Fix**: Add `(?<!\d)\d{8}(?!\d)` alternative to both server and web `DATE_PATTERN` regexes. Add tests.

### F82-02: Server CSV index.ts does not re-export SUMMARY_ROW_PATTERN [LOW]
**Files**: `packages/parser/src/index.ts`
**Issue**: The server-side package exports column patterns from column-matcher but does NOT export `SUMMARY_ROW_PATTERN`. External consumers must use internal paths.
**Fix**: Add `SUMMARY_ROW_PATTERN` to the export list.

## Format Diversity Assessment
Comprehensive coverage after 81 cycles:
- 24 bank CSV adapters with flexible column matching (90+ patterns)
- All common Korean/English date formats
- All amount formats (Won, KRW, 마이너스, parenthesized, trailing-minus, etc.)
- RFC 4180 multi-line quoted CSV, HTML-as-XLS, multi-sheet XLSX
- PDF structured + fallback parsing with header-aware column detection

## Server/Web Parity
CONFIRMED: Identical column patterns, summary row pattern, header keywords, amount/date parsing algorithms. F82-01 affects both sides symmetrically.

## Test Coverage
1072+ tests. Gaps: No integration test for YYYYMMDD in full PDF parse with small amounts (the F82-01 scenario).