# Code Review -- Cycle 19

## Focus: Remaining format diversity, parity, test coverage gaps

### Finding 1: PDF parsers missing category/memo column extraction (MEDIUM)

Both server (`packages/parser/src/pdf/table-parser.ts:193-214`) and web (`apps/web/src/lib/parser/pdf.ts:208-225`) PDF `getHeaderColumns()` only detect date, merchant, amount, and installments columns. Category and memo columns are NOT extracted from PDF headers, even though `CATEGORY_COLUMN_PATTERN` and `MEMO_COLUMN_PATTERN` exist in column-matcher.ts and are imported by the server PDF table-parser.

The `PDFColumnLayout` interface only has 4 fields. When PDFs contain category (업종) or memo (비고/적요) columns, those values are silently dropped.

**Fix:** Add `categoryCol` and `memoCol` to `PDFColumnLayout` and `getHeaderColumns()`. Add category/memo extraction in `tryStructuredParse()`.

### Finding 2: CSV generic parser uses manual regex loop instead of findColumn() (LOW)

Server generic CSV (`packages/parser/src/csv/generic.ts:95-103`) and web generic CSV (`apps/web/src/lib/parser/csv.ts:198-212`) manually iterate headers and test patterns with `if (PATTERN.test(h))`. The bank-specific adapters all use `findColumn(headers, exactName, pattern)`. While functionally equivalent (generic has no exactName), using `findColumn()` would make the code more consistent.

**Fix:** Use `findColumn(headers, undefined, PATTERN)` in generic parsers for consistency.

### Finding 3: XLSX forward-fill code is heavily duplicated between server and web (LOW)

Server XLSX (`packages/parser/src/xlsx/index.ts:269-333`) and web XLSX (`apps/web/src/lib/parser/xlsx.ts:448-509`) have nearly identical forward-fill logic for 5 columns (date, merchant, category, installments, memo). Each column has ~8 lines of identical forward-fill pattern. This is 40+ lines of pure duplication per side.

**Deferred:** Requires shared module between Bun and browser builds (D-01).

### Finding 4: Server PDF tryStructuredParse has stricter error handling than web (LOW)

Server PDF (`packages/parser/src/pdf/index.ts:218-228`) re-throws unexpected error types (non-SyntaxError/TypeError/RangeError), while web PDF (`apps/web/src/lib/parser/pdf.ts:413-417`) catches all errors and returns null. This means the server may crash on unexpected errors while the web gracefully degrades.

**Fix:** Align server PDF error handling to match web -- catch all errors in tryStructuredParse.

### Finding 5: Summary row pattern duplicated 6 times across parsers (LOW)

The regex `/총\s*합계|합\s*계|총\s*계|소\s*계|합계|총계|소계|누계|잔액|이월|소비|당월|명세|total|sum/i` is duplicated in:
- Server CSV adapter-factory.ts (line 118)
- Server CSV generic.ts (line 153)
- Server XLSX index.ts (line 285)
- Server PDF index.ts (line 106)
- Web CSV csv.ts (line 259)
- Web XLSX xlsx.ts (line 465)
- Web PDF pdf.ts (line 305)

**Fix:** Extract to a shared constant in column-matcher.ts (server) and column-matcher.ts (web).