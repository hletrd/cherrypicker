# Cycle 49 Plan

**Date:** 2026-04-22
**Source:** `.context/reviews/2026-04-22-cycle49-comprehensive.md`

---

## Review Summary

2 new findings identified in cycle 49 (both LOW severity). The codebase remains in a stable state with all HIGH and MEDIUM severity issues resolved. C49-01 is dead code removal (cosmetic). C49-02 is a potential label map collision risk with no current collision in the taxonomy.

---

## Implementation Tasks

### Task 1: Remove dead `isSubstringSafeKeyword` function (C49-01)

**File:** `packages/core/src/categorizer/matcher.ts:21-23`
**Severity:** LOW
**Confidence:** HIGH

**What:** The function `isSubstringSafeKeyword` is defined but never called. The filtering it would perform is done inline at module level via `SUBSTRING_SAFE_ENTRIES` (line 18-19) which was added for C33-01.

**Why:** Dead code adds confusion and maintenance burden. The function was superseded by the pre-computed `SUBSTRING_SAFE_ENTRIES` array.

**Fix:** Remove lines 21-23 (the `isSubstringSafeKeyword` function).

**Verification:** `npm run typecheck` and `npx vitest run` must pass.

---

### Task 2: Remove bare subcategory ID key from `buildCategoryLabelMap` (C49-02)

**File:** `apps/web/src/lib/category-labels.ts:11`
**Severity:** LOW
**Confidence:** MEDIUM

**What:** `buildCategoryLabelMap` sets `labels.set(sub.id, sub.labelKo)` on line 11, creating a bare subcategory ID key (e.g., "cafe") in the label map. This could shadow a top-level category with the same ID. The dot-notation key on line 17 (`${node.id}.${sub.id}`) is the one actually used by the optimizer.

**Why:** Currently no collision exists in the taxonomy, but the bare key creates a latent collision risk. The optimizer uses `buildCategoryKey()` which produces dot-notation keys like "dining.cafe", so the bare key is only used by `TransactionReview.svelte`'s `categoryMap` which builds its own map independently from the category nodes. The bare key is not needed in `buildCategoryLabelMap`.

**Fix:** Remove line 11 (`labels.set(sub.id, sub.labelKo)`). Add a comment above line 17 explaining why only the dot-notation key is set for subcategories.

**Verification:** `npm run typecheck`, `npx vitest run`, and `bun test packages/parser tools/scraper` must pass. Verify no regressions by checking that the analyzer and CardDetail components still display correct Korean labels.

---

## Deferred Items (Active, carried forward)

No new deferred items. All prior deferred items remain unchanged from cycle 48.

| ID | Severity | File | Description | Reason for Deferral |
|---|---|---|---|---|
| C49-03/C41-04 | LOW | CategoryBreakdown | maxPercentage initial value 1 | Cosmetic only; no data correctness impact |
| C49-04/C18-01 | LOW | VisibilityToggle | $effect directly mutates DOM | Would require architectural refactoring |
| C7-04 | LOW | TransactionReview | $effect re-sync fragile | Works correctly; edge case only |
| C7-06 | LOW | analyzer.ts | analyzeMultipleFiles optimizes only latest month | By design |
| C7-07 | LOW | detect.ts/csv.ts | BANK_SIGNATURES duplicated | Divergence risk is LOW |
| C7-11 | LOW | store.svelte.ts | persistWarning message misleading | Low severity |
| C8-05/C4-09 | LOW | CategoryBreakdown | CATEGORY_COLORS poor dark mode contrast | Cosmetic |
| C8-07/C4-14 | LOW | build-stats.ts | Fallback values will drift | Low severity |
| C8-08 | LOW | date-utils.ts | inferYear() timezone-dependent | Narrow edge case |
| C8-09 | LOW | Tests | Test duplicates production code | Low severity |
| C18-02 | LOW | VisibilityToggle | Stat elements queried every effect run | Low severity |
| C18-03 | LOW | SavingsComparison | Annual savings no seasonal adjustment | By design (label says "단순 연환산") |
| C18-04 | LOW | xlsx.ts | isHTMLContent only checks first 512 bytes | Known limitation |
| C19-04 | LOW | FileDropzone | Navigation uses full page reload | Low severity |
| C19-05 | LOW | CardDetail | Navigation uses full page reload | Low severity |
| C21-02 | LOW | cards.ts | Shared fetch AbortSignal race | Low severity |
| C21-04/C23-02/C25-02/C26-03 | LOW->MEDIUM | analyzer.ts/cards.ts | cachedCategoryLabels stale across redeployments | Requires architectural change |
| C22-04 | LOW | csv.ts | CSV adapter registry only covers 10 of 24 banks | Low severity |
| C33-01 | MEDIUM | matcher.ts | MerchantMatcher substring scan O(n) | Partially fixed; full fix requires index |
| C33-02 | MEDIUM | store.svelte.ts | cachedCategoryLabels stale across redeployments | Same as C21-04 |
| C34-04 | LOW | pdf/index.ts | Server-side PDF has no fallback line scanner | Low severity |
| C41-05/C42-04 | LOW | cards.ts | loadCategories returns empty array on AbortError | By design (AbortError is expected) |
| C4-10 | MEDIUM | E2E tests | E2E test stale dist/ dependency | E2E tests not in critical path |
| C4-11 | MEDIUM | Core | No regression test for findCategory fuzzy match | Test gap but existing tests cover optimizer |
| D-01 through D-111 | Various | Various | See `00-deferred-items.md` for full list | See individual deferral rationale |

---

## Status of Prior Plans

| Plan | Status |
|---|---|
| `cycle48-review.md` | DONE -- no implementation tasks |
| `cycle49-fixes.md` (prior, different cycle numbering) | DONE -- all tasks implemented |
| `cycle51-review.md` | DONE -- no implementation tasks |
| All prior cycle plans | DONE or archived |
