# Implementation Plan -- Cycle 16

## P1: Web CSV Bank Adapter Normalized Header Detection (HIGH)
**File:** `apps/web/src/lib/parser/csv.ts`

All 10 web-side bank adapters need normalized header detection. The most impactful fix: change header scan loops to normalize cells before comparing.

### Strategy
For each bank adapter, change the header detection from exact `cells.includes()` to normalize cells first. Specifically:
- For adapters using `cells.includes('X')` exact matches, wrap cells with `normalizeHeader()` before the includes check
- For adapters using `cells.some((c) => ARRAY.includes(c))`, normalize cells first and also normalize the keyword array entries

### Affected adapters (10 total):
1. samsung (line ~320)
2. shinhan (line ~386)
3. kb (line ~452)
4. hyundai (line ~518)
5. lotte (line ~582)
6. hana (line ~649)
7. woori (line ~714)
8. nh (line ~779)
9. ibk (line ~845)
10. bc (line ~909)

## P2: PDF detectHeaderRow Multi-Category Validation (MEDIUM)
**Files:** `packages/parser/src/pdf/table-parser.ts`, `apps/web/src/lib/parser/pdf.ts`

Replace single-keyword check with `isValidHeaderRow()` from column-matcher, matching CSV/XLSX behavior.

## P3: Summary Row Skip Whitespace Tolerance (LOW)
**Files:** All parsers (server CSV generic, server CSV adapter-factory, server XLSX, web CSV generic, web CSV adapters, web XLSX)

Update `합계|총계|소계|total|sum` regex to also match spaced variants: `총\s*합계|총\s*계|소\s*계|합\s*계|total|sum`.

## P4: Server adapter-factory Normalize Both Sides (LOW)
**File:** `packages/parser/src/csv/adapter-factory.ts`

Normalize the `headerKeywords` config array entries at adapter creation time for defensive matching.

## P5: Tests
**Files:** Various test files

- Test PDF detectHeaderRow rejects summary-only rows (amount keywords only)
- Test summary row skip with spaced Korean text
- Verify all existing tests still pass

## Deferred (explicitly)
- Web/server parser full dedup (architectural, requires shared package)
- PDF multi-line header joining (needs real samples)
- Web/server PDF tryStructuredParse return shape parity
- Historical amount display format
- Card name suffixes
- Global config integration

## Execution Order
1. P1 (web CSV header normalization) -- highest impact format diversity fix
2. P2 (PDF header multi-category) -- medium impact
3. P3 (summary row skip) -- small, all parsers
4. P4 (adapter-factory defensive normalization) -- small
5. P5 (tests) -- validate everything
