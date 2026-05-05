# Cycle 99 Code Review — Parser Package

## Findings

### F1. Web-side isValidShortDate not exported from date-utils.ts [Medium]
**File**: `apps/web/src/lib/parser/date-utils.ts`
The web-side `date-utils.ts` exports `isValidYYMMDD` and `isValidYYYYMMDD` but does NOT export `isValidShortDate`. The web-side PDF parser (`apps/web/src/lib/parser/pdf.ts`) defines its own local `isValidShortDate` (lines 57-80) which duplicates the server-side implementation in `packages/parser/src/date-utils.ts`. This means:
1. If the short-date validation logic needs updating, it must be updated in TWO places on the web side
2. The web-side date-utils.ts is already the canonical web-side date utility but is missing this function

### F2. HTML parser missing forward-fill for merged cells [Medium]
**File**: `packages/parser/src/html/index.ts`
The HTML parser does NOT implement forward-fill for merged cells. The XLSX parser (`xlsx/index.ts`) has extensive forward-fill logic (lines 308-391) for all columns (date, merchant, category, installments, memo, amount). HTML tables exported from bank websites commonly have merged cells, but the HTML parser just reads raw cell values. This means transactions with merged date/merchant cells would produce empty values and be skipped.

### F3. OFX parser missing CREDITCARDMSGSRSV1 support [Medium]
**File**: `packages/parser/src/ofx/index.ts`
The SGML extraction pattern (line 38) terminates at `</BANKTRANLIST`, `</STMTRS`, or `</CREDITCARDMSGSRSV1`. However, the XML extraction (line 30) only matches `<STMTTRN>...</STMTTRN>` blocks. Credit card OFX files commonly wrap transactions in:
```
<CREDITCARDMSGSRSV1>
  <CCSTMTTRNRS>
    <CCSTMTRS>
      <BANKTRANLIST>
        <STMTTRN>...</STMTTRN>
```
The XML pattern would work for these, but the SGML pattern's `</STMTRS` terminator would cut off credit card transactions early. Also, there's no handling of `CCSTMTTRNRS` wrapper elements.

### F4. Web-side PDF parser has massive code duplication [High]
**File**: `apps/web/src/lib/parser/pdf.ts`
The web-side PDF parser duplicates ~400 lines from the server-side:
- `detectColumnBoundaries()` (lines 91-126) = server `table-parser.ts` (lines 41-80)
- `splitByColumns()` (line 128-129) = server `table-parser.ts` (lines 85-87)
- `parseTable()` (lines 132-188) = server `table-parser.ts` (lines 93-153)
- `filterTransactionRows()` (lines 211-217) = server `table-parser.ts` (lines 194-200)
- `detectHeaderRow()` (lines 239-244) = server `table-parser.ts` (lines 227-234)
- `getHeaderColumns()` (lines 252-262) = server `table-parser.ts` (lines 243-257)
- `findDateCell()`, `findAmountCell()`, `tryStructuredParse()` = server `pdf/index.ts`
- `isValidShortDate()` (lines 57-80) = server `date-utils.ts` (lines 201-221)

The server-side `table-parser.ts` is pure TypeScript with no Node.js dependencies. It could be imported directly by the web-side if the build pipeline supports it. Alternatively, the shared logic should live in `packages/parser` and be re-exported.

### F5. Web-side column-matcher.ts full duplication [Medium]
**File**: `apps/web/src/lib/parser/column-matcher.ts`
This is a complete copy of `packages/parser/src/csv/column-matcher.ts`. All regex patterns, keyword sets, and functions are identical. The file's own header comment acknowledges this: "This file is maintained separately from the server-side copy because the web app cannot import from packages/parser."

### F6. Web-side detect.ts full duplication [Medium]
**File**: `apps/web/src/lib/parser/detect.ts`
The `BANK_SIGNATURES` array, `detectBank()`, and `detectCSVDelimiter()` are exact copies of `packages/parser/src/detect.ts`.

### F7. JSON parser silently drops negative-amount transactions [Low]
**File**: `packages/parser/src/json/index.ts`, line 105
`if (amount === null || amount <= 0) return null;` — Filters out negative amounts silently without error reporting. Negative amounts in JSON exports likely represent refunds or credits. The OFX parser correctly handles negatives by taking abs(). The CSV/XLSX parsers skip zero but don't filter negative.

### F8. Web-side date-utils.ts missing isValidShortDate [Medium]
**File**: `apps/web/src/lib/parser/date-utils.ts`
While the web-side has `isValidYYMMDD` and `isValidYYYYMMDD`, it's missing the `isValidShortDate` export. The server-side `packages/parser/src/date-utils.ts` has this at lines 201-221. Without this export, the web-side PDF parser must maintain its own copy.

## Summary
After 98 cycles the parser is robust with 1389 tests passing. The remaining issues are:
1. **Architecture**: Major code duplication between server and web (~600+ lines duplicated)
2. **Reliability**: HTML parser missing forward-fill, OFX missing credit card blocks
3. **Consistency**: Web-side date-utils missing isValidShortDate export