# Cycle 22 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 22
**Tests:** 499 bun + 239 vitest = 738 total

## Actionable Findings (2)

| ID | Severity | Description | File |
|---|---|---|---|
| C22-01 | MEDIUM | Full-width dot (U+FF0E `．`) and ideographic full stop (U+3002 `。`) not supported in date patterns — dates like `2024．01．15` fail to parse in CSV and PDF parsers. The column-matcher's `normalizeHeader` already strips U+FF0E for headers, but data cells are parsed raw. | `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`, `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts`, both `date-utils.ts` |
| C22-02 | LOW | Server generic CSV `reservedCols` filters `-1` from Set but web-side does not — inconsistent parity (harmless but sloppy) | `apps/web/src/lib/parser/csv.ts` |

## Trend

Findings continue to decline (2 this cycle vs 3 in cycle 21, 2-3 in cycle 20). Both findings are concrete and actionable. Format diversity coverage is converging.

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
- 499 bun tests passing
- 239 vitest tests passing
- 0 failures