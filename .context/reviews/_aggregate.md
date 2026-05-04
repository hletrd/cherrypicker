# Cycle 9 Review Aggregate

**Date:** 2026-05-04
**Reviews:** 1 comprehensive (cycle-9)
**Previous cycles:** 8 cycles, ~26 commits
**Baseline:** 231 bun tests passing

## New Findings (4 actionable, 4 deferred, 2 no-action)

### MEDIUM Priority
1. **F4** — XLSX parser has no try/catch around `xlsx.read()` — corrupted files crash
2. **F5** — PDF `AMOUNT_PATTERN` matches any digit sequence, causing false-positive row detection
3. **F7** — PDF fallback line scanner doesn't validate short dates with `isValidShortDate()`

### LOW Priority
4. **F6** — XLSX `findCol()` duplicates shared `findColumn()` from column-matcher

### Deferred (explicit deferral)
5. **F1** — XLSX duplicate column picks first match (requires data-aware heuristics)
6. **F3** — CSV splitCSVLine only handles quoted fields for comma delimiter
7. **F8** — English merchant column inference gap in generic parser

### No Action Required
8. **F2** — Server/web detectBank parity confirmed OK
9. **F9** — XLSX formula cells already handled gracefully
10. **F10** — Date validation parity confirmed OK
11. **F11** — BOM detection correct as-is

## Implementation Plan

### Fix F4: XLSX graceful degradation
- Wrap `xlsx.read()` in try/catch in `parseXLSX()`
- Return user-friendly ParseResult with Korean error message
- Add test for corrupted XLSX buffer

### Fix F5: Stricter PDF amount pattern
- Change `AMOUNT_PATTERN` to exclude hyphenated number sequences (card/phone numbers)
- Update both server and web-side PDF parsers
- Add test for false-positive rejection

### Fix F6: Use shared findColumn in XLSX
- Replace inline `findCol()` closure with imported `findColumn()`

### Fix F7: PDF fallback short date validation
- Add `isValidShortDate()` check after fallback date pattern match

## Deferred Items (for future cycles)
- Server/web CSV parser dedup (D-01 architectural refactor)
- PDF multi-line header support
- XLSX duplicate column resolution with data-aware heuristics
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior