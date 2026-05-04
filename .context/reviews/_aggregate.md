# Aggregate Review -- Cycle 41

## New Findings: 1 actionable, 1 deferred

### Actionable
1. **[LOW]** Server PDF fallback amount pattern uses `[₩]` character class instead of plain `₩` - inconsistent with web-side pattern

### Deferred
- D-01: Web/server CSV parser shared module refactor (architecture)
- D-02: Headerless CSV fallback (low ROI, edge case)

## No Regressions
All 806 tests (696 bun + 110 vitest) passing.

## Format Diversity Status
- CSV: 24 bank adapters (server + web), generic fallback, column inference, BOM stripping, encoding detection
- XLSX: HTML-as-XLS detection, multi-sheet selection, merged cell forward-fill, formula error detection
- PDF: Structured table parsing, header-aware column detection, fallback line scanner, LLM fallback
- Date: 8+ format variants including full-width dots, Korean dates, short dates with year inference
- Amount: Won signs, parenthesized negatives, 마이너스 prefix, whitespace stripping
- Unicode: NBSP, zero-width chars, directional markers, variation selectors all stripped

## Plan for This Cycle
1. Fix server PDF fallback amount pattern `[₩]` → `₩`
2. Add test coverage for the fix