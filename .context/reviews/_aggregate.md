# Aggregate Review -- Cycle 42

## New Findings: 1 actionable, 0 deferred

### Actionable
1. **[MEDIUM]** Generic CSV `AMOUNT_PATTERNS` (both server and web) missing `마이너스` prefix pattern for column inference -- affects generic CSV parsing of files using 마이너스-prefixed amounts

### Previously Deferred (unchanged)
- D-01: Web/server CSV parser shared module refactor (architecture)
- D-02: Headerless CSV fallback (low ROI, edge case)

### Cycle 41 Finding Correction
The cycle 41 aggregate reported "[LOW] Server PDF fallback amount pattern uses `[₩]`". This was **incorrect** -- both server and web PDF use `[₩￦]` (both characters). No fix needed.

## No Regressions
All 951 tests (701 bun + 250 vitest) passing.

## Format Diversity Status
- CSV: 24 bank adapters (server + web), generic fallback, column inference, BOM stripping, encoding detection
- XLSX: HTML-as-XLS detection, multi-sheet selection, merged cell forward-fill, formula error detection
- PDF: Structured table parsing, header-aware column detection, fallback line scanner, LLM fallback
- Date: 8+ format variants including full-width dots, Korean dates, short dates with year inference
- Amount: Won signs, parenthesized negatives, 마이너스 prefix, whitespace stripping
- Unicode: NBSP, zero-width chars, directional markers, variation selectors all stripped

## Plan for This Cycle
1. Add `마이너스` pattern to server generic CSV `AMOUNT_PATTERNS` in `packages/parser/src/csv/generic.ts`
2. Add `마이너스` pattern to web CSV `AMOUNT_PATTERNS` in `apps/web/src/lib/parser/csv.ts`
3. Add test coverage for 마이너스 amounts in generic CSV column inference