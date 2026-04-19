# Review Aggregate — 2026-04-19 (Cycle 25)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle25-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-24 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-24 findings have been verified as fixed or deferred. Cycle 24 findings C24-01, C24-02, C24-03 are now CONFIRMED FIXED.

C25-01 is a new finding (rate + fixedAmount coexistence silently drops fixed reward). Not previously reported in any cycle.

C25-02 is a new finding (greedy optimizer recalculation performance). The O(N*M*K) complexity was implicitly acknowledged in prior reviews but never formally flagged as a finding.

C25-03 is a new finding (search only matches merchant names). Not previously reported.

C25-04 is a new finding (redundant MerchantMatcher construction). Not previously reported.

C25-05 is a new finding (spending/transaction count scope mismatch). Not previously reported.

Deferred items D-01 through D-105 remain unchanged and are not re-listed here.

---

## Verification of Cycle 24 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C24-01 | FIXED | `apps/web/src/lib/analyzer.ts:106` — ID includes file index prefix |
| C24-02 | FIXED | `SavingsComparison.svelte:189` — Math.abs used for annual display when negative |
| C24-03 | FIXED | `SavingsComparison.svelte:82-97` — Bar widths invert when optimizer is suboptimal |

---

## Active Findings (New in Cycle 25, Deduplicated)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C25-01 | MEDIUM | High | `packages/core/src/calculator/reward.ts:253-271` | When both rate and fixedAmount are present on a tier, only rate-based reward is calculated — fixed amount is silently ignored | OPEN |
| C25-02 | LOW | High | `packages/core/src/optimizer/greedy.ts:116-141` | Greedy optimizer recalculates full per-card rewards from scratch for every transaction — O(N*M*K) complexity | OPEN |
| C25-03 | LOW | High | `apps/web/src/components/dashboard/TransactionReview.svelte:153-155` | Search only matches merchant names, not category labels | OPEN |
| C25-04 | LOW | High | `apps/web/src/lib/analyzer.ts:86-135` | `parseAndCategorize` creates a new MerchantMatcher per file — redundant in multi-file uploads | OPEN |
| C25-05 | LOW | Medium | `apps/web/src/components/dashboard/SpendingSummary.svelte:57` | Total spending shows only latest month but transaction count shows all months — inconsistent scope | OPEN |

---

## Prioritized Action Items

1. **C25-01**: Handle rate + fixedAmount coexistence — either sum both reward components before applying the monthly cap, or add a schema-level constraint that makes them mutually exclusive with a warning
2. **C25-02**: Optimize greedy optimizer — cache per-card output and incrementally update instead of full recalculation (performance, not correctness)
3. **C25-03**: Extend transaction search to include category labels — allows finding transactions by category name
4. **C25-04**: Hoist MerchantMatcher construction out of `parseAndCategorize` — construct once in `analyzeMultipleFiles`
5. **C25-05**: Fix spending/transaction count scope mismatch — make both metrics consistent

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
