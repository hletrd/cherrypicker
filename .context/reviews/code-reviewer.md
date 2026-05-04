# Cycle 63 Review — code-reviewer

## F1: Server-side STRICT_AMOUNT_PATTERN missing KRW and 마이너스 prefixes (BUG - Medium)
File: `packages/parser/src/pdf/index.ts` (line 23)

The server-side `AMOUNT_PATTERN` (used by `filterTransactionRows` for detection) correctly includes KRW:
```
|(?<![a-zA-Z\d])KRW[\d,]+원?(?![a-zA-Z\d])
```

But `STRICT_AMOUNT_PATTERN` (used by `findAmountCell` for structured extraction) does NOT include KRW:
```
const STRICT_AMOUNT_PATTERN = /^[₩￦]?[－-]?(?:[\d,]*,|\d{5,})[\d,]*원?$|^\([\d,]+\)$/i;
```

This creates a mismatch: table row detection finds rows with "KRW10,000" amounts, but `findAmountCell()` cannot extract the KRW amount from those rows. The fallback line scanner handles KRW via `fallbackAmountPattern` which includes `|KRW([\d,]+)원?`, so this only affects the structured parse path.

The web-side `pdf.ts` already has both KRW and 마이너스:
```
const STRICT_AMOUNT_PATTERN = /^마이너스[\d,]+원?$|^KRW[\d,]+원?$|^[₩￦]?[－-]?(?:[\d,]*,|\d{5,})[\d,]*원?$|^\([\d,]+\)$/i;
```

**Server/web parity violation.**

## F2: No tests for KRW amounts in PDF structured parsing (TEST - Low)
File: `packages/parser/__tests__/table-parser.test.ts`

No tests verify that `getHeaderColumns()` or the structured parse path handles KRW-prefixed amounts in PDF table cells.
