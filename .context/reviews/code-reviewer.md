# Code Review -- Cycle 60

## Reviewer: code-reviewer
## Focus: isAmountLike false positives, PDF reversed columns, column pattern gaps, web-side parity

### C60-01: isAmountLike false positive on bare small numbers (BUG - Medium)
Files: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
The third entry in `AMOUNT_PATTERNS` (`/^₩?\d[\d,]*원?$/`) matches bare numbers like "12" or "3" without requiring a comma or Won sign prefix. During data inference when headers fail, this can cause false-positive amount column detection on columns containing installment counts, card suffixes, or other small numbers.
The comment says "requires comma or Won sign" but the regex does not enforce either -- the `₩?` makes Won optional and `[\d,]*` allows zero commas.
Fix: change pattern to require at least one comma for amounts without Won sign prefix.

### C60-02: PDF fallback scanner skips reversed-column-order lines (FORMAT GAP - Medium)
Files: `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts`
The PDF fallback line scanner assumes date appears before amount (`if (amountStart > dateEnd)`). Lines where amount precedes date are silently skipped, even though the structured parser handles both orderings via `Math.min/max(dateIdx, amountIdx)`.
Fix: add a reversed-order extraction path that checks `amountStart < dateStart` and extracts merchant between them.

### C60-03: Missing "할부회차" in INSTALLMENTS_COLUMN_PATTERN (COVERAGE - Low)
Files: `packages/parser/src/csv/column-matcher.ts`
Some bank exports use "할부회차" (installment round/number) which is not in the pattern. Existing terms include "할부횟수" and "할부회수" but not "할부회차".
Fix: add "할부회차" to the pattern.

### C60-04: Missing date terms in DATE_COLUMN_PATTERN (COVERAGE - Low)
File: `packages/parser/src/csv/column-matcher.ts`
Bank portal exports occasionally use "조회일" (inquiry date), "처리일" (processing date), or "승인완료일" (approval completion date) as date column headers.
Fix: add these terms to DATE_COLUMN_PATTERN and DATE_KEYWORDS.

### C60-05: Web-side csv.ts/pdf.ts define YYMMDD validation locally (TECH DEBT - Low)
Files: `apps/web/src/lib/parser/csv.ts`, `apps/web/src/lib/parser/pdf.ts`, `apps/web/src/lib/parser/date-utils.ts`
The web-side date-utils.ts does not export `isValidYYMMDD`. Instead, csv.ts defines its own `isYYMMDDLike` (lines 179-187) and pdf.ts defines its own `isValidYYMMDD` (lines 181-189) with identical logic. The server-side date-utils.ts already exports `isValidYYMMDD`.
Fix: add `isValidYYMMDD` export to web-side date-utils.ts, then import it in csv.ts and pdf.ts, removing local duplicates.

### C60-06: Missing "참고사항" in MEMO_COLUMN_PATTERN (COVERAGE - Low)
File: `packages/parser/src/csv/column-matcher.ts`
Some banks use "참고사항" (reference notes) as a memo column header. Not currently in the pattern.
Fix: add "참고사항" to MEMO_COLUMN_PATTERN and HEADER_KEYWORDS.