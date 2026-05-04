# Cycle 32 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 32
**Tests:** 574 bun, 243 vitest (817 total)

## Summary
5 actionable findings: PDF AMOUNT_PATTERN missing Won sign prefix, YYMMDD date format not supported, normalizeHeader missing directional Unicode chars, "마이너스" amount prefix not handled, and test coverage gaps. 1 deferred architecture item.

## Findings

### F-01: PDF AMOUNT_PATTERN missing Won sign prefix (MEDIUM)
PDF table row detection regex does not match small Won-sign-prefixed amounts like "₩500" without commas. Server and web PDF parsers both affected.

### F-02: YYMMDD date format not supported (LOW)
6-digit compact date format (e.g., "240115" for 2024-01-15) not handled by parseDateStringToISO in server or web date-utils.

### F-04: normalizeHeader missing directional Unicode (LOW)
Directional formatting characters (U+200E, U+200F, U+202A-202E, U+FEFF) not stripped, could break header matching.

### F-05: "마이너스" amount prefix not handled (LOW)
Korean bank exports may prefix amounts with "마이너스" instead of minus sign. parseCSVAmount would return null.

### F-06: Test coverage gaps for new format support (MEDIUM)
Missing tests for YYMMDD, Won sign PDF amounts, 마이너스 prefix, directional Unicode normalization.

## Deferred Items
| ID | Item | Reason |
|----|------|--------|
| F-03 | Web CSV factory refactor | Requires shared module architecture (D-01) |

## Regressions
None. All 817 tests passing.