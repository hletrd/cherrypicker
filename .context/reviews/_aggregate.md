# Cycle 99 Aggregate Review

## Summary
After 98 cycles, 1389 bun + 306+ vitest tests pass. OFX/QFX and HTML table support were added in cycle 98. This cycle focuses on reliability gaps in the new parsers (HTML forward-fill, OFX credit card blocks), web-side consistency (missing isValidShortDate export), and JSON negative-amount handling.

## Findings (8)

| ID | Severity | Type | Description |
|----|----------|------|-------------|
| F1 | Medium | RELIABILITY | Web-side date-utils.ts missing isValidShortDate export |
| F2 | Medium | RELIABILITY | HTML parser missing forward-fill for merged cells |
| F3 | Medium | RELIABILITY | OFX parser missing CREDITCARDMSGSRSV1 credit card block support |
| F4 | High | ARCHITECTURE | Web-side PDF parser duplicates ~400 lines from server table-parser.ts |
| F5 | Medium | ARCHITECTURE | Web-side column-matcher.ts is 100% copy of server-side |
| F6 | Medium | ARCHITECTURE | Web-side detect.ts is 100% copy of server-side |
| F7 | Low | RELIABILITY | JSON parser silently drops negative amounts without abs() |
| F8 | Medium | RELIABILITY | Web-side PDF parser defines local isValidShortDate instead of importing |

## Deferred Items
- D-01: Full server/web dedup into packages/shared/ (requires build system changes)
- D-02: Confidence scoring on ParseResult (significant feature, deferred from cycle 98)
- D-03: Clipboard paste format (UI dependency)