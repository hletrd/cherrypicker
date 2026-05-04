# Aggregate Review -- Cycle 53

## Actionable Findings (5)

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| C53-01 | Medium | All 6 parseAmount implementations miss full-width digits/digits commas | FIX |
| C53-02 | Medium | PDF table-parsers use inline daysInMonth instead of shared utility | FIX |
| C53-03 | Low | HEADER_KEYWORDS missing memo terms from MEMO_COLUMN_PATTERN | FIX |
| C53-04 | Low | Web-side CSV has 10 manual bank adapters duplicating factory logic | DEFER |
| C53-05 | Low | No XLSX data-inference fallback when header detection fails | DEFER |

## Test Status
- 819 bun + 265 vitest = 1084 total tests passing
- All gates green

## Findings Detail

### C53-01: Full-width digit/comma normalization in amount parsing
All parseAmount implementations (server CSV/XLSX/PDF, web CSV/XLSX/PDF) strip Won signs and regular commas but do NOT normalize full-width digits (U+FF10-U+FF19: ０-９) or full-width commas (U+FF0C: ，). Korean bank exports using CJK fullwidth forms produce unparseable amounts.
**Impact:** Full-width amount strings like "１，２３４원" produce null (unparseable amount error).

### C53-02: PDF inline daysInMonth computation
Both `packages/parser/src/pdf/table-parser.ts` and `apps/web/src/lib/parser/pdf.ts` compute `new Date(fullYear, month, 0).getDate()` inline in isValidYYMMDD() instead of importing shared daysInMonth() from date-utils.ts. Minor duplication but risks divergence.
**Impact:** Code quality/maintainability only.

### C53-03: HEADER_KEYWORDS missing memo terms
MEMO_COLUMN_PATTERN includes `내용`, `설명`, `참고`, `상세내역`, `memo`, `note`, `remarks` but these are absent from HEADER_KEYWORDS. Since header validation requires 2+ categories, this only affects files with standalone memo headers and no amount column (unlikely).
**Impact:** Minimal — header detection is category-gated.

### C53-04: Web-side CSV adapter duplication (DEFERRED)
The web-side CSV parser has 10 hand-written bank adapters plus a factory for 14. Server-side uses only factory. Dedup requires cross-build-system shared module (D-01).

### C53-05: XLSX data-inference fallback (DEFERRED)
When XLSX header detection fails, no data-inference fallback exists (unlike CSV). Requires significant new logic.

## Parity Check
- Server/web column-matcher: PARITY (identical patterns, split delimiters)
- Server/web date-utils: PARITY
- Server/web bank signatures: PARITY (24 banks each)
- Server/web XLSX column configs: PARITY (24 banks each)
- Server-side CSV: factory-only; web-side CSV: 10 manual + 14 factory (known divergence, D-01)