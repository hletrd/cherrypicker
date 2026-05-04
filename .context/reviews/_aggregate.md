# Cycle 27 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 27
**Tests:** 526 bun, 242 vitest

## Actionable Findings (2)

| ID | Severity | Category | Finding | File |
|---|----------|----------|---------|------|
| F1 | MEDIUM | PDF Format | PDF `AMOUNT_PATTERN` false-positive: bare 4-digit integers like "2024" match as amounts in all 4 PDF amount regexes (server index.ts, server table-parser.ts, web STRICT_AMOUNT_PATTERN, web AMOUNT_PATTERN) | `packages/parser/src/pdf/index.ts`, `packages/parser/src/pdf/table-parser.ts`, `apps/web/src/lib/parser/pdf.ts` |
| F2 | LOW | Test Coverage | No tests for PDF amount pattern rejecting year values like "2024" or "2025" as amounts | `packages/parser/__tests__/table-parser.test.ts` |

## Fixes Applied

- F1: Changed `[\d,]+` to `(?:[\d,]*,|\d{3,})[\d,]*` in all 4 PDF amount patterns to require either a comma (thousand separator) or minimum 3 digits, preventing 4-digit year values from matching as amounts (C27-01)
- F2: Added tests verifying amount patterns reject "2024" while accepting "1,234", "100", "12345" (C27-02)

## Previous Cycle Status

- Cycle 26 F1 (PDF reversed column order): **CONFIRMED FIXED**
- Cycle 26 F2 (reversed column order tests): **CONFIRMED FIXED**

## Deferred Items

- Web CSV factory pattern refactor (D1)
- Server ColumnMatcher path consistency (D2)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration