# Cycle 14 Implementation Plan

**Date:** 2026-04-19
**Source reviews:** `.context/reviews/2026-04-19-cycle14-comprehensive.md`, `.context/reviews/_aggregate.md`
**Status:** Complete

---

### Task 1: Fix `buildAssignments` to use `categoryKey` for grouping [C14-01] — DONE

- **Commit:** `00000008a63e89ec1645c6e1d8196407506e3b71`
- Exported `buildCategoryKey` from `reward.ts`
- Changed grouping key from `${tx.category}::${cardId}` to `${categoryKey}::${cardId}`
- Updated `categoryNameKo` resolution to fall back from categoryKey to parent category
- All 95 core tests pass

- **Severity:** MEDIUM
- **Confidence:** High
- **Files:** `packages/core/src/optimizer/greedy.ts:117`
- **Description:** `buildAssignments` groups transactions by `${assignment.tx.category}::${assignment.assignedCardId}`, which uses only the parent category (e.g., `dining`). This collapses subcategory distinctions (e.g., `dining.cafe`) into a single assignment row. The reward calculation in `calculateRewards` correctly uses `buildCategoryKey(tx.category, tx.subcategory)`, but the assignment display loses this information.
- **Fix:**
  1. Import or replicate `buildCategoryKey` from `reward.ts` in `greedy.ts`
  2. Change the grouping key from `${assignment.tx.category}::${assignment.assignedCardId}` to `${buildCategoryKey(assignment.tx.category, assignment.tx.subcategory)}::${assignment.assignedCardId}`
  3. Update `categoryNameKo` resolution to use the full categoryKey (parent + subcategory)
  4. Verify existing optimizer tests still pass
- **Verification:** Run `bun test packages/core/` and verify assignment output preserves subcategory breakdown

### Task 2: Clarify mileage rate convention in normalizeRate [C14-09] — DONE

- **Commit:** `0000000e0d2d55cf1954859463a0be1c4f45c34b`
- Investigation confirmed mileage YAML rates already use Won-equivalent percentage form
- Added documentation to `normalizeRate` explaining the convention
- No data changes needed — existing calculation is correct

- **Severity:** MEDIUM
- **Confidence:** Medium
- **Files:** `packages/core/src/calculator/reward.ts:113-117`, 29 YAML files in `packages/rules/data/cards/`
- **Description:** Mileage rules in YAML use percentage-style rates (e.g., `rate: 1.0` meaning "1 mile per 1,500 Won"), but `normalizeRate` divides all rates by 100 (1.0 -> 0.01 = 1%). This produces incorrect mileage reward calculations. For example, a 1,500 Won transaction with `rate: 1.0` gives `floor(1500 * 0.01)` = 15 Won-equivalent instead of 1 mile.
  
  The root cause is that mileage rates follow a different convention than discount/points/cashback rates:
  - Discount/points/cashback: rate in percentage form (1.5 = 1.5%)
  - Mileage: rate in "miles per 1,500 Won" form (1.0 = 1 mile per 1,500 Won)
  
  Two possible fix approaches:
  
  **Approach A (Preferred):** Convert mileage YAML rules to use `fixedAmount` + `unit: 'mile_per_1500won'`, which is already handled correctly by `calculateFixedReward`. This is the cleanest approach because it doesn't require changing `normalizeRate` logic.
  
  **Approach B:** Skip `normalizeRate` for mileage type and use the rate directly as a "miles per 1,500 Won" multiplier in a specialized calculation.
  
- **Fix (Approach A):**
  1. For each mileage YAML rule with a percentage-style `rate`, convert to `fixedAmount` + `unit: 'mile_per_1500won'`
  2. For rates that are already decimal (e.g., 0.067), these represent "1 mile per ~15,000 Won" — calculate the equivalent fixedAmount
  3. Remove `rate` field from mileage rules that use `fixedAmount`
  4. Verify all 29 mileage YAML files are updated
  5. Run test suite to verify no regressions
- **Verification:** Run full test suite + spot-check mileage reward calculations for a few cards

### Task 3: Add comment documenting array mutation contract in `greedyOptimize` [C14-05] — DONE

- **Commit:** `00000006decf93649a643277a6a2376cb30f5538`
- Added mutation contract comment above the push/mutate line

- **Severity:** LOW
- **Confidence:** High
- **Files:** `packages/core/src/optimizer/greedy.ts:235-237`
- **Description:** The `assignedTransactionsByCard` map stores arrays that are mutated in-place via `push`. This is correct but could be surprising in a refactoring context. A comment documenting the mutation contract would help future maintainers.
- **Fix:** Add a comment above line 235 explaining the in-place mutation contract
- **Verification:** No functional change — comment only

### Task 4: Add warning log when Layout.astro falls back to hardcoded stats [C14-07] — DONE

- **Commit:** `00000006decf93649a643277a6a2376cb30f5538`
- Changed `catch {}` to `catch (err) { console.warn(...) }`

- **Severity:** LOW
- **Confidence:** Medium
- **Files:** `apps/web/src/layouts/Layout.astro:24`
- **Description:** The empty `catch {}` block on line 24 silently swallows errors when `cards.json` is not found. A warning log would help diagnose build issues.
- **Fix:** Change `catch {}` to `catch (err) { console.warn('[cherrypicker] cards.json not found at build time, using fallback stats:', err); }`
- **Verification:** Verify build still succeeds when cards.json is missing

---

## Deferred Items

The following findings from cycle 14 are deferred per repo rules (all are LOW severity, non-security, non-correctness, non-data-loss):

| Finding | Severity | Confidence | Reason for deferral | Exit criterion |
|---------|----------|------------|---------------------|----------------|
| C14-02 | LOW | Medium | Duplicate ID validation is defense-in-depth. No known scenario produces duplicates in practice. | User reports duplicate ID corruption |
| C14-03 | LOW | High | Full-width Latin normalization is a nice-to-have. Korean card statements rarely use full-width Latin. | User reports search failure for full-width merchant names |
| C14-04 | LOW | High | Caching is by design for a static site. Rules don't change within a session. | Dynamic rule updates are implemented |
| C14-05 | LOW | High | Array mutation is not a current bug — would only matter if optimizer is refactored for backtracking. | Optimizer is refactored with backtracking |
| C14-06 | LOW | Medium | Scientific notation is never seen in Korean card CSV exports. | A CSV file with scientific notation is encountered |
| C14-08 | LOW | Medium | Page-level drag listeners work correctly with full-page navigation. | Astro View Transitions or SPA mode is enabled |
| C14-10 | LOW | Medium | Wildcard rule matching confirmed correct — specificity ordering works. | A card with conflicting wildcard + specific rules produces wrong results |
