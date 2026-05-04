# Cycle 60 Aggregate Review

## Findings (6 actionable, 0 deferred)

### F1: isAmountLike false positive on bare small numbers (BUG - Medium)
Files: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
AMOUNT_PATTERNS[2] (`₩?\d[\d,]*원?`) matches "12", "3" etc. without requiring comma or Won sign. Causes false-positive amount column detection during data inference. Fix: require comma for non-Won amounts.

### F2: PDF fallback scanner skips reversed-column-order lines (FORMAT GAP - Medium)
Files: `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts`
Fallback line scanner assumes date before amount. Lines with reversed order silently skipped. Fix: add reversed-order extraction path.

### F3: Missing "할부회차" in INSTALLMENTS_COLUMN_PATTERN (COVERAGE - Low)
File: `packages/parser/src/csv/column-matcher.ts`
Fix: add "할부회차" to pattern.

### F4: Missing date terms "조회일"/"처리일" (COVERAGE - Low)
File: `packages/parser/src/csv/column-matcher.ts`
Fix: add terms to DATE_COLUMN_PATTERN and DATE_KEYWORDS.

### F5: Web-side YYMMDD validation duplication (TECH DEBT - Low)
Files: `apps/web/src/lib/parser/csv.ts`, `apps/web/src/lib/parser/pdf.ts`, `apps/web/src/lib/parser/date-utils.ts`
Fix: export isValidYYMMDD from web date-utils.ts, import in csv.ts and pdf.ts.

### F6: Missing "참고사항" in MEMO_COLUMN_PATTERN (COVERAGE - Low)
File: `packages/parser/src/csv/column-matcher.ts`
Fix: add "참고사항" to MEMO_COLUMN_PATTERN and HEADER_KEYWORDS.

## Plan
1. Fix F1: Tighten isAmountLike pattern in server+web generic CSV + tests
2. Fix F2: Add reversed-column extraction in server+web PDF fallback scanner + tests
3. Fix F3/F4/F6: Add missing column pattern terms + tests
4. Fix F5: Export isValidYYMMDD from web date-utils, update imports + tests
5. Run all gates: bun test, vitest, typecheck, lint, build