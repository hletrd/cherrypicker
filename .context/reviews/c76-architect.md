# Cycle 76 Architect Review

## Context
After 75 cycles of intensive parser improvements, the codebase handles 24 bank CSV adapters (server+web), RFC 4180 multi-line CSV, flexible column matching with 40+ Korean/English patterns, encoding detection (UTF-16/CP949), BOM stripping, XLSX merged-cell forward-fill with summary guards, PDF header-aware column extraction with fallback scanner, and comprehensive date/amount parsing. 1076 bun + ~287 vitest tests passing.

## Findings

### 1. Date Column Pattern Gaps (Medium)
**Location**: `packages/parser/src/csv/column-matcher.ts` line 64, `apps/web/src/lib/parser/column-matcher.ts`
**Issue**: DATE_COLUMN_PATTERN is missing several date-related column names that Korean bank exports use:
- "취소일" (cancel date) — banks with separate cancellation date columns
- "정산일" (settlement date) — used by some corporate card exports
- "환불일" (refund date) — used for refund tracking columns
- "반품일" (return date) — used by some retail-focused banks
- "교환일" (exchange date) — used by some card issuers

These are uncommon but valid date column headers that would cause header-based column detection to fail, falling through to data inference.

### 2. Summary Row Pattern Missing "할부수수료" Variants (Low)
**Location**: `packages/parser/src/csv/column-matcher.ts` SUMMARY_ROW_PATTERN
**Issue**: The pattern doesn't match summary rows containing "할부수수료" (installment fee) or "연체료" (late fee) totals. While these are edge cases, they appear as footer rows in some Korean bank exports and could be misparsed as transactions.

### 3. Web-side CSV parseAmount Duplication Architecture Note (Informational)
**Location**: `apps/web/src/lib/parser/csv.ts` lines 100-150
**Issue**: The web-side CSV parser duplicates `parseAmount`, `parseInstallments`, `isValidAmount`, `splitLine`, and `splitCSVContent` from the server-side shared module. A shared module refactor (D-01) was deferred long ago. Not a correctness issue but architectural debt.

## Architecture Assessment
The parser is extremely mature after 75 cycles. Server/web parity is maintained for all critical behaviors. The remaining work is incremental: adding a few more column header keywords and summary patterns. The D-01 shared module refactor remains the primary architectural debt item.