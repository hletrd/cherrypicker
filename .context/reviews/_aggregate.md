# Review Aggregate — 2026-04-19 (Cycle 24)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle24-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-23 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-23 findings have been verified as fixed or deferred. Cycle 23 findings C23-01, C23-02 are now CONFIRMED FIXED.

C24-01 is a new finding (duplicate transaction IDs on multi-file upload). Not previously reported in any cycle.

C24-02 is a new finding (double-negative in annual savings display). This is a residual issue from the C23-02 fix — the sign prefix was fixed but the absolute-value issue in the annual label was not.

C24-03 is a new finding (misleading bar comparison when optimizer is suboptimal). Not previously reported.

Deferred items D-01 through D-105 remain unchanged and are not re-listed here.

---

## Verification of Cycle 23 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C23-01 | FIXED | `packages/core/src/calculator/reward.ts:161-166` — `won_per_liter` unit now returns `fixedAmount` as per-transaction discount |
| C23-02 | FIXED | `SavingsComparison.svelte:173` — conditional `+` prefix; line 175 — label switches to "추가 비용" when negative |

---

## Active Findings (New in Cycle 24, Deduplicated)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C24-01 | MEDIUM | High | `apps/web/src/lib/analyzer.ts:101-117` | Duplicate transaction IDs when multiple files are uploaded — breaks Svelte keyed each and `changeCategory` in TransactionReview | OPEN |
| C24-02 | MEDIUM | High | `apps/web/src/components/dashboard/SavingsComparison.svelte:175` | Negative annual savings displays double-negative "-X원 추가 비용" — minus sign from `formatWon` conflicts with "추가 비용" label | OPEN |
| C24-03 | LOW | High | `apps/web/src/components/dashboard/SavingsComparison.svelte:79-83` | Bar comparison visually misleading when greedy optimizer is suboptimal — both bars render at 100% width | OPEN |

---

## Prioritized Action Items

1. **C24-01**: Fix duplicate transaction IDs — include file index in the ID pattern to prevent collision across multi-file uploads
2. **C24-02**: Fix double-negative annual savings display — use `Math.abs()` when the label is "추가 비용"
3. **C24-03**: Fix misleading bar comparison — invert bar widths when optimizer is suboptimal

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
