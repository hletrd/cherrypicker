# Architect Review -- Cycle 15

## PDF Parser: Missing Header Row Detection (HIGH)

The PDF parser (`table-parser.ts` + `index.ts`) has no header row detection. It uses purely positional heuristics:
- `findDateCell()`: scan left-to-right for first date-looking cell
- `findAmountCell()`: scan right-to-left for first amount-looking cell
- Merchant: first non-empty cell between date and amount

This fails when PDFs have extra columns (category, card type, installment info) between date and merchant. The CSV and XLSX parsers both have sophisticated header detection using `isValidHeaderRow()` and `findColumn()`. The PDF parser should leverage the same shared header keyword vocabulary.

### Recommendation
Add a header-aware column detection step to the PDF structured parser. Before falling back to positional heuristics, scan the parsed table rows for a header row using the shared `HEADER_KEYWORDS` vocabulary. If a header row is found, use column positions to determine which cells are date/merchant/amount.

## Server extractor.ts Duplicated Code (MEDIUM)

`extractPages()` duplicates the exact same buffer reading and page-iteration logic as `extractText()`. Both functions:
1. Read file to buffer
2. Call `pdfParse` with identical `pagerender` callback
3. Return pages

`extractPages()` should call `extractPagesFromBuffer()` directly like `extractText()` does.

## XLSX Memo Column Forward-Fill Gap (MEDIUM)

All other optional columns (date, merchant, category, installments) have forward-fill for merged cells. The memo column uses direct `row[memoCol]` access without forward-fill. When Korean bank XLSX exports merge memo cells across installment rows, the memo value is lost for sub-rows.

## Web/Server PDF Parser Format Parity (LOW)

- Server: `tryStructuredParse` returns `RawTransaction[] | null`
- Web: `tryStructuredParse` returns `{ transactions, errors } | null`

The web version reports per-transaction parse errors; the server version silently drops them.
