# Cycle 95 — architect

## Layering & Coupling

- `packages/core` remains runtime-agnostic (no Node/Bun APIs in calculator, optimizer, categorizer, models).
- `packages/rules` remains pure TS + YAML.
- `packages/parser` Bun-specific. `apps/web/src/lib/parser` browser-specific. Duplication is known (D-01, D-57, D-88, D-55, D-35) — deferred architectural refactor.
- `apps/web/src/lib/analyzer.ts` is the web-side adapter layer that narrows card/rule types to `@cherrypicker/core`. Cache invalidation exported for store reset.
- `packages/viz` pulls `CATEGORY_NAMES_KO` from `@cherrypicker/core` — consistent with CLI fallback story.

## Boundary Integrity

- `analyzer.ts` uses explicit adapter functions `toCoreCardRuleSets` / `toRulesCategoryNodes` with validated runtime narrowing (no `as unknown as` chains in runtime code).
- `store.svelte.ts` interface types (`CardRewardResult`, `CardAssignment`, `OptimizationResult`) mirror the shape returned by `@cherrypicker/core`.

## New Findings

None.

## Summary

0 new findings. The layered architecture remains sound. Deferred refactors (D-01 family) remain deferred.
