# Cycle 10 — Code Reviewer

Date: 2026-04-24

## Inventory of reviewed files

- `packages/core/src/calculator/reward.ts` (388 lines)
- `packages/core/src/optimizer/greedy.ts` (357 lines)
- `packages/core/src/optimizer/constraints.ts` (26 lines)
- `packages/core/src/categorizer/matcher.ts` (104 lines)
- `packages/core/src/categorizer/taxonomy.ts` (149 lines)
- `apps/web/src/lib/store.svelte.ts` (607 lines)
- `apps/web/src/lib/analyzer.ts` (425 lines)
- `apps/web/src/lib/cards.ts` (367 lines)
- `apps/web/src/lib/formatters.ts` (241 lines)
- `apps/web/src/lib/category-labels.ts` (110 lines)
- `apps/web/src/lib/build-stats.ts` (35 lines)
- `apps/web/src/lib/api.ts` (19 lines)
- `apps/web/src/components/dashboard/CategoryBreakdown.svelte` (293 lines)
- `apps/web/src/components/dashboard/SavingsComparison.svelte` (330 lines)
- `apps/web/src/components/dashboard/SpendingSummary.svelte` (189 lines)
- `apps/web/src/components/dashboard/TransactionReview.svelte` (345 lines)
- `apps/web/src/components/dashboard/OptimalCardMap.svelte` (185 lines)
- `apps/web/src/components/upload/FileDropzone.svelte` (558 lines)
- `apps/web/src/components/cards/CardDetail.svelte` (303 lines)
- `apps/web/src/components/ui/VisibilityToggle.svelte` (126 lines)

## Findings

### C10-CR01: `rewardTypeAccum` Map creates per-category Map objects on every transaction
- **File+line:** `packages/core/src/calculator/reward.ts:338-340`
- **Description:** Inside the `calculateRewards` loop, for each transaction that has a rule match, a `typeMap` is obtained via `rewardTypeAccum.get(categoryKey) ?? new Map<string, number>()`. When the category has no existing entry, a new Map is created. This Map is then `.set()` on both `typeMap` and `rewardTypeAccum`. This is correct behavior, but the `?? new Map()` pattern creates a throwaway Map on every first-hit transaction for a category that is never used again. The `rewardTypeAccum.set(categoryKey, typeMap)` on line 340 ensures the Map is registered, so subsequent hits reuse it. This is not a bug, just a minor allocation that could be avoided with a `getOrCreate` helper. **Not actionable — too minor to justify a change.**
- **Confidence:** High
- **Severity:** INFORMATIONAL

### C10-CR02: `normalizeRate` divides by 100 unconditionally — decimal-form rates would produce wrong results
- **File+line:** `packages/core/src/calculator/reward.ts:120-128`
- **Description:** Same as D-97 (previously deferred). All existing YAML files use percentage form. The division by 100 is correct for percentage-form rates. If decimal-form rates (e.g., 0.015 for 1.5%) were ever introduced, this would produce 0.015% instead of 1.5%. Already tracked as D-97.
- **Confidence:** High
- **Status:** DEFERRED (same as D-97)

### C10-CR03: Hardcoded taxonomy duplicates — same systemic pattern as C7-01 through C9-05
- **File+line:** Multiple files (see aggregate)
- **Description:** All 7+ instances of hardcoded taxonomy/issuer data duplication are already tracked (C7-01, C7-02, C8-01, C9-01 through C9-05). No new instances found. The `entertainment.subscription` inconsistency in FALLBACK_CATEGORY_LABELS is tracked as C7-04. All properly deferred.
- **Confidence:** High
- **Status:** ALREADY TRACKED

## Sweep for commonly missed issues

1. **Error handling in `calculateRewards`:** All paths through the reward calculation are handled. The `tierId === 'none'` case correctly produces 0 rewards with a warning. The `!tierRate` case correctly continues with just the rewardType updated.

2. **Edge cases in `findRule`:** The specificity-based sorting with index fallback for deterministic ordering is correct. The wildcard exemption for `rule.category === '*'` is properly documented.

3. **State consistency in `store.svelte.ts`:** The `snapshot` pattern in `reoptimize()` (line 497) correctly prevents race conditions during async gaps. The `generation` counter correctly triggers sync effects in TransactionReview.

4. **SessionStorage persistence:** The truncation, validation, and migration logic is thorough. The `STORAGE_VERSION` and `MIGRATIONS` framework is in place for future schema changes.

5. **`buildConstraints` shallow copy:** C9-06 fix is in place — the comment explains the optimizer is read-only on the transactions array.

## Conclusion

Zero net-new actionable findings. The codebase has converged on the known systemic issues (hardcoded taxonomy duplicates), all of which are properly tracked in deferred items. Recent fixes from cycles 8-9 are intact and correct.
