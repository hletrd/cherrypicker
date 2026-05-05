# Cycle 98 Implementation Plan

## Goal
Add OFX/QFX and HTML table format support (two new modalities), fix BOM-aware content sniffing, and add comprehensive tests.

## Plan

### P1: Add 'ofx' and 'html' to FileFormat type (F-01, F-02) [MODALITY]
**Files:** `packages/parser/src/types.ts`, `apps/web/src/lib/parser/types.ts`
- Add `'ofx' | 'html'` to `FileFormat` union type

### P2: Create OFX parser module (F-01) [MODALITY]
**Files:** `packages/parser/src/ofx/index.ts` (NEW)
- `parseOFX(content: string, bank?: BankId): ParseResult`
- Parse SGML-style OFX 1.x (tags without closing delimiters)
- Parse XML-style OFX 2.x (proper closing tags)
- Extract `<DTPOSTED>`, `<NAME>`, `<TRNAMT>`, `<MEMO>`, `<TRNTYPE>` from `<STMTTRN>` blocks
- Dates are YYYYMMDD format, use parseDateStringToISO
- Amounts: positive = charges, negative = credits/payments (skip negatives)
- Reuse parseAmountString for string amounts

### P3: Create HTML table parser module (F-02) [MODALITY]
**Files:** `packages/parser/src/html/index.ts` (NEW)
- `parseHTML(content: string, bank?: BankId): ParseResult`
- Reuse SheetJS to parse HTML tables (same as XLSX HTML-as-XLS path)
- Try all tables, pick the one with most transactions
- Use shared header detection (isValidHeaderRow, findColumn)
- Reuse parseAmountString and parseDateStringToISO

### P4: Add format detection for OFX and HTML (F-01, F-02, F-03) [MODALITY+HARDER]
**Files:** `packages/parser/src/detect.ts`, `apps/web/src/lib/parser/detect.ts`
- Add `.ofx`/`.qfx` extension -> 'ofx' format
- Add `.html`/`.htm` extension -> 'html' format
- Add XML/OFX content sniffing: `<?OFX` or `<?xml` with OFX tags -> 'ofx'
- Add HTML content sniffing: `<!DOCTYPE` or `<html` or `<table` -> 'html'
- Fix BOM-aware content sniffing (strip BOM before JSON/XML/HTML checks)

### P5: Wire into parseStatement (F-01, F-02) [MODALITY]
**Files:** `packages/parser/src/index.ts`, `apps/web/src/lib/parser/index.ts`
- Add `ofx` and `html` cases to switch statement
- Export `parseOFX` and `parseHTML` functions

### P6: Add comprehensive tests
**Files:** `packages/parser/__tests__/ofx.test.ts` (NEW), `packages/parser/__tests__/html.test.ts` (NEW), `packages/parser/__tests__/detect.test.ts` (extend)
- OFX tests: SGML format, XML format, date parsing, amount handling, Korean merchants, empty fields, malformed content
- HTML tests: basic table, multiple tables, malformed tags, Korean text, no transaction table
- Detection tests: .ofx/.qfx/.html/.htm extensions, content sniffing with BOM

### P7: Web-side parity
**Files:** `apps/web/src/lib/parser/ofx.ts` (NEW), `apps/web/src/lib/parser/html.ts` (NEW), `apps/web/src/lib/parser/types.ts`, `apps/web/src/lib/parser/index.ts`, `apps/web/src/lib/parser/detect.ts`
- Add OFX and HTML parsers with same logic as server side
- Wire into parseFile

### P8: Quality gates
- bun test, vitest, typecheck, lint, build

## Deferred
- D-01: Confidence scoring on ParseResult
- D-02: Clipboard paste format
- D-03: Recursive JSON wrapper search beyond 2 levels