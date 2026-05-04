# Code Review -- Cycle 45

## Findings: 2 actionable

### F1. CSV generic `^\d{6}$` DATE_PATTERN too broad for column detection [MEDIUM]
- `packages/parser/src/csv/generic.ts` line 29, `apps/web/src/lib/parser/csv.ts` line 139
- `DATE_PATTERNS` includes `^\d{6}$` which matches ANY 6-digit number as a date candidate
- During `isDateLike()` column detection, a column with 6-digit transaction IDs (123456, 999999) would be misidentified as the date column
- `parseDateStringToISO` would reject invalid YYMMDD, but column assignment is already wrong
- Fix: add `isYYMMDDLike()` validation that checks month/day ranges, matching `isDateLikeShort()`

### F2. CSV `AMOUNT_PATTERNS` lack boundary guards [LOW]
- `packages/parser/src/csv/generic.ts` lines 52-59, `apps/web/src/lib/parser/csv.ts` lines 161-168
- Pattern `/^-?[\d,]+$/` could match strings with hyphens after trimming
- PDF parser's `AMOUNT_PATTERN` uses `(?<![a-zA-Z\d-])` lookbehind guards
- Fix: add boundary guard to prevent hyphenated strings from matching