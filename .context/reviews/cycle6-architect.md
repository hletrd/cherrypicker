# Cycle 6 — architect

## Architectural observations

### Boundary conformance
- `packages/core`, `packages/rules`, `packages/viz` remain pure TypeScript with no Runtime-specific APIs. Confirmed by inspection of `packages/core/src/optimizer/greedy.ts` and `packages/core/src/calculator/reward.ts`.
- `apps/web` isolates all DOM-specific code to Svelte islands; Astro pages remain thin shells.

### Coupling issues introduced / carried
1. **C6UI-12 — `VisibilityToggle.svelte` couples results page stat-element IDs to Svelte island imperative writes.**
   The component queries `#stat-total-spending`, `#stat-total-savings`, `#stat-cards-needed`, `#stat-savings-label` by ID and mutates `.textContent`. This crosses the island boundary in a way that makes the Astro page silently depend on the island's behavior. Refactor: create a `<ResultsStats client:load />` island that owns those stats as reactive state and renders them directly.

2. **C6UI-13 — print handler split.**
   `report.astro` has a named `cherrypickerPrint` inline; `results.astro` uses inline `window.print()`. No shared module.

3. **C6UI-40 — fixture / rule schema drift.**
   The core optimizer's rule logic deliberately excludes broad rules from subcategorized transactions. If the Korean card market ever changes and we need to relax this per card, the schema currently has no `includeSubcategories: boolean` flag. The fixture implicitly assumes such a flag exists. Either:
   - Add the flag to `packages/rules/src/schema.ts` (forward-compatible expansion), OR
   - Rewrite the fixture to test the current behavior.
   Picking one commits the schema; the right architectural answer depends on whether the project wants a per-card override for this rule.

### Cross-layer findings
- `TransactionReview.svelte:65-112` loads categories via `loadCategories(controller.signal)` with a hardcoded fallback list. The fallback list `FALLBACK_GROUPS` (lines 26-43) duplicates information in `packages/rules/data/categories.yaml`. Any taxonomy change requires updating three places: YAML, `apps/web/public/data/categories.json`, and this fallback. Consider moving the fallback into a build-time-inlined JSON import from `@cherrypicker/rules`.
- `greedy.ts:11-86` also duplicates category labels (`CATEGORY_NAMES_KO`). Same issue, flagged previously as TODO(C64-03).

## No new architectural hot-spots; all boundaries honored.
