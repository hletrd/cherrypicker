# Cycle 84 Code Review

## Summary
After 83 cycles, the parser is very mature with 1231 bun + 296 vitest tests passing.
This cycle identifies **2 actionable findings** focused on format diversity gaps where
existing code handles a format at parse time but not at column-detection time.

## Findings by Priority

### MEDIUM (implement this cycle)
| ID | Area | Finding |
|----|------|---------|
| F84-01 | CSV Generic | Full-width digit amounts not detected during column inference |
| F84-02 | CSV Web | parseAmount missing explicit empty-string early return (parity) |

## No Regressions
All 1231 bun tests and 296 vitest tests passing. Server/web XLSX adapter configs
confirmed identical. All column patterns, summary row patterns, and header keywords
confirmed in parity between server and web.

## Findings

### F84-01: Full-width digit amounts not detected during column inference [MEDIUM]
**Files**: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
**Issue**: The `AMOUNT_PATTERNS` array used by `isAmountLike()` for data-inference
column detection does NOT include patterns for full-width digit amounts like `１，２３４`
or `１２３４５`. While `parseCSVAmount()` correctly handles them at parse time (it converts
full-width digits to ASCII before parsing), the generic CSV parser cannot identify
the amount column when headers are absent and data contains full-width amounts.
**Impact**: Generic CSV parsing fails when headers are unrecognized AND amounts use
full-width digits (rare but possible with East Asian bank exports).
**Fix**: Add full-width digit amount patterns to `AMOUNT_PATTERNS` in both server
and web generic CSV parsers. Add end-to-end test.

### F84-02: Web CSV parseAmount missing explicit empty-string guard [LOW]
**File**: `apps/web/src/lib/parser/csv.ts`
**Issue**: Server-side `parseCSVAmount` in `shared.ts` has `if (!raw.trim()) return null;`
as an explicit early return. Web-side `parseAmount` in `csv.ts` does not. While both
produce the correct result (empty string -> NaN -> null), the explicit guard is clearer
and matches the server-side pattern.
**Fix**: Add `if (!raw.trim()) return null;` to web-side parseAmount.

## Server/Web Parity
CONFIRMED: All column patterns, summary row pattern, header keywords, amount/date
parsing algorithms, XLSX bank adapter configs identical between server and web.

## Deferred Items (unchanged)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode
- D-01 shared module refactor