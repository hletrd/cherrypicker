# Cycle 21 — Performance Review

## C21-PERF01: No new performance findings this cycle

After reviewing all source files, no new performance issues were identified beyond those already deferred:
- C20-PERF01 (greedy optimizer recalculates full card rewards per tx) — ALREADY DEFERRED to D-09
- C20-PERF02 (string allocation in HTML forward-fill) — ALREADY DEFERRED

The codebase maintains reasonable performance characteristics:
- Forward-fill uses module-level compiled regexes (not recreated per row)
- CSV line splitting is O(n) per line with minimal allocation
- SheetJS `sheet_to_json` with `raw: true` avoids unnecessary type conversion
- Analyzer cache avoids redundant `toCoreCardRuleSets` transformations
- sessionStorage persistence truncates transactions when over 4MB instead of failing

**Note:** The web-side XLSX parser's `isHTMLContent` (line 366) decodes the first 512 bytes as UTF-8, then the full buffer is decoded again in the caller. The comment acknowledges this as "minor overhead bounded by the file size limit." This is acceptable for typical credit card statements (< 1MB).
