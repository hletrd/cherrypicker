# Cycle 74 Code Review

## F1: Server-side PDF table parser `isValidDateCell` missing short-date validation [MEDIUM - PARITY]

**File**: `packages/parser/src/pdf/table-parser.ts`

The `isValidDateCell` function validates date cells by testing against the module-level `DATE_PATTERN` regex. This regex has a short-date alternative `(?<![.\d．。])\d{1,2}[.\-\/．。]\d{1,2}(?![.\-\/\d．.])` that uses lookahead but no end-anchor `$`. While the lookahead prevents matching when followed by digits, it does NOT prevent matching when followed by non-digit, non-delimiter characters (e.g., trailing spaces, letters).

More importantly, `isValidDateCell` does NOT validate the month/day values of short dates. A cell like "13.01" would pass `DATE_PATTERN.test()` even though month 13 is invalid. The function should use `isValidShortDate` (already defined in the same file) which validates month 1-12 and day 1-daysInMonth.

**Comparison with web-side**: The web-side `apps/web/src/lib/parser/pdf.ts` `isValidDateCell` already uses `SHORT_MD_DATE_PATTERN` (`/^\d{1,2}[.\-\/．。]\d{1,2}$/` -- end-anchored) which correctly validates short dates. The server-side should use the same approach via `isValidShortDate`.

**Fix**: Modify `isValidDateCell` to use `isValidShortDate` for short date cells instead of raw `DATE_PATTERN.test`.

## F2: Server/web parity check [PASSIVE - NO ISSUES]

Verified full parity:
- Server and web `column-matcher.ts`: identical patterns, keywords, category sets
- XLSX adapter configs: identical for all 24 banks
- All 24 bank CSV adapters: present on both sides
- Amount parsing: all formats (full-width, KRW, Won signs, 마이너스, trailing minus, parenthesized) handled consistently
- Summary row pattern: identical
- Header detection: identical

## F3: PDF multi-line headers [DEFERRED - unchanged]
Architecturally complex, not actionable this cycle.

## Summary
- **Actionable**: F1 (fix isValidDateCell in server-side PDF table parser)
- **Deferred**: F3 (multi-line PDF headers)
- **Test baseline**: 1064 tests passing (bun), 0 failures
- **Server/web parity**: Excellent