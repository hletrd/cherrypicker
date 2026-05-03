# Cycle 1 (fresh) — tracer pass

**Date:** 2026-05-03

## Scope

Causal tracing of suspicious flows, competing hypotheses.

## Findings

### C1-TR01: reoptimize drops cardIds filter after category edit

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/store.svelte.ts:477-588`, `apps/web/src/lib/analyzer.ts:205-208`
- **Description:** When `reoptimize` is called after a category edit, it doesn't forward the original `cardIds` filter from the initial analysis. The `options` parameter in `reoptimize` comes from the function argument, and `TransactionReview.svelte` calls reoptimize without cardIds. This means after the first category edit, optimization runs against all cards instead of the originally selected subset. This is likely acceptable behavior (users can re-upload with different card selections), but it's a semantic inconsistency.
- **Fix:** Store `cardIds` option in `AnalysisResult` (similar to `previousMonthSpendingOption`) and forward it in reoptimize.

## Summary

1 finding (LOW). No new critical traces discovered.
