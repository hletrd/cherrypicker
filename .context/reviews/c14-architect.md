# Cycle 14 Architect Review

## Architecture Assessment

### Current State
Well-structured parser package with shared column-matcher, adapter factory, 3-tier PDF fallback.

### Findings

#### F-ARC-1: XLSX formula error cells produce confusing messages (Medium)
When `raw: true` is used, formula cells with Excel errors (#VALUE!, #REF!) are returned as strings. `parseDateToISO` tries to parse "#VALUE!" as a date, producing "날짜를 해석할 수 없습니다: #VALUE!" -- confusing because the real issue is a formula error. Should detect Excel error strings and produce a clearer message.

#### F-ARC-2: `extractPages` function lacks space insertion (Medium)
`extractor.ts` exports `extractPages` (line 52-76) which does NOT insert spaces between text items on the same line, unlike `extractPagesFromBuffer`. If any code path uses `extractPages`, text will merge incorrectly. Currently unused in main parse flow but exported.

#### F-ARC-3: Web PDF loses column alignment (Medium)
Web `pdf.ts` joins text items with `.join(' ')` (line 322), losing all column alignment. Server-side uses Y-coordinate for line breaks and X-position for spacing. Web PDF relies entirely on fallback line-scanner rather than structured table parsing.

#### F-ARC-4: Server/web column-matcher duplication (Low, deferred)
Still duplicated across packages/parser and apps/web. Previously acknowledged.

#### F-ARC-5: `splitCSVLine` trims field values unconditionally (Low)
In `shared.ts`, `splitCSVLine` always trims each field. This is correct for most cases but could remove intentional leading/trailing whitespace in merchant names. Acceptable for credit card data.
