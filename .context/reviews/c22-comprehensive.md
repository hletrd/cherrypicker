# Cycle 22 — Comprehensive Code Review

**Reviewer**: cycle-22-agent
**Date**: 2026-05-05
**Scope**: packages/parser/, apps/web/src/lib/parser/
**Previous**: 21 cycles completed; 499 bun + 239 vitest tests passing

## Summary

After 21 cycles, the parser is highly mature. I identified **2 actionable findings**: one format-diversity gap (full-width dot in date patterns) and one code-quality bug (reservedCols includes -1 in server generic CSV). Findings are declining, confirming the parser is converging.

---

## Finding C22-01: Full-width dot not supported in date patterns [MEDIUM — FORMAT DIVERSITY]

**Files affected**:
- `packages/parser/src/csv/generic.ts` — DATE_PATTERNS (lines 24-30)
- `apps/web/src/lib/parser/csv.ts` — DATE_PATTERNS (lines 128-134)
- `packages/parser/src/pdf/index.ts` — fallbackDatePattern (line 277), STRICT_DATE_PATTERN (line 15)
- `apps/web/src/lib/parser/pdf.ts` — fallbackDatePattern (line 509), STRICT_DATE_PATTERN (line 38)

**Problem**: All date pattern regexes only match ASCII dot (`.`) as a date separator. Korean bank exports occasionally use:
- Full-width dot (U+FF0E): `2024．01．15`
- Ideographic full stop (U+3002): `2024。01。15`

The column-matcher's `normalizeHeader()` already strips U+FF0E for header matching, but data cells are parsed raw. Dates with these separators would fail to match, causing transaction loss.

**Fix**: Update regex character classes from `[.\-\/]` to `[.\－\-\/\．。]` in all date-matching patterns.

---

## Finding C22-02: Server generic CSV parser reservedCols includes -1 [LOW — CODE QUALITY]

**File**: `packages/parser/src/csv/generic.ts` line 139

**Problem**: When `merchantCol === -1` is false but other cols are `-1`, the Set includes `-1`:
```ts
const reservedCols = new Set([dateCol, amountCol, installmentsCol, categoryCol, memoCol].filter((c) => c !== -1));
```

This filter is present but `installmentsCol`, `categoryCol`, and `memoCol` can be `-1`. The filter handles it correctly. However, the web-side CSV parser (line 240) does the same but differently:
```ts
const reservedCols = new Set([dateCol, amountCol, installmentsCol, categoryCol, memoCol]);
```
The web-side does NOT filter -1. This means the web-side Set includes -1, which is harmless (no column has index -1) but inconsistent with the server-side.

**Fix**: Apply the same `.filter((c) => c !== -1)` to the web-side CSV parser for parity.

---

## Format Diversity Assessment

### CSV (Server + Web)
- Column header matching: Comprehensive (Korean + English, case-insensitive, zero-width stripping)
- Delimiter detection: comma, tab, pipe, semicolon — all covered
- Encoding: UTF-8, CP949, UTF-16 LE/BE — all covered
- Date formats: YYYY-MM-DD, YY-MM-DD, YYYYMMDD, MM/DD, Korean full/short — all covered
- Amount formats: Won sign (half/fullwidth), parenthesized negatives, comma separators, whitespace — all covered
- **Gap**: Full-width dot in date cells (C22-01)

### XLSX (Server + Web)
- HTML-as-XLS detection: covered
- Formula error cells: covered
- Serial date numbers: covered
- Merged cell forward-fill: date, merchant, category, installments, memo — all covered
- Multi-sheet selection: covered
- No new format gaps found.

### PDF (Server + Web)
- Structured table parsing with column boundary detection: covered
- Header-aware column detection: covered
- Fallback line scanner: covered
- Short date validation (month-aware): covered
- Parenthesized negative amounts: covered
- **Gap**: Full-width dot in fallback date patterns (C22-01)

### Server/Web Parity
- Column-matcher patterns: identical between server and web
- Summary row patterns: identical
- Header keywords: identical
- Date parsing logic: identical (shared parseDateStringToISO)
- Amount parsing: functionally identical (rounding, parenthesized negatives)
- XLSX forward-fill: identical
- PDF structured + fallback: identical
- **Gap**: reservedCols -1 filtering inconsistency (C22-02)

---

## Test Coverage Assessment

Test files cover:
- column-matcher.test.ts — header matching, normalization, patterns
- csv.test.ts — bank-specific and generic CSV parsing
- csv-adapters.test.ts — adapter factory behavior
- csv-shared.test.ts — splitCSVLine, parseCSVAmount, parseCSVInstallments
- date-utils.test.ts — all date formats, inferYear, validation
- detect.test.ts — bank detection, delimiter detection, encoding
- table-parser.test.ts — PDF table extraction
- xlsx.test.ts — XLSX parsing, HTML-as-XLS, forward-fill
- xlsx-parity.test.ts — server/web XLSX parity

**No test gaps found** for the current findings. The full-width dot fix should add test cases to date-utils.test.ts and csv.test.ts.

---

## Architecture Assessment

- Technical debt (web CSV duplication): Declining impact as generic parser handles more cases
- Shared column-matcher module: Working well, patterns in sync
- Error reporting: Consistent across parsers with Korean messages

## Regressions

None found. All 499 bun + 239 vitest tests pass.