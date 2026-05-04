# Cycle 29 Implementation Plan

**Source:** `_aggregate.md` (3 findings)

## Fixes

### F1: Add test coverage for full-width dot date variants and datetime [TODO]
- **Files:** `packages/parser/__tests__/date-utils.test.ts`
- **Action:** Add test cases for full-width dot (U+FF0E), ideographic full stop (U+3002), and datetime strings
- **Tests:** 4+ new assertions

### F2: Remove dead extractPages function [TODO]
- **Files:** `packages/parser/src/pdf/extractor.ts`
- **Action:** Remove unused `extractPages` export and its comment block

### F3: Adopt isValidCSVAmount in server-side parsers [TODO]
- **Files:** `packages/parser/src/csv/generic.ts`, `packages/parser/src/csv/adapter-factory.ts`
- **Action:** Import `isValidCSVAmount` from shared.ts, replace inline amount validation in both parsers, matching web-side `isValidAmount` pattern

## Deferred (unchanged)
- Server/web parseDateStringToISO duplication (shared module refactor D-01)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- CSS dark mode migration