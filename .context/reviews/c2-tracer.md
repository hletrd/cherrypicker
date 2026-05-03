# Cycle 2 — tracer pass

**Date:** 2026-05-03

## Scope

Causal tracing of suspicious flows, competing hypotheses.

## Findings

### C2-TR01: reoptimize cardIds forwarding — now correctly implemented (re-confirmed from C1-TR01, now FIXED)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/store.svelte.ts:579`
- **Description:** When `reoptimize` is called after a category edit, it now forwards the original `cardIdsOption` from the snapshot (line 579: `cardIds: options?.cardIds ?? snapshot.cardIdsOption`). This means if the user selected specific cards during the initial analysis, those are properly preserved across reoptimize calls. The C1-TR01 finding about dropped cardIds is now addressed.
- **Status:** FIXED (cardIds forwarding implemented).

## Traces performed

1. **Upload → parse → categorize → optimize flow**: Files are parsed, categorized with MerchantMatcher, filtered to latest month, optimized with greedyOptimize. All guards in place.
2. **Reoptimize after category edit**: cardIds correctly forwarded from snapshot at line 579. previousMonthSpending preserved per C44-01. Monthly breakdown recomputed from edited transactions.
3. **sessionStorage persistence → load → restore**: Version check, migration, validation, and warning tracking all working correctly.

## Summary

0 net-new trace findings. C1-TR01 now verified as fixed (cardIds forwarding implemented).
