# Cycle 20 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 20
**Tests:** 489 bun + 233 vitest = 722 total

## Actionable Findings (2)

| ID | Severity | Description | File |
|---|---|---|---|
| F20-01 | HIGH | Server PDF fallback scanner parenthesized amount regex bug: capture group 1 undefined for `(1,234)`, causes TypeError crash | `packages/parser/src/pdf/index.ts` |
| F20-02 | MEDIUM | CSV isDateLike false-positive on decimal amounts (e.g., `3.5` matches MM/DD pattern), can misidentify amount column as date column when header detection fails | `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts` |

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

## Test Baseline
- 489 bun tests passing
- 233 vitest tests passing
- 0 failures