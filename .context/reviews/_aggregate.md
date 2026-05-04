# Cycle 59 Aggregate Review

## Findings (4 actionable, 2 deferred)

### F1: PDF AMOUNT_PATTERN missing KRW prefix (BUG - Medium)
Files: `packages/parser/src/pdf/table-parser.ts`, `apps/web/src/lib/parser/pdf.ts`
The AMOUNT_PATTERN regex does not match KRW-prefixed amounts. PDFs using "KRW10,000" notation will fail structured parsing. Fix: add KRW group to both AMOUNT_PATTERN regexes.

### F2: PDF fallback amount pattern missing KRW group (BUG - Medium)
Files: `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts`
The fallbackAmountPattern has no KRW capture group. Lines with KRW amounts won't be captured in the fallback scanner. Fix: add `KRW([\d,]+)원?` capture group.

### F3: Duplicate YYMMDD validation across PDF files (TECH DEBT - Low)
Files: `packages/parser/src/pdf/index.ts`, `packages/parser/src/pdf/table-parser.ts`
Both define isYYMMDDLike/isValidYYMMDD with identical logic. Fix: extract to date-utils.ts, import everywhere.

### F4: Web-side CSV missing raw row text in amount errors (PARITY - Low)
File: `apps/web/src/lib/parser/csv.ts`
isValidAmount() doesn't include raw text in errors. Fix: add raw field.

### Deferred
- D-01: Web/server shared module architecture (requires build system changes)
- D-02: Web-side CSV parser duplication (10 manual adapters)
- D-03: PDF multi-line header support (complex, needs real PDF samples)

## Plan
1. Fix F1: Add KRW to AMOUNT_PATTERN in both PDF table-parser files + tests
2. Fix F2: Add KRW group to fallbackAmountPattern in both PDF index files + tests
3. Fix F3: Extract isValidYYMMDD to date-utils.ts, update imports + tests
4. Fix F4: Add raw text to web-side amount error entries