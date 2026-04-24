# Cycle 11 — Performance Reviewer

Date: 2026-04-24

## Findings

### C11-P01: CategoryBreakdown re-sorts already-sorted data on every render
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:125`
- **Severity:** LOW
- **Confidence:** High
- **Description:** `[...assignments].sort((a, b) => b.spending - a.spending)` creates a copy and sorts every time the derived computation runs. The optimizer already returns assignments sorted by spending. Comment at line 122-124 acknowledges this. The copy+sort is O(n log n) per render. For typical datasets (< 50 categories), this is negligible.
- **Failure scenario:** No failure — just unnecessary work. Keeping as-is per C9-07.
- **Fix:** Already documented as intentionally kept (C9-07).

### C11-P02: MerchantMatcher.substring scan is O(k*m) where k = keyword count, m = merchant name length
- **File:** `packages/core/src/categorizer/matcher.ts:59-74`
- **Severity:** LOW
- **Confidence:** Medium
- **Description:** The pre-computed `SUBSTRING_SAFE_ENTRIES` avoids per-call `Object.entries()` allocation (C33-01), but the inner loop still calls `lower.includes(kw)` for every keyword entry. For large keyword sets and many transactions, this is the dominant cost.
- **Failure scenario:** Not a correctness issue. Performance is acceptable for typical workloads (< 1000 tx, < 500 keywords).
- **Fix:** Could use a trie or Aho-Corasick automaton for O(m) substring matching. Out of scope for current workloads.

## Convergence with prior cycles

- The `scoreCardsForTransaction` push/pop optimization (C68-02) remains intact and effective.
- The O(1) card-by-ID index (C62-09) remains in place in `cards.ts`.
- No new performance regressions detected.

## Final sweep

Examined all hot paths: optimizer greedy loop, categorizer matcher, PDF parser, CSV parser, sessionStorage persistence. No new performance issues found beyond the deferred items.
