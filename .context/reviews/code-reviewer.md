# Code Review — Cycle 13

## Focus: Format diversity edge cases, CSV quoting, PDF text extraction, parity

**Test Baseline**: 435 bun + 231 vitest = 666 tests passing

---

## Finding 1 (MEDIUM): CSV splitCSVLine ignores quoted fields for non-comma delimiters

**File**: `packages/parser/src/csv/shared.ts` line 10
**File**: `apps/web/src/lib/parser/csv.ts` line 20

When delimiter is not `,`, the function uses `line.split(delimiter).map(v => v.trim())`. This fails if a field contains the delimiter character inside quotes (e.g., a merchant name containing a literal tab or pipe in a tab/pipe-delimited export). Some Korean bank exports use tab delimiters with quoted fields containing special characters.

**Impact**: Transaction data corruption for tab/pipe/semicolon delimited files with quoted fields. Merchant names or memos containing the delimiter character would be split incorrectly, producing wrong column alignment.

**Fix**: Apply RFC 4180 parsing logic for all delimiters, not just commas.

---

## Finding 2 (LOW-MEDIUM): PDF extractor joins text items without space

**File**: `packages/parser/src/pdf/extractor.ts` line 22

`text += item.str` concatenates adjacent text items without any separator. When pdfjs-dist produces separate items for adjacent text spans (e.g., date cell and merchant name), they merge into one token like `"2024-01-15카드결제"`. The structured table parser handles this via column-boundary detection, but the fallback line scanner in `index.ts` tries to find a date pattern and an amount pattern in the same line, and the merged text could cause the date to consume part of the merchant text.

**Impact**: Low for structured parsing (column boundaries handle it), but can cause missed transactions in the fallback scanner when items on the same line merge without whitespace.

**Fix**: Add a space between items when the horizontal gap suggests they are separate text elements.

---

## Finding 3 (LOW): normalizeHeader missing fullwidth space (U+3000)

**File**: `packages/parser/src/csv/column-matcher.ts` line 12
**File**: `apps/web/src/lib/parser/column-matcher.ts` line 16

`normalizeHeader` strips zero-width Unicode characters but does not strip fullwidth spaces (U+3000), which are common in East Asian text processing and could appear in user-reformatted CSV exports.

**Impact**: Very low — fullwidth spaces are rare in Korean credit card exports. But if present, they would cause header detection to fail.

**Fix**: Add U+3000 to the stripping pattern.

---

## Finding 4 (NONE): XLSX error cells

SheetJS returns error values as strings (`#REF!`, `#VALUE!`). Current code handles these correctly: `parseAmount` returns null for strings it can't parse, `parseDateStringToISO` returns the raw string which is then flagged as an error. No action needed.

## Finding 5 (NONE): PDF multi-line headers

PDF table parsing uses positional column detection (date found by pattern, amount found by scanning from right), not header-based column matching. Multi-line headers in PDFs are automatically excluded by `filterTransactionRows` because header rows don't contain date/amount patterns. The deferred "PDF multi-line header support" item is not actually a bug.

## Finding 6 (DEFERRED): Web CSV inline adapters

Web-side bank adapters duplicate detection logic instead of using shared `detectBank()`. This is architectural tech debt (D-01) requiring a shared module refactor between Bun and browser environments. Behavioral parity is maintained through identical patterns.

---

## Parity Check
| Component | Server | Web | Status |
|-----------|--------|-----|--------|
| ColumnMatcher patterns | column-matcher.ts | column-matcher.ts | Synced |
| Date parsing | date-utils.ts | date-utils.ts | Synced |
| Amount parsing | shared.ts / xlsx/index.ts | csv.ts / xlsx.ts | Synced |
| XLSX forward-fill | xlsx/index.ts | xlsx.ts | Synced |
| PDF table-parser | pdf/table-parser.ts | pdf.ts (inline) | Synced |
| Bank detection | detect.ts | detect.ts | Synced |
| CSV splitCSVLine | shared.ts | csv.ts | **Desync: F1** |

## Verdict
Three actionable findings (F1, F2, F3). F1 is the highest priority as it affects data correctness for tab-delimited CSV files with quoted fields.