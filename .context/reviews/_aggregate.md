# Cycle 62 Aggregate Review

## Findings (2 actionable, 1 deferred)

### F1: PDF STRICT_AMOUNT_PATTERN missing KRW prefix (BUG - Medium)
Files: `packages/parser/src/pdf/index.ts` (line 23), `apps/web/src/lib/parser/pdf.ts` (line 72)
The `STRICT_AMOUNT_PATTERN` used by `findAmountCell()` for structured PDF parsing does NOT
include KRW prefix matching. The `AMOUNT_PATTERN` (used for table row detection) DOES have
KRW support via `(?<![a-zA-Z\d])KRW[\d,]+원?(?![a-zA-Z\d])`.

This means: table row detection finds rows with "KRW10,000" amounts, but `findAmountCell()`
cannot extract the KRW amount from the row, causing the structured parser to skip those rows.
The fallback line scanner handles KRW correctly, so the inconsistency only affects the
structured parse path.

Fix: Add KRW prefix alternative to STRICT_AMOUNT_PATTERN on both server and web sides.

### F2: Test gap for KRW amounts in PDF STRICT_AMOUNT_PATTERN (TEST COVERAGE - Low)
Files: `packages/parser/__tests__/table-parser.test.ts`
No tests verify that `getHeaderColumns` or the structured parse path handles KRW-prefixed
amounts in PDF table cells. Existing KRW tests (C59-01/C59-02) only cover the AMOUNT_PATTERN
(detection) and fallback pattern, not the STRICT_AMOUNT_PATTERN (structured extraction).

## Deferred
### D1: PDF multi-line header support
PDFs where header text wraps across 2+ lines remain unsupported. Low frequency, high
complexity. Deferred to future cycle.

## Plan
1. Fix F1: Add KRW prefix to STRICT_AMOUNT_PATTERN in server+web PDF parsers
2. Fix F2: Add test for KRW amounts in PDF structured parsing
3. Run all gates