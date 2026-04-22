# Code Review -- Cycle 1 (2026-04-22)

## Findings

### CR-01: Greedy optimizer recomputes full reward per card per transaction
- **File**: `packages/core/src/optimizer/greedy.ts:120-151`
- **Problem**: `scoreCardsForTransaction` calls `calculateCardOutput` (which processes ALL already-assigned transactions for that card) twice per card per transaction (before push + after push). For N transactions, M cards, and K avg transactions per card, this is O(N * M * K) reward recalculations, each O(K), yielding O(N * M * K^2) total.
- **Failure scenario**: With 500 transactions and 10 cards, each call to calculateCardOutput processes the full assigned list. When 250 transactions are already assigned to a card, each subsequent marginal-reward computation processes all 250.
- **Suggested fix**: Maintain incremental reward state per card. Track the running `totalReward` and only compute the delta from the new transaction's rule match, adjusting for cap interactions.
- **Confidence**: Medium (architectural concern; real-world impact depends on dataset size)

### CR-02: CATEGORY_NAMES_KO hardcoded map silently drifts from YAML taxonomy
- **File**: `packages/core/src/optimizer/greedy.ts:11-86`
- **Problem**: 86-entry hardcoded Korean label map duplicates data from `packages/rules/data/categories.yaml`. The TODO on line 7 acknowledges this but the drift risk is real -- any YAML taxonomy change requires manual lockstep update.
- **Failure scenario**: A new subcategory is added to categories.yaml (e.g., `dining.bakery`) but CATEGORY_NAMES_KO is not updated. The optimizer falls back to the raw English key in the UI.
- **Suggested fix**: Import category labels from the rules package at optimizer initialization, or generate CATEGORY_NAMES_KO from the YAML at build time.
- **Confidence**: High (acknowledged TODO, 94 prior cycles flagging)

### CR-03: parseCSV shared.ts duplication with web csv.ts
- **File**: `packages/parser/src/csv/shared.ts` vs `apps/web/src/lib/parser/csv.ts:8-99`
- **Problem**: The web CSV parser reimplements `splitLine`, `parseAmount`, `isValidAmount`, and `parseInstallments` instead of importing from the shared package. The NOTE on line 29-34 acknowledges this.
- **Failure scenario**: A bug fix in `shared.ts` is applied but not ported to the web copy, causing inconsistent parsing behavior between CLI and web.
- **Suggested fix**: Extract shared parsing utilities into a browser-compatible package that both Bun and web can import.
- **Confidence**: High (acknowledged duplication, 94+ cycles flagging)

### CR-04: loadAllCardRules silently swallows validation errors
- **File**: `packages/rules/src/loader.ts:32-46`
- **Problem**: `Promise.allSettled` + filter for fulfilled results means a malformed YAML card file is silently skipped with only a `console.warn`. No error surface is exposed to the caller.
- **Failure scenario**: A card YAML file has an invalid `rate` field. The file is skipped, reducing the card pool. The optimizer produces a suboptimal result without the user knowing a card was excluded.
- **Suggested fix**: Return both the loaded rules and the list of failed files with reasons.
- **Confidence**: Medium (silent data loss, but unlikely in production since YAML is validated at build time)

### CR-05: ilpOptimize is a stub that silently degrades to greedy
- **File**: `packages/core/src/optimizer/ilp.ts:43-50`
- **Problem**: The ILP optimizer is documented as "optimal" but unconditionally falls back to greedy with only a `console.debug` message.
- **Failure scenario**: A user explicitly requests ILP optimization expecting globally optimal results, but gets greedy. The debug log is invisible in production.
- **Suggested fix**: Change `console.debug` to `console.warn`, or remove the stub until glpk.js is integrated.
- **Confidence**: Medium (feature gap, not a bug)

### CR-06: Bank adapter parseCSV methods are near-identical boilerplate
- **File**: `apps/web/src/lib/parser/csv.ts:288-944`
- **Problem**: All 10 bank adapters follow the exact same pattern with only header keyword differences. The same parsing logic is copy-pasted 10 times.
- **Failure scenario**: A bug fix applied to one adapter must be manually replicated across all 10, with high risk of missing one.
- **Suggested fix**: Create a data-driven adapter factory that takes header keywords as configuration.
- **Confidence**: High (obvious code duplication, maintenance burden)

### CR-07: categoryRewards bucket mutation pattern is fragile
- **File**: `packages/core/src/calculator/reward.ts:216-341`
- **Problem**: The `bucket` object is retrieved from the Map with `??` fallback, mutated in-place, then set back. Works because the object reference is the same, but confusing.
- **Failure scenario**: A future refactor changes the `??` fallback to always create a fresh object, breaking the in-place mutation silently.
- **Suggested fix**: Use `getOrCreate` pattern with explicit Map.set after every mutation.
- **Confidence**: Low (works correctly today, maintenance hazard)

### CR-08: findRule specificity sort is unstable for equal scores
- **File**: `packages/core/src/calculator/reward.ts:87`
- **Problem**: `candidates.sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a))` is not guaranteed to be stable across JS engines. Two rules with equal specificity will have their order determined by the engine's sort implementation.
- **Failure scenario**: Two rules with the same category, no subcategory, and no conditions but different rates (e.g., from different tiers) could be matched in inconsistent order across browsers, producing different optimization results.
- **Suggested fix**: Add a secondary sort key (e.g., rule index) to ensure deterministic ordering.
- **Confidence**: Medium (rare in practice but non-deterministic behavior)
