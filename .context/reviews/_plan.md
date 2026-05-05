# Cycle 97 Implementation Plan

## Goal
Add JSON transaction format support (new modality), extract shared parseAmountString to eliminate duplication, and extract shared isValidShortDate.

## Plan

### P1: Add 'json' to FileFormat type and detection (F-01, F-05) [MODALITY]
**Files:** `packages/parser/src/types.ts`, `apps/web/src/lib/parser/types.ts`
- Add `'json'` to `FileFormat` union type

### P2: Create JSON parser module (F-01) [MODALITY]
**Files:** `packages/parser/src/json/index.ts` (NEW)
- `parseJSON(content: string, bank?: BankId): ParseResult`
- Parse arrays of transaction objects with flexible field name mapping
- Handle nested `{ transactions: [...] }` wrappers
- Reuse existing `parseCSVAmount` for amount normalization
- Handle various date formats via `parseDateStringToISO`

### P3: Add JSON detection to detectFormat (F-06) [MODALITY]
**Files:** `packages/parser/src/detect.ts`, `apps/web/src/lib/parser/detect.ts`
- Add `.json` extension detection
- Add content sniffing: first non-whitespace char is `[` or `{` and content parses as JSON

### P4: Wire JSON into parseStatement (F-01) [MODALITY]
**Files:** `packages/parser/src/index.ts`, `apps/web/src/lib/parser/index.ts`
- Add `json` case to switch statement
- Export `parseJSON` function

### P5: Extract shared parseAmountString (F-02) [RELIABILITY]
**Files:** `packages/parser/src/csv/shared.ts`, `packages/parser/src/xlsx/index.ts`, `packages/parser/src/pdf/index.ts`
- Extract common amount parsing to `parseAmountString(raw: string): number | null` in shared.ts
- Replace duplicated logic in XLSX and PDF parsers with import

### P6: Extract shared isValidShortDate to date-utils (F-03) [RELIABILITY]
**Files:** `packages/parser/src/date-utils.ts`, `packages/parser/src/csv/generic.ts`, `packages/parser/src/pdf/index.ts`, `packages/parser/src/pdf/table-parser.ts`
- Extract `isValidShortDate(cell: string): boolean` to date-utils.ts
- Replace all local implementations with import

### P7: Add tests
**Files:** `packages/parser/__tests__/json.test.ts` (NEW), `packages/parser/__tests__/csv-shared.test.ts`
- Tests for JSON parsing: array format, nested format, various field names, malformed entries
- Tests for shared parseAmountString

### P8: Web-side parity
**Files:** `apps/web/src/lib/parser/json.ts` (NEW), `apps/web/src/lib/parser/types.ts`, `apps/web/src/lib/parser/index.ts`
- Add JSON parser with same logic as server side
- Wire into parseFile

### P9: Quality gates
- bun test, vitest, typecheck, lint, build

## Deferred
- D-01: OFX/QFX format support
- D-02: HTML table as standalone format
- D-03: Clipboard paste format
- D-04: Confidence scoring