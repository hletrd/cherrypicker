# Review Aggregate — 2026-04-19 (Cycle 4)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle4-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- `.context/reviews/_aggregate.md` (cycle 3)
- All cycle 1-3 per-agent files

---

## Deduplication with Prior Reviews

All cycle 1-3 findings have been verified as fixed or deferred. They are not re-listed here unless a cycle 4 finding extends or revisits them.

Deferred items D-01 through D-39 remain unchanged and are not re-listed here.

Cycle 4 revisits C4-12 (D-28 re-evaluation) — the `parseInt` NaN issue is trivially fixable and should be promoted from deferred.

---

## Verification of Cycle 3 Fixes

All 13 cycle 3 fixes verified as correctly implemented. See cycle 4 review for details.

---

## Active Findings (New in Cycle 4, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C4-01 | MEDIUM | High | `SavingsComparison.svelte:70-73` | Division by zero when `bestSingleCard.totalReward` is 0 — displays NaN | New |
| C4-02 | LOW | High | `analyzer.ts:88,167` | `loadCategories()` called twice per optimization flow — redundant map construction | Related to C3-P04 |
| C4-03 | LOW | High | `analyzer.ts:267-271` | `monthlyBreakdown` computed with O(n*m) filter per month | New (perf) |
| C4-04 | MEDIUM | High | `CategoryBreakdown.svelte:147-148` | Tooltip inaccessible via keyboard/touch — wrong ARIA role, no tabindex | New (a11y) |
| C4-05 | LOW | High | `analyzer.ts:164-177` | `constraints.categoryLabels` mutated after `buildConstraints` returns | New (arch) |
| C4-06 | LOW | High | `SavingsComparison.svelte:172-173` | Annual savings projection (monthly * 12) is misleading | New (UX) |
| C4-07 | LOW | High | `SpendingSummary.svelte:10-12,107` | `localStorage` for dismissed warning vs `sessionStorage` for data — inconsistency | New (UX) |
| C4-08 | MEDIUM | Medium | `TransactionReview.svelte:124-129` | `editedTxs` sync effect may re-fire on any reactive update, risking in-progress edit loss | Extends C3-07 |
| C4-09 | LOW | High | `CategoryBreakdown.svelte:7-49` | Hardcoded `CATEGORY_COLORS` not sourced from taxonomy | Same class as C3-03 |
| C4-10 | MEDIUM | High | `e2e/core-regressions.spec.js:16-24` | E2E test depends on pre-built `dist/` — tests stale code if not rebuilt | New (test) |
| C4-11 | MEDIUM | High | `packages/core/__tests__/` (missing) | No regression test for `findCategory` fuzzy match fix (C3-01) | Missing test for C3-01 |
| C4-12 | LOW | High | `FileDropzone.svelte:200` | `parseInt` produces NaN/wrong value for "1e5" input (D-28 re-evaluation — fix is trivial) | Re-opens D-28 |
| C4-13 | LOW | Medium | `CategoryBreakdown.svelte:114` | Small-percentage bars nearly invisible (minimum width issue) | New (UX) |
| C4-14 | LOW | High | `Layout.astro:15-24` | Stale fallback values (683, 24, 45) in footer when `cards.json` read fails | New (data) |
| C4-15 | LOW | High | `analyzer.ts:181` | `toCoreCardRuleSets` creates new array copies on every optimization — not cached | New (perf) |

---

## Cross-Agent Agreement (Cycle 4)

| Finding | Signal |
|---|---|
| C4-09 / C3-03 | Hardcoded maps not sourced from taxonomy — 3 findings across cycles (strong signal) |
| C4-08 / C3-07 | `editedTxs` sync issues — 2 findings (C3-07 fixed, C4-08 identifies residual risk) |
| C4-12 / D-28 | `parseInt` NaN — 2 findings, trivial fix, should be promoted from deferred |

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C4-01: Fix SavingsComparison division by zero (NaN display)
2. C4-04: Fix CategoryBreakdown a11y (keyboard/touch access to tooltip)
3. C4-11: Add regression test for `findCategory` fuzzy match
4. C4-10: Add pre-build step or warning in E2E tests for stale dist/
5. C4-08: Add generation counter to prevent over-broad `editedTxs` re-sync

### MEDIUM (plan for next cycles or fix if time allows)
6. C4-12: Fix `parseInt` -> `Number` with `isFinite` guard (promote from D-28)
7. C4-05: Pass `categoryLabels` into `buildConstraints` instead of mutating
8. C4-02: Eliminate redundant `loadCategories()` call
9. C4-03: Compute `monthlyBreakdown` in single pass
10. C4-15: Cache `toCoreCardRuleSets` result

### LOW (defer or accept)
- C4-06, C4-07, C4-09, C4-13, C4-14

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
