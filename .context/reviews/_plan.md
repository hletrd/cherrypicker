# Implementation Plan -- Cycle 50

## P1. PDF YYMMDD date validation in filterTransactionRows [MEDIUM]

**Files:** `packages/parser/src/pdf/table-parser.ts`, `apps/web/src/lib/parser/pdf.ts`

Add a validation helper that checks date cells after filterTransactionRows:
- Import or replicate isYYMMDDLike logic
- In the server-side PDF index.ts tryStructuredParse, validate txRows date cells
- In the web-side pdf.ts tryStructuredParse, do the same
- Reject rows where the date cell is a 6-digit string that fails YYMMDD validation

**Tests:** Add test in table-parser.test.ts with YYMMDD dates ("240115") and transaction ID false positives ("123456").

## P2. PDF getHeaderColumns use findColumn [MEDIUM]

**Files:** `packages/parser/src/pdf/table-parser.ts`, `apps/web/src/lib/parser/pdf.ts`

Refactor getHeaderColumns() to use findColumn() from column-matcher.ts:
- Import findColumn in table-parser.ts
- Replace manual pattern.test() loop with findColumn() calls
- This automatically handles combined-header splitting on "/" and "|"

**Tests:** Add test for combined headers like "이용일/승인일", "비고/적요".

## P3. Summary row pattern "합 계" variant [LOW]

**File:** `packages/parser/src/csv/column-matcher.ts`

Add standalone `(?<![가-힣])합\s*계(?![가-힣])(?=[\s,;]|$)` to SUMMARY_ROW_PATTERN.

**Tests:** Add test for "합 계" detection in column-matcher.test.ts.

## Deferred

- D-01: Server/web shared module (architectural)
- D-02: PDF multi-line headers
- D-03: Web CSV factory refactor