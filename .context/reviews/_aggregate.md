# Cycle 6 Aggregate Review

## Summary
7 findings total. 2 HIGH, 2 MEDIUM, 3 LOW.

## Priority Fixes (Implement This Cycle)

### P1 — `isValidHeaderRow` header normalization [C6-01] HIGH
`isValidHeaderRow()` compares raw cell values against HEADER_KEYWORDS without
normalizing. "이용금액(원)" won't match "이용금액", causing header detection to
fail on real bank exports. Apply `normalizeHeader()` to cells before keyword
checking. Affects: column-matcher.ts, all callers.

### P2 — BOM stripping in detectFormat [C6-02] MEDIUM
`detectFormat()` doesn't strip BOM before calling `detectBank()` on CSV content.
Fix in detect.ts before the `detectBank()` call.

### P3 — Won sign (₩/￦) in amount parsing [C6-05] LOW
Add ₩ and ￦ to the characters stripped in amount parsers. Affects:
- `packages/parser/src/csv/shared.ts` — parseCSVAmount
- `packages/parser/src/xlsx/index.ts` — parseAmount
- `packages/parser/src/pdf/index.ts` — parseAmount

### P4 — XLSX Date object handling [C6-03] MEDIUM
Add `Date` object branch in XLSX `parseDateToISO()` as defensive hardening.

### P5 — Generic CSV: use Set for reserved columns [C6-04] LOW
Clean up the merchant inference loop in `generic.ts` to use a Set for reserved
column indices, matching the web-side pattern.

### P6 — Test coverage for new edge cases
- Headers with parenthetical suffixes in XLSX
- BOM in detectFormat path
- Won sign amounts
- Date objects in XLSX
- More column name synonym tests

## Deferred Items (Carry Forward)
- Server-side ColumnMatcher module vs browser-side duplication
- PDF multi-line header support
- Encoding auto-detection (EUC-KR/CP949)
- XLSX forward-fill false positives from sparse rows
- pdf-parse deprecation
- Historical amount display format
- Card name suffixes
- Global config integration
- CSS dark mode migration