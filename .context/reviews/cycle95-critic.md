# Cycle 95 — critic

## Skeptical Cross-Cutting Critique

Examined the system across multiple perspectives looking for issues prior cycles may have accepted too readily.

### Accepted Tradeoffs Still Defensible

- `Math.abs()` unconditional in `formatSavingsValue` — because the label (추가 절약 / 추가 비용) carries direction, the display must be magnitude-only; matches user expectation.
- `formatSavingsValue(…, prefixValue)` separating display-value from prefix-decision-value — prevents "+1원" flash during animation; the added parameter complexity is justified by the C82-03 / C91-01 regression history.
- `_v ?? 0` treating undefined as v0 — safer than throwing away legacy sessionStorage data; migrations chain ensures correct transformation path (C76-01).
- Shallow validation in `loadFromStorage` for `cardResults` — deeper per-field validation is not needed because the render-time Svelte components are defensive (formatters guard NaN, toFixed on numbers, etc.).

### Points Where Alternatives Exist But Not Worth Flipping

- `scoreCardsForTransaction` push/pop pattern — alternative is incremental score caching, but rejected per D-09/D-51/D-86 (not actionable at current scale).
- Multiple hardcoded maps (CATEGORY_NAMES_KO, CATEGORY_COLORS, BANK_SIGNATURES) — alternative is dynamic generation from YAML, but rejected per D-01 family (large architectural refactor).

### New Critical Observations

None.

## Summary

0 new findings. Existing architectural decisions hold up under skeptical review.
