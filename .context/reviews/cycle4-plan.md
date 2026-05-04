# Cycle 4 Implementation Plan

## Priority 1 (HIGH) — Active work
1. **F-C4-01**: Refactor web-side bank adapter header detection to use category-based validation
2. **F-C4-02**: Remove console.warn from server-side csv/index.ts

## Priority 2 (MEDIUM) — Active work
3. **F-C4-03**: Improve merchant column inference in generic CSV — prefer Korean text columns
4. **F-C4-04**: Add XLSX merged cell forward-fill for date columns
5. **F-C4-07**: Extract shared HEADER_KEYWORDS and category keyword Sets into column-matcher.ts

## Priority 3 (LOW) — Deferred
6. **F-C4-05**: XLSX date cells with Korean locale — covered by existing regex, add test only
7. **F-C4-06**: splitLine non-comma RFC 4180 — LOW impact, defer with exit criterion
8. **F-C4-08**: CATEGORY/MEMO in header arrays — LOW impact, defer
9. **F-C4-09**: detectFormat double-read — refactor detectFormat to accept buffer, defer to architecture cycle

## Deferred items with exit criteria
- F-C4-06: Exit when a real-world tab-delimited bank export with quoted fields is reported
- F-C4-08: Exit when a bank export is found that has category/memo but no amount column
- F-C4-09: Exit when performance profiling shows detectFormat as a bottleneck
