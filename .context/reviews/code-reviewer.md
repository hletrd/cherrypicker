# Code Review -- Cycle 16

## Finding 1: Web CSV Bank Adapters Skip normalizeHeader on Header Detection (HIGH)

In `apps/web/src/lib/parser/csv.ts`, all 10 bank adapters check for header rows using exact `cells.includes()`:
- samsung (line 321): `cells.includes('이용일')` + `cells.includes('가맹점명')`
- shinhan (line 388): `cells.includes('이용일')` + `cells.includes('이용처')`
- kb (line 454): `cells.some((c) => KB_HEADERS.includes(c))`
- hyundai (line 519): `cells.some((c) => HYUNDAI_HEADERS.includes(c))`
- lotte (line 583): `cells.includes('거래일')` + `cells.includes('이용가맹점')`
- hana (line 650): `cells.includes('이용일자')` + `cells.includes('가맹점명')`
- woori (line 715): `cells.some((c) => WOORI_HEADERS.includes(c))`
- nh (line 780): `cells.includes('거래일')` + `cells.includes('이용처')` + `cells.includes('거래금액')`
- ibk (line 846): `cells.some((c) => IBK_HEADERS.includes(c))`
- bc (line 910): `cells.includes('이용일')` + `cells.includes('가맹점')` + `cells.includes('이용금액')`

These should all normalize before comparison, matching the server-side adapter-factory pattern.

## Finding 2: PDF detectHeaderRow Only Uses Single-Category Check (MEDIUM)

`packages/parser/src/pdf/table-parser.ts` `detectHeaderRow()` (line 176-182) and the web-side copy (line 193-200):
```ts
const hasKeyword = normalized.some((c) => (HEADER_KEYWORDS as string[]).includes(c));
if (hasKeyword) return i;
```

Should use `isValidHeaderRow()` from column-matcher to require 2+ category keywords, matching CSV/XLSX parsers.

## Finding 3: Summary Row Skip Missing Whitespace Tolerant Patterns (LOW)

All parsers use `합계|총계|소계|total|sum`. Some Korean exports have spaced variants. Should add `\s` tolerance in the regex or use normalizeHeader-like approach for summary detection.

## Finding 4: Server CSV Adapter-Factory headerKeywords Array Not Normalized (LOW)

`packages/parser/src/csv/adapter-factory.ts` line 89-90: The comparison `normalizedCells.some((c) => headerKeywords.includes(c))` works because the bank config headerKeywords are pre-cleaned. But the `headerKeywords` themselves are never normalized through `normalizeHeader()`. If a bank config ever adds a spaced keyword, it would silently fail. Defensive normalization of both sides would be more robust.
