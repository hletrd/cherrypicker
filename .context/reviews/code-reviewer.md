# Code Reviewer -- Cycle 27

**Date:** 2026-05-05

## Finding F1: PDF AMOUNT_PATTERN false-positive matches 4-digit years [MEDIUM]

**Location:** 4 files across server and web PDF parsers

The `AMOUNT_PATTERN` regexes in all PDF parsers can match standalone 4-digit integers like "2024" as amounts:

1. `packages/parser/src/pdf/index.ts` line 20:
   `^[₩￦]?-?[\d,]+원?$|^\([\d,]+\)$` -- "2024" matches `[\d,]+`

2. `packages/parser/src/pdf/table-parser.ts` line 9:
   `(?<![a-zA-Z\d-])[\d,]+원?(?![a-zA-Z\d-])|\([\d,]+\)` -- " 2024" matches when preceded by space

3. `apps/web/src/lib/parser/pdf.ts` line 67 (STRICT_AMOUNT_PATTERN):
   `^[₩🏬]?-?[\d,]+원?$|^\([\d,]+\)$` -- same as server index.ts

4. `apps/web/src/lib/parser/pdf.ts` line 37 (AMOUNT_PATTERN):
   Same as server table-parser.ts

**Fix:** Require either a comma (thousand separator) or minimum 3 digits for bare integers:
- Change `[\d,]+` to `(?:[\d,]*,|\d{3,})[\d,]*` in all 4 patterns

## Finding F2: No tests for year-value rejection in PDF amount patterns [LOW]

No test file covers `findAmountCell` or `AMOUNT_PATTERN` with year-value inputs.