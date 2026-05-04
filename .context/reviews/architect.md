# Architect Review — Cycle 11

## Deferred Items Status
1. Server-side ColumnMatcher module path consistency — STILL DEFERRED
2. Web-side CSV parser vs server-side duplication (D-02) — STILL DEFERRED
3. PDF multi-line header/transaction support (D-04) — STILL DEFERRED
4. Historical amount display format — STILL DEFERRED
5. Card name suffixes — STILL DEFERRED
6. Global config integration — STILL DEFERRED
7. Generic parser fallback behavior — STILL DEFERRED
8. CSS dark mode complete migration — STILL DEFERRED
9. Server/web shared module refactoring (D-01) — STILL DEFERRED
10. PDF parser deduplication (D-03) — STILL DEFERRED

## Architecture Observations
The PDF DATE_PATTERN short date fix is a good targeted improvement. It enables structured parsing for a common PDF format variant without requiring the larger D-04 multi-line transaction refactor.

The normalizeHeader zero-width space fix is a defensive improvement that protects against real-world Korean bank export quirks.