# Cycle 83 — Code Reviewer Report

## Current State
- 1222 bun tests passing, 287 vitest tests passing
- 24 bank CSV adapters on both server and web sides
- Comprehensive column matching with 90+ patterns
- PDF/XLSX/CSV parsers all mature with extensive edge case handling

## Remaining Findings

### F1: CSV datetime strings not in generic parser's isDateLike (MEDIUM)
The generic CSV parser's `isDateLike()` function includes a datetime pattern
`/^\d{4}[\s]*[.\-\/．。][\s]*\d{1,2}[\s]*[.\-\/．。][\s]*\d{1,2}[\sT]\d/`
but the actual CSV test suite has NO test coverage for datetime strings like
"2024-01-15 10:30:00" or "2024-01-15T10:30:00" in column detection. The pattern
exists but is untested — if it breaks during refactoring, there's no safety net.

### F2: Tab/pipe-delimited CSV parsing untested (MEDIUM)
The server-side CSV parser supports tab, pipe, and semicolon delimiters via
`detectCSVDelimiter()` and the splitCSVLine function works correctly for all
delimiters, but there are ZERO tests for tab-delimited or pipe-delimited CSV
content flowing through the full parseGenericCSV path. Only the `splitCSVLine`
and `splitCSVContent` functions are tested in csv-shared.test.ts.

### F3: Web-side parseAmount fullwidth digit handling — potential gap (LOW)
The web-side parseAmount replaces fullwidth digits ０-９ but does NOT replace
fullwidth period ． — only full-width comma ， and full-width dot ． are replaced
in the separate `.replace(/．/g, '.')` call. However, if a cell contains "１，２３４．５６"
(fullwidth comma AND fullwidth dot with fullwidth digits), the digit replacement
happens first but the comma/dot replacement also runs. This is correct.

### F4: normalizeHeader fullwidth alphanumeric test coverage (LOW)
`normalizeHeader()` has a regex that converts fullwidth alphanumeric (U+FF01-U+FF5E)
to ASCII, but there are NO tests verifying this specific normalization path.
The regex `/[！-～]/g` with `ch.charCodeAt(0) - 0xFEE0` is a known pattern but
has no unit test.

### F5: findColumn plus-sign delimiter splitting test (LOW)
`findColumn()` splits combined headers on `/[/|,+＋]/` including the fullwidth
plus sign ＋, but the test suite only covers "/" and "|" delimiters. The "+"
and "＋" paths are untested.

### F6: CSV amount column containing trailing Won suffix like "1,234원" untested in column detection (LOW)
While `parseCSVAmount` correctly strips 원 suffix, the column detection
`isAmountLike()` pattern `/^\d[\d,]*,\d[\d,]*\s*원?$/` handles this, but
no test verifies that a column with 원-suffixed amounts gets correctly detected
as the amount column during generic CSV parsing.

### F7: No regressions detected (INFO)
All existing tests pass. No regressions from cycle 82.

## Priority Summary
1. F1 + F2: Test coverage gaps for format diversity — actionable
2. F4 + F5 + F6: Minor test coverage gaps — quick wins
3. F3 + F7: No action needed