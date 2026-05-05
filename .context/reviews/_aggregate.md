# Cycle 91 Aggregate Review

## Summary
After 90 cycles, 1299 bun tests passing. This cycle identifies **2 format diversity bugs** in the PDF and XLSX parsers:

1. **F-91-01 (HIGH)**: PDF `findDateCell()` missing YYMMDD validation in both server and web-side parsers. The structured parser's `filterTransactionRows()` correctly identifies rows with 6-digit YYMMDD dates (e.g., "240115") via `isValidDateCell()` → `isValidYYMMDD()`, but then the structured parser's `findDateCell()` doesn't include YYMMDD validation, so it returns null and the row is skipped.

2. **F-91-02 (MEDIUM)**: XLSX parser missing numeric YYMMDD date handling. 6-digit numeric dates (e.g., 240115) stored in XLSX cells hit the serial date guard (`raw > 100000`) and are rejected instead of being parsed as YYMMDD dates. Affects both server and web-side XLSX parsers.

## Findings

| # | Severity | Area | Description | Status |
|---|----------|------|-------------|--------|
| F-91-01 | HIGH | PDF (server+web) | `findDateCell()` missing YYMMDD (6-digit compact date) validation — structured parser skips valid YYMMDD rows that `filterTransactionRows` accepts | Planned |
| F-91-02 | MEDIUM | XLSX (server+web) | Numeric YYMMDD dates (6-digit, e.g., 240115) rejected by serial date guard (`raw > 100000`) instead of parsed as YYMMDD dates | Planned |

## Previous Cycle Findings (Resolved)
- F-90-01 (server PDF isValidShortDate parity): Fixed in cycle 90 — now uses 4-year window
- F-90-02 (Missing test coverage for Feb 29): Fixed in cycle 90
- F-90-03 (D-01 shared module): Deferred (unchanged)

## Architecture Notes
- Server/web parity is excellent across all parsers (CSV, XLSX, PDF)
- All 6 isValidShortDate/isDateLikeShort implementations use 4-year window (C88-01)
- Column matching, header detection, and summary row patterns are fully shared
- 24 bank adapters on both server and web sides

## Deferred Items (unchanged)
- D-01: Shared module between Bun/browser (significant refactor)
- PDF multi-line header support (needs fixture data)
- Historical amount display (low priority)
- Card name suffixes (low priority)
- Global config integration (feature work)
- Generic parser fallback (needs UX decisions)
- CSS dark mode (frontend work)