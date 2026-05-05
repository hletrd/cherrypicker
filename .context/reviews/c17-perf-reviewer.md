# Cycle 17 — Performance Review

**Date:** 2026-05-05
**Scope:** Performance, CPU efficiency, memory usage, I/O patterns

## Findings

### C17-PERF01 [LOW] — PDF fallback scanner regex `matchAll` creates intermediate array for every line
- **File:** `packages/parser/src/pdf/index.ts:341`, `apps/web/src/lib/parser/pdf.ts:594`
- **Issue:** `const amountMatches = [...line.matchAll(fallbackAmountPattern)];` eagerly collects ALL matches into an array, then immediately takes only the last one. For lines with many numeric sequences (e.g., long transaction detail lines), this allocates unnecessary arrays.
- **Impact:** Negligible for typical PDFs (< 1000 lines), but could accumulate on very large statements.
- **Fix:** Use a manual loop with `regex.exec()` or reverse the line scan to find the last match directly without collecting all matches.
- **Confidence:** Low

### C17-PERF02 [LOW] — `isSummaryRow` regex is expensive and runs on every row
- **File:** `packages/parser/src/csv/column-matcher.ts:93`, `apps/web/src/lib/parser/column-matcher.ts:79`
- **Issue:** `SUMMARY_ROW_PATTERN` is a massive regex with 50+ alternatives and many lookbehinds. It runs on every row during parsing. The 500-char cap helps but the regex still compiles and executes per-row.
- **Impact:** Low — parsing is not a hot path in user interaction. But for batch processing of many files, the regex overhead adds up.
- **Fix:** Pre-check with a simpler, faster regex (e.g., `/합계|총|계|잔액|누계|total|sum/i`) before running the full boundary-aware pattern. Early-exit on rows that clearly don't contain summary keywords.
- **Confidence:** Low

### C17-PERF03 [LOW] — `parseTable` in web PDF parser builds full column boundary array for every table
- **File:** `apps/web/src/lib/parser/pdf.ts:56-91`
- **Issue:** `detectColumnBoundaries` allocates a `charCount` array sized to the maximum line length, then scans every character of every line. For wide PDFs (e.g., landscape statements with 200+ char lines), this is O(n * m) where n = lines and m = line length.
- **Impact:** Low — PDF text extraction is already the dominant cost.
- **Fix:** Not actionable without profiling data. Consider streaming or sampling approaches if profiling shows this as a hotspot.
- **Confidence:** Low

## Summary

No HIGH or MEDIUM performance findings. Three LOW items with marginal impact. The codebase is well-optimized for its use case.

| Severity | Count |
|----------|-------|
| LOW | 3 |

**Verdict:** SHIP IT — no performance blockers.
