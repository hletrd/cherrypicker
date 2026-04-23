# Cycle 98 — architect pass

**Date:** 2026-04-23

## Scope

Architectural/design risks, coupling, layering.

## Findings

None net-new.

## Deferred architecture items (status check)

1. **Parser return-type refactor** (flagged in cycles 96 & 97 architect) — deferred.
   - Rationale: `parseDateStringToISO` returns `string` unconditionally, leaking invalid dates. Two downstream symptoms (C96-01 and C97-01) have been patched at the analyzer boundary.
   - Cost-benefit: MEDIUM-effort refactor vs. two cheap symptomatic fixes already in place.
   - Current status: no new symptoms in cycle 98, so deferring is still correct.
   - **New data point:** No cycle 98 tracing revealed additional symptoms. Root-cause fix is discretionary rather than urgent.

2. **Web-vs-packages parser duplication** (D-01, original severity HIGH) — deferred.
   - Rationale: browser-compatible parser (apps/web) vs Bun-based parser (packages/parser) diverged.
   - No progress; no regression.

3. **CATEGORY_NAMES_KO stale-duplicate of YAML taxonomy** (TODO(C64-03) at `greedy.ts:10`) — deferred.
   - Partial mitigation: `categoryLabels` Map is passed from caller (`buildCategoryLabelMap` at `analyzer.ts:245`), taking precedence over `CATEGORY_NAMES_KO` fallback.
   - Remaining risk: CLI callers still rely on the hard-coded map. If taxonomy changes, CLI-only labels could drift.

## Architectural observations

- **Event-sourcing-like reoptimize flow.** `editedTransactions` replaces `transactions` in the store; `monthlyBreakdown` is recomputed from them. This is functionally an "edit = new snapshot" pattern. Correct.
- **Cache invalidation discipline.** Three caches: `cachedCoreRules` (analyzer), `cachedCategoryLabels` (store), `cardIndex` (cards). All three are invalidated on `analysisStore.reset()`. Good.
- **Layering.** `packages/core` is platform-agnostic. `apps/web/src/lib/*` depends on `@cherrypicker/core`. No inverse dependencies. Good layering.
- **Typed adapters.** `toRulesCategoryNodes` + `toCoreCardRuleSets` in `analyzer.ts:22-71` provide narrow type adaptation between web and core — acceptable for the current monorepo structure.

## Summary

0 net-new architecture findings. Deferred items unchanged.
