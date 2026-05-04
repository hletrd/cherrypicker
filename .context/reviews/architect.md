# Architect Review -- Cycle 16

## 1. Web CSV Bank Adapter Header Detection Doesn't Normalize (HIGH)

All 10 web-side bank adapters (`apps/web/src/lib/parser/csv.ts`) use exact string match for header detection:
```ts
const hasDate = cells.includes('이용일');  // samsung, line 321
```

But the server-side `createBankAdapter()` normalizes before comparison:
```ts
const normalizedCells = cells.map((c) => normalizeHeader(c));
if (normalizedCells.some((c) => headerKeywords.includes(c)))  // adapter-factory, line 89
```

This means CSV headers with extra whitespace (`"이용 금액"`), parenthetical suffixes (`"이용금액(원)"`), or zero-width spaces fail header detection on the web side but succeed on the server side. Real format diversity bug.

## 2. PDF Header Detection Lacks Multi-Category Validation (MEDIUM)

The PDF `detectHeaderRow()` only checks for ANY keyword presence. The CSV/XLSX `isValidHeaderRow()` requires keywords from 2+ distinct categories. A summary row with only amount keywords could be misidentified as a header in PDF parsing.

## 3. Summary Row Skip Patterns Missing Spaced Variants (LOW)

All parsers skip `합계|총계|소계|total|sum`. Some Korean exports use spaced variants: `총 합계`, `소 계`. Since `normalizeHeader()` handles whitespace in headers, the summary skip should too.

## 4. Architecture: Web/Server Duplication Accepted (DEFERRED)

Full dedup of web/server parsers requires shared package extraction. Currently `column-matcher.ts` and `date-utils.ts` are manually synced. Acceptable for now.
