# Cycle 29 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 29
**Tests:** 547 bun, 243 vitest

## Summary
3 findings from comprehensive deep code review of all parser source files (14 server-side, 8 web-side) with focus on format diversity, parity, and dead code.

## Findings

### F1: parseDateStringToISO missing test coverage for full-width dot date variants (Medium)
**Files:** `packages/parser/__tests__/date-utils.test.ts`, `packages/parser/src/date-utils.ts`
The `parseDateStringToISO` function supports full-width dot (U+FF0E `．`) and ideographic full stop (U+3002 `.`) as date delimiters (added C22-01), but the test suite has no explicit test cases for these variants. Similarly, datetime strings (e.g., "2024-01-15 10:30:00") are handled by the non-anchored fullMatch regex but lack dedicated test cases. Untested code paths risk regressions during future maintenance.

### F2: extractPages dead code in PDF extractor (Low)
**File:** `packages/parser/src/pdf/extractor.ts`
`extractPages()` is exported but never imported or called by any consumer in the codebase. Only `extractText()` is used (by `pdf/index.ts`). The function is dead code that adds maintenance burden and creates a false impression of the public API surface.

### F3: isValidCSVAmount exported but unused by server-side parsers (Low)
**Files:** `packages/parser/src/csv/shared.ts`, `packages/parser/src/csv/generic.ts`, `packages/parser/src/csv/adapter-factory.ts`
`isValidCSVAmount` is exported from shared.ts and tested in csv-shared.test.ts, but the adapter-factory and generic parsers perform inline amount validation instead (separate null check + amount <= 0 skip). This creates two code paths for the same logic. The web-side `isValidAmount` IS used by all web adapters, establishing the preferred pattern.

## Deferred Items (carried forward)
- Server/web `parseDateStringToISO` duplication (shared module refactor D-01)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- CSS dark mode migration