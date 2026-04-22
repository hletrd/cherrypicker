# Document Specialist Review -- Cycle 1 (2026-04-22)

## Doc/Code Mismatch Findings

### DS-01: ILP optimizer doc says "optimal" but implementation is greedy
- **File**: `packages/core/src/optimizer/ilp.ts:38-39`
- **Problem**: The JSDoc says "Optimal ILP optimizer" but the function delegates to `greedyOptimize`. The TODO on line 47 acknowledges this, but the public API in `index.ts:31` exposes `ilpOptimize` as if it were a real implementation.
- **Code**: `export function ilpOptimize(...)` with JSDoc "Optimal ILP optimizer."
- **Doc**: The function's behavior (greedy fallback) contradicts the "optimal" description.
- **Suggested fix**: Update JSDoc to say "ILP optimizer (currently delegates to greedy until glpk.js is integrated)" or similar.
- **Confidence**: High (clear doc-code mismatch)

### DS-02: RewardTierRate schema refinement message says "mutually exclusive" but code handles both
- **File**: `packages/rules/src/schema.ts:22-23` vs `packages/core/src/calculator/reward.ts:258-269`
- **Problem**: The Zod refinement on line 22 says "rate and fixedAmount are mutually exclusive" and rejects YAML with both. But the reward calculator on line 258-269 has explicit handling for the case where both are present (with a `console.warn`).
- **Mismatch**: The schema rejects the combination, making the code path unreachable. The code path exists as defensive programming but contradicts the schema's assertion.
- **Suggested fix**: Either remove the defensive code path (it's unreachable) or relax the schema to allow both with a warning.
- **Confidence**: Medium (the code works correctly, but the defensive path is dead code)

### DS-03: CardRuleSet web type has `source: string` but rules type has union
- **File**: `apps/web/src/lib/cards.ts:23` vs `packages/rules/src/types.ts:51`
- **Problem**: Web `CardRuleSet.card.source` is typed as `string` while the rules package defines it as `'manual' | 'llm-scrape' | 'web'`. The analyzer bridges this with a runtime check, but the type definitions disagree.
- **Mismatch**: TypeScript will not catch a new source value that's valid in the rules package but not in the web package's string type.
- **Suggested fix**: Use the same union type in both places, or import from the rules package.
- **Confidence**: High (type definition mismatch)

### DS-04: CATEGORY_NAMES_KO map diverges from categories.yaml
- **File**: `packages/core/src/optimizer/greedy.ts:11-86`
- **Problem**: The TODO on line 7 acknowledges that CATEGORY_NAMES_KO can silently drift from categories.yaml. There is no validation that the keys in CATEGORY_NAMES_KO match the IDs in categories.yaml.
- **Mismatch**: If a category is added to categories.yaml without updating CATEGORY_NAMES_KO, the fallback chain in `buildAssignments` (line 176) falls through to the raw English key, showing "new_category" instead of Korean text.
- **Suggested fix**: Add a build-time validation step that compares CATEGORY_NAMES_KO keys against categories.yaml IDs.
- **Confidence**: High (acknowledged drift risk)

### DS-05: web CategoryNode has `label` field not in rules CategoryNode
- **File**: `apps/web/src/lib/cards.ts:139-145` vs `packages/rules/src/types.ts:69-75`
- **Problem**: The web `CategoryNode` interface has a `label` field (line 142) that doesn't exist in the rules package's `CategoryNode` (which has `labelKo` and `labelEn`). The `analyzer.ts:toRulesCategoryNodes` adapter drops the `label` field.
- **Mismatch**: The `label` field in the web type suggests it's used somewhere, but the rules package doesn't recognize it.
- **Suggested fix**: Remove the `label` field from the web CategoryNode if it's unused, or document why it exists alongside `labelKo`.
- **Confidence**: Medium (minor type inconsistency)
