# Cycle 94 Aggregate Review

## Summary
After 93 cycles, 1306 bun tests pass with 0 failing. This cycle identifies **3 actionable findings** (1 bug, 2 enhancements) and **4 deferred items**.

## Actionable Findings

### F-94-01: XLSX parser returns invalid dates in transaction objects (BUG)
Both XLSX parsers (server `packages/parser/src/xlsx/index.ts`, web `apps/web/src/lib/parser/xlsx.ts`)
push a parse error when `parseDateToISO` returns an invalid date, but still include
the invalid date string in the transaction. The CSV adapter-factory and generic CSV
parser both validate with `isValidISODate(parsedDate)` after parsing — the XLSX
parsers should do the same for consistency.

**Fix**: Add `isValidISODate` post-parse check in both XLSX parsers after
`parseDateToISO` call, matching the CSV adapter pattern.

### F-94-02: Generic CSV merchant inference picks first Korean-text column, not best (ENHANCEMENT)
Both generic CSV parsers iterate columns left-to-right, pick the first non-reserved
column with any Korean text. This can misidentify memo/비고 columns that appear before
the actual merchant column. Better: rank by Korean text density.

**Fix**: Collect all candidate columns, rank by Korean character count, pick highest.

### F-94-03: Missing header keyword "매입일자" in date column pattern (FORMAT DIVERSITY)
Date column pattern includes "매입일" but not "매입일자" (common variant). This causes
header detection failure for banks using "매입일자" as a date column name.

**Fix**: Add "매입일자" to DATE_COLUMN_PATTERN, HEADER_KEYWORDS, DATE_KEYWORDS in
both server and web column-matcher files.

## Deferred Items
- D-01: PDF multi-line header support (architectural)
- D-02: Web-side code duplication / shared module refactor
- D-03: Six copies of isValidShortDate/parseAmount (consistent, defer to shared module)
- D-04: Historical amount display format, card name suffixes, global config