# Cycle 83 Aggregate Review

## Summary
After 82 cycles, the parser is highly mature with 1222 bun + 287 vitest tests passing.
This cycle identifies **6 actionable findings** focused on test coverage gaps for
format diversity features that already exist in code but lack test coverage.

## Findings by Priority

### HIGH (implement this cycle)
| ID | Area | Finding |
|----|------|---------|
| F1 | CSV | Datetime strings in column detection untested |
| F2 | CSV | Tab/pipe/semicolon-delimited CSV full parse untested |

### MEDIUM (implement this cycle)
| ID | Area | Finding |
|----|------|---------|
| F4 | Column Matcher | normalizeHeader fullwidth alphanumeric untested |
| F5 | Column Matcher | findColumn "+" / "＋" delimiter splitting untested |

### LOW (implement if time permits)
| ID | Area | Finding |
|----|------|---------|
| F6 | CSV | Amount column with 원 suffix detection untested |

## No Regressions
All 1222 bun tests and 287 vitest tests passing.

## Findings

### F82-01: PDF DATE_PATTERN missing YYYYMMDD — parseTable() won't detect 8-digit date lines [HIGH]
**Files**: `packages/parser/src/pdf/table-parser.ts`, `apps/web/src/lib/parser/pdf.ts`
**Issue**: The `DATE_PATTERN` regex used by `parseTable()` does NOT include `\d{8}` alternative. Verified: `'20240115'.match(DATE_PATTERN)` returns null. Lines with YYYYMMDD dates and small amounts (< 10,000 Won without comma) are completely missed.
**Impact**: PDF tables using YYYYMMDD dates with small unformatted amounts silently dropped by structured parser.
**Fix**: Add `(?<!\d)\d{8}(?!\d)` to both server and web `DATE_PATTERN`. Add tests.

### F82-02: Server CSV index.ts missing SUMMARY_ROW_PATTERN export [LOW]
**Files**: `packages/parser/src/index.ts`
**Issue**: Column patterns are exported but `SUMMARY_ROW_PATTERN` is not.
**Fix**: Add to export list.

### F82-03: F81 findings confirmed resolved [INFO]
**Status**: F81-01 (YYYYMMDD in findDateCell/isValidDateCell/fallbackDatePattern) confirmed correctly implemented in cycle 81.

## Server/Web Parity
CONFIRMED: Identical column patterns, summary row pattern, header keywords, amount/date parsing algorithms. F82-01 affects both sides symmetrically.

## Deferred Items (unchanged)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode
- D-01 shared module refactor