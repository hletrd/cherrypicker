# Performance Reviewer — Cycle 12

**Date:** 2026-04-24
**Reviewer:** perf-reviewer

## Findings

### C12-PR01: `scoreCardsForTransaction` recalculates all card rewards per transaction [LOW]
- **File:** `packages/core/src/optimizer/greedy.ts:124-156`
- **Description:** For each transaction, `scoreCardsForTransaction` calls `calculateCardOutput` twice per card (before push + after push), each of which iterates all previously assigned transactions. This is O(T * C * T) where T is transactions and C is cards. For typical usage (< 1000 tx, < 10 cards) this is fast enough. This is the same finding as D-09, already tracked as deferred.
- **Confidence:** High
- **Severity:** LOW (already deferred as D-09)

### C12-PR02: `CategoryBreakdown` re-sorts already-sorted assignments [LOW]
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:125`
- **Description:** The component re-sorts assignments by spending even though the optimizer already returns them sorted. This was documented as intentional (C9-07) to avoid hidden coupling. Acceptable tradeoff — sort is O(n log n) for a small n.
- **Confidence:** High
- **Severity:** LOW (already resolved per C9-07)

### C12-PR03: sessionStorage JSON.stringify + JSON.parse on every store mutation [LOW]
- **File:** `apps/web/src/lib/store.svelte.ts:146-190`
- **Description:** `persistToStorage` serializes the entire analysis result (potentially hundreds of transactions) on every `analyze()` and `reoptimize()` call. For very large statement sets, this could cause micro-stutters. However, `reoptimize` is only called on explicit user action (category edit + "apply"), so the frequency is low. The 4MB cap also limits the data volume.
- **Confidence:** Medium
- **Severity:** LOW

## Convergence Note

No new MEDIUM or HIGH performance findings. All findings are LOW-severity instances of known deferred patterns or acceptable tradeoffs. The O(n*m) scoring (D-09) remains the dominant theoretical concern but is impractical to fix without incremental reward tracking.
