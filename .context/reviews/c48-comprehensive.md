# Cycle 48 Deep Code Review

## Review Scope
Comprehensive review of all parser source files (server + web) after 47 cycles of improvements.

## Findings

### F1. Web-side SUMMARY_ROW_PATTERN missing `합산` term (SERVER/WEB PARITY BUG)
**Severity: Medium** | File: `apps/web/src/lib/parser/column-matcher.ts`

Server-side `SUMMARY_ROW_PATTERN` (packages/parser/src/csv/column-matcher.ts line 83) includes:
```
(?<![가-힣])합\s*산(?![가-힣])
```

Web-side `SUMMARY_ROW_PATTERN` (apps/web/src/lib/parser/column-matcher.ts line 71) is MISSING this term.

Impact: Korean bank exports that use "합산" as a summary row label (meaning "subtotal/aggregate") will be parsed as valid transactions on the web side, causing inflated spending totals.

### F2. Web-side XLSX forward-fill missing SUMMARY_ROW_PATTERN guard (BUG)
**Severity: Medium** | File: `apps/web/src/lib/parser/xlsx.ts`

Server-side XLSX parser (`packages/parser/src/xlsx/index.ts` lines 300-304) guards forward-fill with:
```ts
const dateStr = String(rawDateValue);
if (!SUMMARY_ROW_PATTERN.test(dateStr)) {
  lastDate = rawDateValue;
}
```

Web-side XLSX parser (`apps/web/src/lib/parser/xlsx.ts` lines 479-482) does NOT have this guard:
```ts
const rawDateValue = dateCol !== -1 ? row[dateCol] : '';
if (dateCol !== -1 && rawDateValue !== '' && rawDateValue != null) {
  lastDate = rawDateValue;  // NO summary row check!
}
```

Same issue for merchant forward-fill (lines 485-489). Server-side checks `SUMMARY_ROW_PATTERN.test(merchantStr)`, web-side does not.

Impact: If a summary row has a value in the date or merchant column, it will be forward-filled into subsequent data rows, contaminating transaction data.

### F3. Web-side detectFormatFromFile missing `.tsv` extension (FORMAT DIVERSITY)
**Severity: Low** | File: `apps/web/src/lib/parser/detect.ts`

Server-side `detectFormat()` (`packages/parser/src/detect.ts` line 241) handles `.tsv`:
```ts
if (ext === '.csv' || ext === '.tsv') { format = 'csv'; }
```

Web-side `detectFormatFromFile()` (`apps/web/src/lib/parser/detect.ts` lines 107-112) does NOT:
```ts
export function detectFormatFromFile(file: File): 'csv' | 'xlsx' | 'pdf' {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'pdf') return 'pdf';
  return 'csv'; // default
}
```

TSV files with `.tsv` extension WILL still work because the default is 'csv', but the comment is misleading and the code doesn't explicitly declare TSV support.

### F4. No test coverage for `합산` in SUMMARY_ROW_PATTERN
**Severity: Low** | File: `packages/parser/__tests__/column-matcher.test.ts`

The `합산` term has no test cases. A bank export containing "합산" as a summary row label would need to be verified as properly filtered.

### F5. Server-side CSV amount parser: no tests for negative Won-sign amounts
**Severity: Low** | File: `packages/parser/__tests__/csv-shared.test.ts`

Amounts like "-₩1,234" or "₩-1,234" have no test coverage for the server-side `parseCSVAmount`. While the regex strips the Won sign after trimming, the behavior with leading negative + Won sign combination should be verified.

### F6. Architecture: server/web code duplication remains
**Severity: Deferred (D-01)** | All files

The server and web sides maintain separate copies of:
- column-matcher.ts (patterns, normalizeHeader, findColumn, isValidHeaderRow)
- date-utils.ts (parseDateStringToISO, inferYear, daysInMonth)
- CSV line splitter (splitCSVLine / splitLine)
- Amount parsers (parseCSVAmount / parseAmount)
- Bank adapter factory logic
- PDF table parser (full duplication)

This is a known architectural debt item (D-01) deferred from previous cycles.

## Summary
After 47 cycles of improvements, the parser handles 24 banks across CSV/XLSX/PDF with extensive format diversity. Remaining issues are primarily web/server parity bugs (summary row pattern sync, forward-fill guard sync) and minor format gaps (TSV detection). The architecture's code duplication is the largest remaining debt item.

## Verdict: 3 actionable bugs, 2 test gaps, 1 deferred architecture item.