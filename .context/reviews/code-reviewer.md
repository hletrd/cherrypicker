# Cycle 97 Deep Code Review -- code-reviewer

## Review Scope
Full review of packages/parser/src/ focusing on harder edge cases, more flexibility, more modality, and more reliability after 96 cycles.

## Baseline: 1317 bun + 306 vitest tests passing

---

## Finding F-01: No JSON Transaction Format Support [MODALITY]
**Severity: HIGH**
**Files:** `types.ts`, `detect.ts`, `index.ts`

The parser only supports CSV, XLSX, and PDF. JSON transaction exports from banking APIs, mobile apps, and financial tools are completely unsupported. Many Korean banking apps (Kakao, Toss) offer JSON exports. The `FileFormat` type is `'csv' | 'xlsx' | 'pdf'` with no extension path.

**Impact:** Users with JSON exports cannot use the tool without manual conversion.

---

## Finding F-02: Duplicated parseAmount Across 3 Parsers [RELIABILITY]
**Severity: MEDIUM**
**Files:** `csv/shared.ts`, `xlsx/index.ts`, `pdf/index.ts`

The amount parsing logic (fullwidth normalization, KRW prefix, Won sign, 마이너스, trailing minus, parenthesized negatives, Math.round) is copy-pasted across all three parsers with identical logic (~25 lines each).

**Risk:** Bug fixes in one copy don't propagate. The XLSX `parseAmount` could diverge from CSV's `parseCSVAmount` or PDF's `parseAmount`.

**Fix:** Extract to a shared `parseAmountString()` in `shared.ts` used by all three parsers.

---

## Finding F-03: Duplicated isValidShortDate/isDateLikeShort Across 4 Files [RELIABILITY]
**Severity: MEDIUM**
**Files:** `csv/generic.ts`, `pdf/index.ts`, `pdf/table-parser.ts`

Short-date validation logic (MM.DD format with month/day range checks, 4-year leap year window) is duplicated in 3 files.

**Fix:** Extract to a shared function in `date-utils.ts`.

---

## Finding F-04: CSV Parser Silent Skip on Short Rows [HARDER]
**Severity: LOW-MEDIUM**
**Files:** `csv/generic.ts`, `csv/adapter-factory.ts`

When a data row has fewer columns than the header, `cells[dateCol]` returns undefined and the row is silently skipped. No diagnostic for column-count mismatches.

**Fix:** Add bounds checking that explicitly handles short rows, logging a debug message.

---

## Finding F-05: Web-Side Parser Also Missing JSON Support [MODALITY]
**Severity: MEDIUM**
**Files:** `apps/web/src/lib/parser/`

Web-side parser has the same limitation — no JSON support. `parseFile` only handles csv/xlsx/pdf.

---

## Deferred Items
- D-01: OFX/QFX format support (complex SGML-like format)
- D-02: HTML table as standalone format (handled by XLSX HTML-as-XLS detection)
- D-03: Clipboard paste format (depends on UI)
- D-04: Confidence scoring for parsed transactions (significant feature)