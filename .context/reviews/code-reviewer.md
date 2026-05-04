# Code Review -- Cycle 59

## Reviewer: code-reviewer
## Focus: KRW format gap, YYMMDD dedup, PDF pattern completeness

### C59-01: PDF AMOUNT_PATTERN missing KRW prefix (BUG - Medium)
Files: `packages/parser/src/pdf/table-parser.ts`, `apps/web/src/lib/parser/pdf.ts`

The `AMOUNT_PATTERN` regex used by `filterTransactionRows()` does NOT match amounts with the KRW ISO 4217 prefix (e.g., "KRW10,000"). The pattern covers ₩, ￦, 마이너스, comma/5+digit, fullwidth-minus, and parenthesized — but NOT KRW. Both server-side and web-side have this gap.

Impact: PDFs using KRW prefix notation will not have their transaction rows detected by the structured parser. They will fall through to the less-accurate fallback line scanner.

Note: `parseAmount()` itself correctly strips KRW prefix, so the issue is purely in the detection pattern.

### C59-02: PDF fallback amount pattern missing KRW group (BUG - Medium)
Files: `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts`

The `fallbackAmountPattern` regex (Tier 2.5 line scanner) has 5 capture groups but none for KRW-prefixed amounts. Lines like "2024-01-15 Starbucks KRW10,000" will not be correctly captured — the "10,000" part might match group 5 if the regex engine finds it, but the KRW prefix disrupts clean capture.

### C59-03: Duplicate isYYMMDDLike across PDF files (TECH DEBT - Low)
Files: `packages/parser/src/pdf/index.ts` (line 35-43), `packages/parser/src/pdf/table-parser.ts` (line 160-168)

Both files define nearly identical YYMMDD validation functions. Should be extracted to `date-utils.ts` alongside `daysInMonth` and `isValidDayForMonth`.

### C59-04: Web-side CSV missing raw row text in amount errors (PARITY - Low)
File: `apps/web/src/lib/parser/csv.ts`

The web-side `isValidAmount()` does not include `raw` row text in error entries, unlike the server-side `isValidCSVAmount()` which enriches errors for debugging.