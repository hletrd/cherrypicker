# Cycle 33 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 33
**Tests:** 851 bun, 243 vitest (1094 total)

## Summary
6 actionable findings: Server-side PDF AMOUNT_PATTERN rejects Won-sign-prefixed small amounts, server PDF fallback regex missing Won-sign support, web-side parseAmount missing "마이너스" prefix, findColumn fails on combined column headers, web PDF local patterns duplicate column-matcher, and test coverage gaps.

## Findings

### F-01: Server-side PDF AMOUNT_PATTERN rejects Won-sign-prefixed small amounts (HIGH)
`packages/parser/src/pdf/index.ts` and `table-parser.ts`: The STRICT pattern requires comma or 5+ digits. "₩500" (3 digits, no comma) fails to match. Web-side pattern handles this correctly with separate Won-sign alternations.

### F-02: Server-side PDF fallback regex missing Won-sign amount support (MEDIUM)
`packages/parser/src/pdf/index.ts` fallbackAmountPattern: Missing Won-sign alternations that the web-side version has.

### F-03: Web-side parseAmount missing "마이너스" prefix handling (MEDIUM)
Web-side `parseAmount` in csv.ts, xlsx.ts, and pdf.ts does not handle "마이너스" prefix. Server-side `parseCSVAmount` in shared.ts handles it correctly.

### F-04: findColumn fails on combined/delimited column headers (MEDIUM)
`column-matcher.ts` findColumn: Combined headers like "이용일/승인일" or "이용금액-원" don't match because normalizeHeader preserves "/" and "-".

### F-05: Web-side PDF local amount patterns duplicate column-matcher (LOW)
`apps/web/src/lib/parser/pdf.ts` defines local AMOUNT_PATTERN and STRICT_AMOUNT_PATTERN instead of importing from column-matcher.

### F-06: Test coverage gaps for Won-sign PDF amounts, 마이너스 web-side, combined headers (MEDIUM)
Missing tests for all three newly-found format diversity issues.

## Deferred Items
| ID | Item | Reason |
|----|------|--------|
| D-01 | Web CSV factory refactor | Requires shared module architecture |

## Regressions
None. All 1094 tests passing.