# Cycle 21 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 21
**Tests:** 495 bun + 236 vitest = 731 total

## Actionable Findings (3)

| ID | Severity | Description | File |
|---|---|---|---|
| F21-01 | MEDIUM | CSV generic `isDateLikeShort` uses `day <= 31` instead of month-aware validation; impossible dates like "2/31" pass, inconsistent with PDF parsers which use `MAX_DAYS_PER_MONTH` | `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts` |
| F21-02 | LOW | Web XLSX `parseAmount` missing whitespace stripping (`.replace(/\s/g, '')`); server XLSX and both CSV parsers have it | `apps/web/src/lib/parser/xlsx.ts` |
| F21-03 | LOW | Server CSV `parseCSVAmount` strips whitespace after parenthesized negative check; should strip before for consistency with all other parsers | `packages/parser/src/csv/shared.ts` |

## Deferred Items (carried from prior cycles)

| ID | Description | Reason |
|---|---|---|
| D-01 | Web/server CSV adapter duplication | Architecture refactor, shared module between Bun/browser needed |
| D-02 | Server-side ColumnMatcher module path consistency | Build system constraint |
| D-03 | PDF multi-line header support | Complex, low frequency |
| D-04 | Historical amount display format | UI concern, not parser |
| D-05 | Card name suffixes | Rules layer concern |
| D-06 | Global config integration | Feature work |
| D-07 | Generic parser fallback behavior | Behavior change risk |
| D-08 | CSS dark mode complete migration | UI concern |
| D-09 | XLSX forward-fill code duplication | Requires shared module (D-01) |

## Test Baseline
- 495 bun tests passing
- 236 vitest tests passing
- 0 failures