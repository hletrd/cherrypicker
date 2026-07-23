# Plan 115 — Cycle 9 Canonical Analysis and Category Truth

**Findings:** C9-002 (Medium/High), C9-003 (Medium/High), C9-004
(Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- Coordinated assignment/card category relabels pass because two derived
  objects agree while canonical transactions do not.
- Assignment buckets are counted as if they were transactions, so a mixed
  result can report two unassigned rows as one while preserving spending.
- Truncated snapshots retain independently mutable monthly and optimizer
  totals without a compact canonical category witness.
- `capsHit`, `capReached`, and `capAmount` are structurally validated but not
  reconciled; impossible applied rewards and unknown cap categories restore.
- Dashboard category panels consume optimizer assignments, dropping all
  unassigned spending and rendering a false empty state when no reward exists.

## Outcome

Every analysis carries a compact latest-month category summary derived from
transactions before optimization. Persistence, optimizer allocations, cap
disclosures, and dashboard category UI reconcile against that canonical
summary, including transaction-truncated snapshots.

## Implementation

1. Add a framework-free, versioned category summary to `AnalysisResult` with
   category key, Korean label, positive spending, and transaction count.
   Build it from latest-month categorized transactions in initial analysis and
   rebuild it after edits/reoptimization.
2. Add exact assignment transaction counts (or an equivalent stable allocation
   witness) to the core optimizer result. Reconcile per-category assigned
   spending/count plus derived unassigned remainder with the canonical summary.
3. Bump the persisted schema version. Store the compact category summary even
   when raw transactions exceed the storage budget. Fail closed on legacy
   snapshots whose allocation witness cannot be proved.
4. Reconcile latest monthly spending/count, optimizer total/unassigned facts,
   and category-summary totals in both full and truncated branches.
5. Validate cap semantics: safe ordering (`appliedReward <= actualReward`),
   referenced categories, category `capReached` agreement, cap amount/type
   relationships, and impossible/unknown records. Preserve legitimate repeated
   per-transaction/global cap events.
6. Drive `SpendingSummary` and `CategoryBreakdown` from the canonical summary,
   keeping assignments exclusive to recommendation views. Add a stable
   category-panel test boundary.
7. Add coordinated-mutation, mixed-unassigned, truncated-contradiction,
   cap-contradiction, mixed-benefit UI, all-unassigned UI, and card-selection
   invariance tests through both coherence and public persistence boundaries.

## Acceptance

- [x] Category allocations cannot contradict latest-month transactions.
- [x] Mixed assigned/unassigned transaction counts are exact.
- [x] Truncated snapshots preserve and validate canonical category/month facts.
- [x] Impossible cap disclosures are rejected atomically.
- [x] Category amounts and percentages total all positive latest-month spending
      and do not change with card selection.
- [x] All-unassigned analyses show real category data, not an empty state.

## Execution note

The requested `ralph` skill is not registered. Prompt 3 will use a manual
mutation-matrix loop with focused core/web/persistence tests before the whole
repository gates. No finding in this correctness/data-truth plan is deferred.

## Completion evidence

- Schema version 4 persists a canonical category summary and exact assignment
  counts, including transaction-truncated snapshots. Coherence validation now
  rejects category, monthly, optimizer, and cap contradictions atomically.
- Dashboard category views consume the canonical summary and retain unassigned
  spending. Focused web tests passed with 766 tests, and the full gate matrix
  passed.
