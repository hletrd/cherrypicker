# Cycle 10 — Performance Reviewer

Date: 2026-04-24

## Inventory of reviewed files

All source files in `packages/core/src/`, `apps/web/src/lib/`, and `apps/web/src/components/`.

## Findings

### C10-P01: `scoreCardsForTransaction` calls `calculateCardOutput` twice per card per transaction
- **File+line:** `packages/core/src/optimizer/greedy.ts:136-143`
- **Description:** Same as D-09/D-51/D-86. The push/pop pattern avoids array allocation but still requires two full reward calculations per card per transaction. For typical use cases (< 1000 transactions, < 10 cards), this is fast enough.
- **Confidence:** High
- **Status:** ALREADY TRACKED (D-09/D-51/D-86)

### C10-P02: `CategoryBreakdown` re-sorts assignments on every render
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:125`
- **Description:** Same as C9-07. The comment documenting the intentional redundancy is now in place. The sort is O(n log n) with n = number of categories (typically < 30), so negligible.
- **Confidence:** High
- **Status:** RESOLVED (comment added in C9-07)

### C10-P03: `Taxonomy.findCategory` iterates all keywords for substring/fuzzy search
- **File+line:** `packages/core/src/categorizer/taxonomy.ts:68-101`
- **Description:** Same as D-100. The O(n*m) per-merchant cost with ~2000 keywords is acceptable at current scale.
- **Confidence:** High
- **Status:** ALREADY TRACKED (D-100)

## Sweep for commonly missed issues

1. **Memory allocation in `calculateRewards`:** The `rewardTypeAccum` Map creates per-category Maps. With typical usage (< 30 categories), this is negligible. No concern.

2. **`Math.max(...array)` in OptimalCardMap:** Same as D-73/D-89. With < 50 assignments, stack overflow is impossible. Tracked.

3. **`buildCardResults` re-calls `calculateCardOutput` for each card:** This is necessary because `buildCardResults` computes per-card totals from the assigned transactions, not just the marginal deltas. The results are cached in `cardResults` and only recomputed on reoptimize.

4. **Svelte 5 reactivity:** All `$derived` and `$derived.by` computations are appropriately lazy. No unnecessary re-computations detected.

## Conclusion

Zero net-new actionable performance findings. All known performance items are tracked in deferred items with appropriate exit criteria.
