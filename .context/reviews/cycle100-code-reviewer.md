# Cycle 100 — Code Review

## CRITICAL: Web-side HTML parser missing forward-fill

**Severity: HIGH** | File: `apps/web/src/lib/parser/html.ts`

The server-side HTML parser (`packages/parser/src/html/index.ts`) implements forward-fill for ALL columns (date, merchant, category, installments, memo, amount) to handle merged cells in Korean bank HTML exports. The web-side HTML parser has **NO forward-fill at all** — empty cells are read directly from the row array.

**Impact**: Korean bank HTML exports with merged cells (common for installment rows) will lose transaction data in the web app. Every merged cell produces empty values that get skipped.

**Fix**: Port the forward-fill pattern from the server-side HTML parser to the web-side.

## HIGH: Web-side JSON parser rejects negative amounts (refund asymmetry)

**Severity: HIGH** | File: `apps/web/src/lib/parser/json.ts`

Server-side JSON parser (line 112-115):
```ts
if (amount === 0) return null;
const absAmount = Math.abs(amount);  // accepts negative, stores positive
```

Web-side JSON parser (line 90):
```ts
if (amount === null || amount <= 0) {  // REJECTS negative amounts
```

The server-side correctly accepts negative JSON amounts (refunds from APIs) and stores the absolute value. The web-side silently drops them. This means the same JSON file parsed server-side vs web-side produces different results.

## HIGH: Web-side OFX parser missing CCSTMTRS terminator

**Severity: MEDIUM-HIGH** | File: `apps/web/src/lib/parser/ofx.ts`

Server-side SGML pattern includes `</CCSTMTRS` and `</CREDITCARDMSGSRSV1` as terminators (line 45). Web-side SGML pattern (line 18) only has `</BANKTRANLIST` and `</STMTRS` — missing the credit card statement terminators.

**Impact**: Credit card OFX files (which use `<CCSTMTRS>`) parsed on the web side will fail to extract the last transaction in the file (the SGML regex runs to end-of-string instead of stopping at the proper boundary, potentially merging trailing content).

## MEDIUM: Web-side HTML parser missing `parseAmountString` import

**Severity: MEDIUM** | File: `apps/web/src/lib/parser/html.ts`

The web-side HTML parser imports `parseCSVAmount` from `./csv.ts`. However, the server-side HTML parser uses `parseAmountString` from `../csv/shared.js`. Both are functionally equivalent, but this means if `parseAmountString` gains new capabilities, the web HTML parser won't benefit.

## MEDIUM: Web-side format detection lacks content sniffing

**Severity: MEDIUM** | File: `apps/web/src/lib/parser/detect.ts`

The server-side `detectFormat()` has sophisticated content sniffing for unknown extensions (PDF magic bytes, ZIP/XLSX magic, OFX headers, HTML content, JSON structure). The web-side `detectFormatFromFile()` only checks file extensions — files with mismatched extensions (e.g., a CSV file renamed to .txt) will always default to CSV.

**Note**: Browser-side content sniffing is limited (no Buffer access without FileReader), but we could at least sniff the first few KB via FileReader for better detection.

## LOW: Duplicate normalizeHTML in HTML and XLSX parsers

**Severity: LOW** | Files: `packages/parser/src/html/index.ts`, `packages/parser/src/xlsx/index.ts`

Both the HTML parser and XLSX parser define their own `normalizeHTML()` function with identical implementations. Should be shared.