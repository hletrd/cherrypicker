# Cycle 34 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 34
**Tests:** 851 bun, 243 vitest (1094 total)

## Summary
5 actionable findings focused on server/web parity for Won-sign amount handling and 마이너스 prefix support across PDF and XLSX parsers. All findings are straightforward regex additions and prefix handling insertions.

## Findings

### F-01: Server-side PDF AMOUNT_PATTERN missing ╋ alternation (MEDIUM)
`packages/parser/src/pdf/index.ts`: AMOUNT_PATTERN has ╋ but not ╋. Small fullwidth Won-sign amounts fail. Web-side and table-parser.ts already fixed.

### F-02: Server+Web PDF fallbackAmountPattern missing Won-sign (MEDIUM)
Both `packages/parser/src/pdf/index.ts` and `apps/web/src/lib/parser/pdf.ts` fallback regexes lack Won-sign alternations.

### F-03: Server XLSX parseAmount missing "마이너스" prefix (MEDIUM)
`packages/parser/src/xlsx/index.ts` parseAmount: handles parenthesized negatives but not "마이너스" prefix. CSV shared and web parsers handle it.

### F-04: Web PDF parseAmount missing "마이너스" prefix (MEDIUM)
`apps/web/src/lib/parser/pdf.ts` parseAmount: missing "마이너스" prefix that web CSV/XLSX parsers handle.

### F-05: Test coverage gaps (MEDIUM)
Missing tests for Won-sign PDF amounts, 마이너스 server XLSX, 마이너스 web PDF.

## Deferred Items
| ID | Item | Reason |
|----|------|--------|
| D-01 | Web CSV factory refactor | Requires shared module architecture |

## Regressions
None expected. All changes are additive.