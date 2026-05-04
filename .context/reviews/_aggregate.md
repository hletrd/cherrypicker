# Cycle 13 Aggregate Review

**Date:** 2026-05-05
**Test Status:** 435 bun + 231 vitest = 666 tests passing

## Actionable Findings

| # | Severity | Finding | Files |
|---|----------|---------|-------|
| F1 | MEDIUM | CSV splitCSVLine ignores quoted fields for non-comma delimiters | packages/parser/src/csv/shared.ts, apps/web/src/lib/parser/csv.ts |
| F2 | LOW-MEDIUM | PDF extractor joins text items without space | packages/parser/src/pdf/extractor.ts |
| F3 | LOW | normalizeHeader missing fullwidth space U+3000 | packages/parser/src/csv/column-matcher.ts, apps/web/src/lib/parser/column-matcher.ts |

## Non-Issues (Verified)
- XLSX error cells: handled correctly by existing parseAmount/parseDateToISO
- PDF multi-line headers: not needed — PDF uses positional column detection
- PDF compact numbers: regex already handles commaless digits

## Deferred
- Web CSV inline adapters (D-01 architectural refactor)
- CSS dark mode migration
- Historical amount display format
- Global config integration

## Implementation Plan
1. Fix F1: Refactor splitCSVLine to handle quoted fields for all delimiters
2. Fix F2: Add space between adjacent text items in PDF extractor
3. Fix F3: Add fullwidth space to normalizeHeader stripping
4. Add tests for F1 (tab/pipe/semicolon quoted fields)
5. Verify parity between server and web parsers