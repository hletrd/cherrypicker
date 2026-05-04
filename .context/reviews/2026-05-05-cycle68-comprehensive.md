# Cycle 68 Deep Code Review

## Focus: Remaining Format Diversity Issues After 67 Cycles

### Finding 1: Trailing minus sign for negative amounts (C68-01)
**Severity: Medium** | Format diversity gap

Some Korean bank exports denote negative amounts with a trailing minus: "1,234-"
instead of "-1,234". Current parsers handle leading minus, parenthesized, and
"마이너스" prefix negatives but NOT trailing minus.

Affected locations:
- `packages/parser/src/csv/shared.ts` — `parseCSVAmount()` does not strip trailing minus
- `packages/parser/src/csv/generic.ts` — `AMOUNT_PATTERNS` does not match "1,234-"
- `packages/parser/src/pdf/index.ts` — `parseAmount()`, `AMOUNT_PATTERN`, `STRICT_AMOUNT_PATTERN`
- `packages/parser/src/pdf/table-parser.ts` — `AMOUNT_PATTERN` (table row detection)
- `packages/parser/src/xlsx/index.ts` — `parseAmount()`
- `apps/web/src/lib/parser/csv.ts` — `parseAmount()`, `AMOUNT_PATTERNS`
- `apps/web/src/lib/parser/pdf.ts` — `parseAmount()`, `AMOUNT_PATTERN`, `STRICT_AMOUNT_PATTERN`
- `apps/web/src/lib/parser/xlsx.ts` — `parseAmount()`

### Finding 2: PDF fallback amount regex misses trailing minus (C68-02)
**Severity: Low-Medium** | Related to C68-01

The PDF fallback line scanner's `fallbackAmountPattern` in both server and web
parsers does not match trailing-minus amounts. Since the fallback scanner is the
last line of defense for PDFs, this is a gap.

Affected:
- `packages/parser/src/pdf/index.ts` — `fallbackAmountPattern`
- `apps/web/src/lib/parser/pdf.ts` — `fallbackAmountPattern`

### Finding 3: Server/web parity — column-matcher drift risk (C68-03)
**Severity: Low** | Architecture debt

The web-side `column-matcher.ts` is a manual copy of the server-side. They are
currently in sync but drift risk remains. This is a known architectural issue
(D-01) and cannot be fixed without a shared module build refactor.

Status: EXPLICITLY DEFERRED — requires D-01 architectural refactor.

### Finding 4: PDF multi-line header support (C68-04)
**Severity: Low** | Known deferred item

PDF headers that span multiple lines are not supported. The table parser expects
headers on a single line. This is a known limitation documented since early cycles.

Status: EXPLICITLY DEFERRED — requires PDF text extraction improvements.

### Finding 5: All 1100 tests passing (143 vitest + 957 bun)
**Severity: N/A** | No regressions

Test suite is healthy. Coverage is comprehensive for existing features.

### Summary
After 67 cycles, the parser is highly mature. The main remaining format diversity
gap is trailing-minus negative amounts (C68-01), which affects all 8 parsers
(server CSV/XLSX/PDF, web CSV/XLSX/PDF) and both PDF fallback scanners.