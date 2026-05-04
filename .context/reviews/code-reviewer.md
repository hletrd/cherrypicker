# Code Review -- Cycle 15

## Finding 1: PDF Header Row Detection Missing (HIGH)

The PDF structured parser (`packages/parser/src/pdf/index.ts` tryStructuredParse) uses only positional heuristics to identify columns. It should detect header rows using the shared HEADER_KEYWORDS from column-matcher.ts before falling back to positional logic.

Current flow:
1. parseTable(text) -> 2D cell array
2. filterTransactionRows -> rows with date + amount cells
3. findDateCell (left-to-right), findAmountCell (right-to-left)
4. Merchant = first non-empty between date and amount

Improved flow should be:
1. parseTable(text) -> 2D cell array
2. Detect header row using HEADER_KEYWORDS + findColumn
3. If header found, use column positions directly
4. If not found, fall back to existing positional heuristics

## Finding 2: Server extractor.ts Code Duplication (MEDIUM)

`extractPages()` duplicates the buffer reading + pdfParse + pagerender logic from `extractText()`. Should reuse `extractPagesFromBuffer()`.

## Finding 3: XLSX Memo Column Forward-Fill (MEDIUM)

Server and web XLSX parsers: memo column uses `row[memoCol]` directly without forward-fill. Other columns (date, merchant, category, installments) all have forward-fill for merged cells.

## Finding 4: CSV adapter-factory headerKeyword check doesn't normalize (LOW)

`adapter-factory.ts` line 86: `cells.some((c) => headerKeywords.includes(c.trim()))` -- uses raw trim but not `normalizeHeader()`. If header cells contain zero-width spaces or parenthetical suffixes, they won't match the keyword list. The XLSX parser correctly uses `isValidHeaderRow()` which normalizes.

## Finding 5: PDF table-parser header-aware parsing (MEDIUM)

The `parseTable()` function should identify header rows (containing known header keywords) and use them for column boundary anchoring. Currently it only uses date/amount pattern detection to find table lines.
