# Cycle 63 Aggregate Review

## Findings (2 actionable, 1 deferred)

### F1: Server-side STRICT_AMOUNT_PATTERN missing KRW and 마이너스 prefixes (BUG - Medium)
Files: `packages/parser/src/pdf/index.ts` (line 23)
The server-side `STRICT_AMOUNT_PATTERN` used by `findAmountCell()` for structured PDF parsing
does NOT include KRW or 마이너스 prefix matching. The web-side `pdf.ts` already has both.

The `AMOUNT_PATTERN` (table row detection) DOES have KRW support. This creates a mismatch:
rows with "KRW10,000" or "마이너스1,234" amounts are detected by `filterTransactionRows`
but `findAmountCell()` cannot extract them. The fallback line scanner handles these correctly,
so this only affects the structured parse path.

Fix: Add KRW and 마이너스 alternatives to STRICT_AMOUNT_PATTERN on server side for parity.

### F2: No tests for KRW/마이너스 amounts in PDF structured parsing (TEST COVERAGE - Low)
Files: `packages/parser/__tests__/table-parser.test.ts`
No tests verify that `getHeaderColumns()` or the structured parse path handles KRW-prefixed
or 마이너스-prefixed amounts in PDF table cells.

## Deferred
### D1: PDF multi-line header support
PDFs where header text wraps across 2+ lines remain unsupported. Low frequency, high
complexity. Deferred to future cycle.

## Plan
1. Fix F1: Add KRW and 마이너스 to STRICT_AMOUNT_PATTERN in server PDF parser
2. Fix F2: Add test for KRW/마이너스 amounts in PDF structured parsing
3. Run all gates