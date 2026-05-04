# Aggregate Review -- Cycle 15

## Findings (6 total)

### HIGH Priority
1. **PDF Header Row Detection Missing** -- The PDF structured parser uses only positional heuristics (architect, code-reviewer). Adding header keyword detection would significantly improve column identification, especially for PDFs with non-standard column ordering. Affects: `packages/parser/src/pdf/index.ts`, `packages/parser/src/pdf/table-parser.ts`.

### MEDIUM Priority
2. **Server extractor.ts Code Duplication** -- `extractPages()` duplicates buffer reading + pdfParse logic from `extractText()` (code-reviewer). Should call `extractPagesFromBuffer()` directly. Affects: `packages/parser/src/pdf/extractor.ts`.
3. **XLSX Memo Column Forward-Fill Gap** -- All other optional columns have forward-fill for merged cells except memo (architect, code-reviewer). Affects: `packages/parser/src/xlsx/index.ts`.
4. **PDF table-parser header-aware parsing** -- `parseTable()` should detect header rows using known keywords to anchor column boundaries (code-reviewer). Affects: `packages/parser/src/pdf/table-parser.ts`.

### LOW Priority
5. **CSV adapter-factory headerKeyword check doesn't normalize** -- Uses raw `trim()` instead of `normalizeHeader()` for keyword matching (code-reviewer). Affects: `packages/parser/src/csv/adapter-factory.ts`.
6. **Web/Server PDF parser tryStructuredParse return shape mismatch** -- Server returns `RawTransaction[] | null`, web returns `{ transactions, errors } | null` (architect). Affects: `packages/parser/src/pdf/index.ts`.

## Test Coverage Gaps
- PDF header detection: no tests (feature doesn't exist yet)
- XLSX memo forward-fill: no tests for merged memo cells

## Security
- No new security issues found.

## Performance
- No performance regressions identified.
